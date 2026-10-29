#!/usr/bin/env node
'use strict';

/**
 * Agentic fixer for banned-phrases (casual/marketing/buzzword) findings.
 *
 * banned-phrases.js only IDENTIFIES a flagged phrase and a suggested fix
 * word/phrase (tier 1, blocking). Swapping the phrase in verbatim can break
 * grammar or sentence flow, so this script shells out to the `claude` CLI in
 * headless print mode (`claude -p`) once per flagged line, asks for a
 * rewrite scoped to that line only, and (with --apply) writes the result
 * back to the file.
 *
 * Defaults to a dry run that prints proposed before/after pairs. Nothing is
 * written to disk unless --apply is passed.
 *
 * Usage:
 *   node fix/fix-banned-phrases.js <file> [--apply] [--yes] [--verify]
 */

const path = require('path');
const fs = require('fs');
const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { checkBannedPhrases } = require('../checks/banned-phrases');
const { checkEmDashSemicolon } = require('../checks/em-dash-semicolon');
const { blockquoteProblems } = require('./verify-edit-integrity');
const { isTableRow, separatorCount, rowShapeOk } = require('../lib/table-shape');

const CLAUDE_TIMEOUT_MS = 120000;
const MAX_ATTEMPTS = 2;

function parseArgs(argv) {
  const args = { file: null, apply: false, yes: false, verify: false };
  for (const arg of argv) {
    if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--yes') {
      args.yes = true;
    } else if (arg === '--verify') {
      args.verify = true;
    } else if (!arg.startsWith('--')) {
      args.file = arg;
    }
  }
  return args;
}

function buildPrompt(fullLine, phrase, suggestedFix, priorAttemptViolation) {
  const lines = [
    'You are fixing exactly one flagged line in a technical SDK reference doc.',
    '',
    `The line contains a banned casual/informal phrase: "${phrase}"`,
    `Guidance for this phrase: ${suggestedFix}`,
    '',
    'The guidance often carries an example in quotes or parentheses. It shows the',
    'KIND of replacement, not text to paste. Write words that fit THIS sentence.',
    'For "end-to-end" the guidance names both ends explicitly, and the example',
    '"from content migration to code rewrite" belongs to a migration guide. In a',
    'setup page the right words are "from install to first authored page", and in',
    '"an end-to-end worked example" the right edit is to drop the phrase.',
    '',
    'Full line as it currently appears in the file:',
    fullLine,
    '',
    'Rewrite the line so the flagged phrase is gone, replaced by wording that says',
    'what this particular sentence means. Dropping the phrase is often the whole fix.',
    'Keep every technical fact, identifier, inline code span, markdown link, and list',
    'marker exactly as they are. Do not change any other wording in the line.',
    '',
    'Hard constraints, this doc set enforces these separately from the rule above:',
    '- No em dash, en dash, or semicolon anywhere in the line. Use a period, comma,',
    '  parentheses, or a new sentence instead.',
    '- Do not introduce any other casual, marketing, or hedging phrase.',
    '- Keep every markdown marker exactly as it is, including the ** that opens a',
    '  bold span at the start of the line. Emphasis is not in scope for this rule.',
    '- Keep the line-start furniture byte-identical: a "> " blockquote marker, a',
    '  list marker, and any heading hashes. A line that loses its "> " falls out',
    '  of the callout it belonged to.',
    '- If the line is a table row, keep every "|" including the leading and',
    '  trailing one. A row that loses a pipe renders its values under the wrong',
    '  columns.',
    '',
    'Reply with ONLY the corrected full line. No explanation, no quotes, no markdown',
    'fences, no leading or trailing whitespace beyond what the line itself needs.',
  ];
  if (priorAttemptViolation) {
    lines.push(
      '',
      `Your previous attempt still violated a hard constraint: ${priorAttemptViolation}`,
      'Fix that specifically this time.'
    );
  }
  return lines.join('\n');
}

/**
 * Markup that must survive a wording change untouched.
 *
 * Counted, not parsed, because the rewrite is one line and a count is enough to
 * catch a dropped opener. The model returned "Repeater**: a container that..."
 * for a line that began "**Repeater**:", dropping the opening pair while
 * changing a word elsewhere on the line. Measured on the first 7 rewrites of a
 * live run: 1 of 7 unbalanced a marker, which over the 821 findings this pass
 * covers is roughly 115 corrupted lines.
 *
 * Emphasis is not in scope for any banned-phrase rule, so a changed count is
 * always damage. An odd count is worse than a changed one, since it leaks the
 * markup into the rendered page, and PR #86 spent a pass undoing exactly that
 * after a punctuation fixer moved a bracket across a boundary.
 */
const MARKUP_COUNTS = [
  { name: 'bold marker', re: /\*\*/g },
  { name: 'backtick', re: /`/g },
  { name: 'square bracket', re: /\[/g },
  { name: 'closing square bracket', re: /\]/g },
];

/**
 * The line-start furniture that says which container the line belongs to.
 *
 * A blockquote marker, a list marker, or heading hashes. None of these is a
 * word, so a word-level comparison cannot see one go missing, and none of them
 * is emphasis, so the marker counts above cannot either.
 *
 * Found the same way as everything else here: by reading the diff. The fixer
 * removed "just" from eight callout lines and returned each without its "> ",
 * so nine lines fell out of the blockquote they belonged to across eight files.
 * The prompt already said to keep list markers, and said nothing about the
 * blockquote, so the model kept one and dropped the other.
 *
 * This is invariant 8 in verify-edit-integrity.js, which exists because a
 * punctuation pass did the same thing in PR #86 and split one table into three
 * on the published site. Checking it here as well means the fixer refuses and
 * retries instead of writing the damage and relying on someone running the
 * verifier afterwards.
 */
const LIST_MARKER_RE = /^\s*(?:[-*+]|\d+[.)])\s/;
const HEADING_RE = /^\s*(#{1,6})\s/;

function findPrefixViolation(candidateLine, originalLine) {
  const quote = blockquoteProblems(originalLine, candidateLine);
  if (quote.length) return quote[0];

  // A table row's cells, through lib/table-shape.js, which PR #86 made the one
  // definition of where a cell begins and ends. Replacing "by hand" with
  // "manually" came back without the row's leading pipe, so a four-cell row
  // became three and every value in it rendered one column to the left. That is
  // the exact defect PR #86 spent a pass repairing across 27 rows.
  if (isTableRow(originalLine)) {
    const before = separatorCount(originalLine);
    const after = separatorCount(candidateLine);
    if (before !== after) {
      return `is a table row and came back with ${after} cell separators instead of ${before}`;
    }
    if (rowShapeOk(originalLine) && !rowShapeOk(candidateLine)) {
      return 'left the table row shape broken, with punctuation that does not close inside its cell';
    }
  }

  const listBefore = LIST_MARKER_RE.test(originalLine);
  const listAfter = LIST_MARKER_RE.test(candidateLine);
  if (listBefore !== listAfter) {
    return listBefore
      ? 'dropped the list marker, so the line left its list'
      : 'added a list marker the original did not have';
  }

  const hBefore = (originalLine.match(HEADING_RE) || [])[1] || '';
  const hAfter = (candidateLine.match(HEADING_RE) || [])[1] || '';
  if (hBefore !== hAfter) {
    return `changed the heading level from "${hBefore || 'none'}" to "${hAfter || 'none'}"`;
  }
  return null;
}

/**
 * An example from the guidance, pasted into the sentence verbatim.
 *
 * 22 of the 86 wordlist entries carry an example, and the prompt used to label
 * the whole hint "Suggested replacement", which invited exactly that. Four
 * lines came back carrying "from content migration to code rewrite", the
 * example attached to "end-to-end", including:
 *
 *   - You're done. Studio is wired from content migration to code rewrite.
 *   - Run Quickstart 1: Setup from content migration to code rewrite (~10-15 min).
 *
 * Neither page is about migration. The prompt now says the example shows the
 * kind of replacement rather than the text, and this refuses the reply when it
 * says otherwise, because a prompt instruction is a request and a validator is
 * a guarantee.
 *
 * Only quoted and parenthesised runs of three or more words are checked. A hint
 * offering "use" or "call" as a one-word substitute is offering exactly the
 * word to use, and pasting that is correct.
 */
const HINT_EXAMPLE_RE = /["“(]([^"”)]{12,})["”)]/g;

/** Overlapping word windows, so a paraphrase of the example is caught too. */
function windowsOf(text, size) {
  const words = String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i + size <= words.length; i++) out.push(words.slice(i, i + size).join(' '));
  return out;
}

function findPastedExample(candidateLine, originalLine, suggestedFix) {
  if (!suggestedFix) return null;
  HINT_EXAMPLE_RE.lastIndex = 0;

  for (const m of String(suggestedFix).matchAll(HINT_EXAMPLE_RE)) {
    const example = m[1].trim();
    if (example.split(/\s+/).length < 3) continue;

    // Four-word windows rather than the whole example, because the model
    // paraphrases the edges. The hint for "Some things" carries the example
    // "covers naming the profile and choosing its tools", and the reply came
    // back as "Naming the profile and choosing its tools are still better done
    // in code". An exact-substring check missed it over one leading word, and
    // the sentence it produced describes MCP profiles on a page about Studio
    // layout. Four words is long enough that ordinary English does not collide
    // with it and short enough to survive a reworded edge.
    const before = new Set(windowsOf(originalLine, 4));
    const after = new Set(windowsOf(candidateLine, 4));
    for (const w of windowsOf(example, 4)) {
      if (after.has(w) && !before.has(w)) {
        return `lifted "${w}" out of the guidance's example. The example shows the KIND of replacement, not the words, and this sentence is about something else. Say what THIS sentence means`;
      }
    }
  }
  return null;
}

/**
 * Every inline code span and link target, which must survive verbatim.
 *
 * fix-emoji-italics.js and fix-anthropomorphism.js both had this and this file
 * did not, which is how one anchor broke. Asked to remove "powerful" from
 *
 *   ## Why slots are powerful: the List + Slot pattern
 *
 * the model changed the heading to "Why slots work" and, on a different line,
 * rewrote the link pointing at it from
 * "#why-slots-are-powerful-the-list--slot-pattern" to
 * "#why-slots-pass-scope-through-the-list--slot-pattern", a slug no heading
 * produces. The prompt already said to keep markdown links exactly as they are.
 * A prompt instruction is a request. This is the guarantee.
 */
function preserved(text) {
  return [
    ...[...text.matchAll(/`[^`\n]+`/g)].map((m) => m[0]),
    ...[...text.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1]),
  ];
}

function findMarkupViolation(candidateLine, originalLine) {
  const prefix = findPrefixViolation(candidateLine, originalLine);
  if (prefix) return prefix;

  for (const piece of preserved(originalLine)) {
    if (!candidateLine.includes(piece)) {
      return `dropped or altered ${piece}, which is a code span or a link target and must survive verbatim`;
    }
  }

  for (const { name, re } of MARKUP_COUNTS) {
    const before = (originalLine.match(re) || []).length;
    const after = (candidateLine.match(re) || []).length;
    if (before !== after) {
      return `changed the ${name} count from ${before} to ${after}, and emphasis is not in scope for this rule`;
    }
  }
  return null;
}

/** Any dash/semicolon or banned-phrase violation on a single candidate line, or null if clean. */
function findLineViolation(candidateLine) {
  const probeDoc = { bodyStartLine: 1, totalLines: 1, lines: [candidateLine], inFenceMask: { 1: false } };
  if (checkEmDashSemicolon(probeDoc).length > 0) {
    return 'contains an em dash, en dash, or semicolon';
  }
  const phraseHits = checkBannedPhrases(probeDoc);
  if (phraseHits.length > 0) {
    return `contains a banned phrase (${phraseHits[0].message})`;
  }
  return null;
}

/** Ask the claude CLI, headless, for one rewritten line. Retries once if the reply violates a hard rule. */
function askForRewrite(fullLine, phrase, suggestedFix) {
  return askClaude({
    attempts: MAX_ATTEMPTS,
    timeoutMs: CLAUDE_TIMEOUT_MS,
    buildPrompt: (priorViolation) => buildPrompt(fullLine, phrase, suggestedFix, priorViolation),
    validate: (candidate) => {
      if (!candidate || candidate.includes('\n')) return 'the reply must be exactly one line of text';
      const ratio = candidate.length / Math.max(fullLine.length, 1);
      if (ratio < 0.4 || ratio > 1.6) {
        return 'the reply length looked wrong (too short or too long for a single-line fix)';
      }
      const markup = findMarkupViolation(candidate, fullLine);
      if (markup) return markup;
      const pasted = findPastedExample(candidate, fullLine, suggestedFix);
      if (pasted) return pasted;
      return findLineViolation(candidate);
    },
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: fix-banned-phrases.js <file> [--apply] [--yes] [--verify]');
    process.exit(2);
  }

  const filePath = path.resolve(args.file);
  const doc = DocModel.fromFile(filePath);

  const findings = checkBannedPhrases(doc).filter((f) => f.checkId === 'banned-phrases');
  if (findings.length === 0) {
    console.log(`No banned-phrase findings in ${args.file}.`);
    return;
  }

  console.log(
    `${findings.length} candidate(s) in ${args.file}${args.apply ? ', asking claude for rewrites' : ' (dry run, pass --apply to write and fix)'}.`
  );
  console.log('');

  const lines = doc.lines.slice();
  let changedCount = 0;

  for (const finding of findings) {
    const lineNo = finding.line;
    const originalLine = lines[lineNo - 1];
    const messageMatch = finding.message.match(/phrase "(.+?)" found\. Fix: (.+)$/);
    const phrase = messageMatch ? messageMatch[1] : null;
    const suggestedFix = messageMatch ? messageMatch[2] : null;

    console.log(`L${lineNo}: ${finding.message}`);

    if (!phrase || !suggestedFix) {
      console.log('  Skipped: could not parse finding message.');
      console.log('');
      continue;
    }

    if (!args.apply) {
      console.log('  (dry run, no rewrite requested)');
      console.log('');
      continue;
    }

    const rewritten = askForRewrite(originalLine, phrase, suggestedFix);
    if (!rewritten) {
      console.log('  Skipped: no usable rewrite returned.');
      console.log('');
      continue;
    }
    if (rewritten === originalLine) {
      console.log('  Skipped: rewrite identical to original.');
      console.log('');
      continue;
    }

    console.log(`  - ${originalLine.trim()}`);
    console.log(`  + ${rewritten.trim()}`);

    if (!args.yes && !confirmOnStdin('  Write this change? [y/N] ')) {
      console.log('  Skipped: not confirmed.');
      console.log('');
      continue;
    }

    lines[lineNo - 1] = rewritten;
    changedCount += 1;
    console.log('');
  }

  if (args.apply && changedCount > 0) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Wrote ${changedCount} rewritten line(s) to ${args.file}.`);

    if (args.verify) {
      const reDoc = DocModel.fromFile(filePath);
      const remaining = checkBannedPhrases(reDoc).filter((f) => f.checkId === 'banned-phrases');
      console.log(`Verification: ${remaining.length} banned-phrase finding(s) remain after fixing.`);
      for (const f of remaining) console.log(`  L${f.line}: ${f.message}`);
    }
  } else if (args.apply) {
    console.log('No lines were changed.');
  }
}

/** Blocking single-line stdin read for a y/n prompt. Returns true only on an explicit "y". */
function confirmOnStdin(promptText) {
  process.stdout.write(promptText);
  const buffer = Buffer.alloc(1024);
  let answer = '';
  try {
    const bytesRead = fs.readSync(0, buffer, 0, buffer.length, null);
    answer = buffer.toString('utf8', 0, bytesRead).trim().toLowerCase();
  } catch (err) {
    return false;
  }
  return answer === 'y' || answer === 'yes';
}

// Guarded, so the module can be required by a test without running the CLI.
// Every other script in this tree already does this. This one predates the
// convention and ran main() on require, which is why its guard could not be
// unit tested until now.
if (require.main === module) main();

module.exports = { findMarkupViolation, findPrefixViolation, findPastedExample, preserved, windowsOf, findLineViolation, buildPrompt };
