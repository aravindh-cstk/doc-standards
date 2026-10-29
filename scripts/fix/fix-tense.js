#!/usr/bin/env node
'use strict';

/**
 * Agentic fixer for present-continuous (C3-19) findings.
 *
 * present-continuous.js only IDENTIFIES the construction. Swapping "is holding"
 * for "holds" mechanically breaks agreement about half the time, and the fix
 * often needs the actor promoted into the subject, so this script shells out to
 * the `claude` CLI in headless print mode once per flagged line.
 *
 * Only C3-19 is in scope. The gerund-subject rule (C3-20) is tier 3 and already
 * gets a proposed rewrite from `review-candidates.js --judge`, so fixing it here
 * too would give one sentence two competing fixers.
 *
 * Defaults to a dry run that prints proposed before/after pairs. Nothing is
 * written to disk unless --apply is passed.
 *
 * Usage:
 *   node fix/fix-tense.js <file> [--apply] [--yes] [--verify]
 */

const path = require('path');
const fs = require('fs');
const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { checkPresentContinuous } = require('../checks/present-continuous');
const { checkBannedPhrases } = require('../checks/banned-phrases');

const CLAUDE_TIMEOUT_MS = 120000;
const MAX_ATTEMPTS = 2;
const DASH_SEMI_RE = /[—–;]/;

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

function buildPrompt(fullLine, construction, priorAttemptViolation) {
  const lines = [
    'You are fixing exactly one flagged line in a technical documentation page.',
    '',
    `The line uses present continuous as the main verb: "${construction}"`,
    '',
    'Full line as it currently appears in the file:',
    fullLine,
    '',
    'Rewrite the line in simple present tense. Name the actor and give it the verb,',
    'so "the client is holding a stale token" becomes "the client holds a stale token"',
    'and "confirm calls are landing" becomes "confirm calls reach Contentstack".',
    'Keep every technical fact, identifier, inline code span, markdown link, bold span,',
    'and list or table marker exactly as they are. Do not change any other wording.',
    '',
    'Reply with the COMPLETE line, from its first character to its last. That includes',
    'any list marker ("- ", "1. "), any bold label ("**Root Cause**: "), and every',
    'clause before and after the part you changed. Returning only the fragment you',
    'rewrote silently deletes the rest of the line from the file.',
    '',
    'Hard constraints, this doc set enforces these separately from the rule above:',
    '- No em dash, en dash, or semicolon anywhere in the line. Use a period, comma,',
    '  parentheses, or a new sentence instead.',
    '- Active voice. Do not trade the continuous tense for a passive construction.',
    '- No casual, marketing, or hedging phrases.',
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
 * The leading markers a rewrite must carry through: a list bullet, an ordered
 * step number, and a bold label such as "**Root Cause**: ".
 *
 * A model told to rewrite a line tends to reply with the clause it changed and
 * drop the scaffolding around it. Writing that back deletes a list marker or a
 * troubleshooting label, which reads as a formatting bug far from the sentence
 * that caused it.
 */
function structuralPrefix(line) {
  const match = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)?(\*\*[^*]+\*\*:?\s*)?/);
  return match ? `${match[1] || ''}${match[2] || ''}` : '';
}

/** Any hard-rule violation on a single candidate line, or null if clean. */
function findLineViolation(candidateLine) {
  if (DASH_SEMI_RE.test(candidateLine.replace(/`[^`]*`/g, ''))) {
    return 'contains an em dash, en dash, or semicolon';
  }
  const probeDoc = { bodyStartLine: 1, totalLines: 1, lines: [candidateLine], inFenceMask: { 1: false } };
  // The rewrite has to actually remove the defect. A fixer that hands back the
  // same construction is worse than one that skips, because the diff looks like
  // progress.
  const stillContinuous = checkPresentContinuous(probeDoc);
  if (stillContinuous.length > 0) {
    return `still uses present continuous (${stillContinuous[0].message})`;
  }
  const phraseHits = checkBannedPhrases(probeDoc);
  if (phraseHits.length > 0) {
    return `contains a banned phrase (${phraseHits[0].message})`;
  }
  return null;
}

/** Ask the claude CLI, headless, for one rewritten line. Retries once if the reply violates a hard rule. */
function askForRewrite(fullLine, construction) {
  return askClaude({
    attempts: MAX_ATTEMPTS,
    timeoutMs: CLAUDE_TIMEOUT_MS,
    buildPrompt: (priorViolation) => buildPrompt(fullLine, construction, priorViolation),
    validate: (candidate) => {
      if (!candidate || candidate.includes('\n')) return 'the reply must be exactly one line of text';
      const prefix = structuralPrefix(fullLine);
      if (prefix.trim() && !candidate.startsWith(prefix)) {
        return `the reply dropped the line's leading "${prefix.trim()}". Return the complete line, including its marker or label`;
      }
      // A tense fix changes a verb, so the line barely changes length. A reply
      // much shorter than the original is a fragment, not a rewrite.
      const ratio = candidate.length / Math.max(fullLine.length, 1);
      if (ratio < 0.8 || ratio > 1.4) {
        return 'the reply length looked wrong, which usually means it returned only the clause it changed instead of the complete line';
      }
      return findLineViolation(candidate);
    },
  });
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: fix-tense.js <file> [--apply] [--yes] [--verify]');
    process.exit(2);
  }

  const filePath = path.resolve(args.file);
  const doc = DocModel.fromFile(filePath);

  const findings = checkPresentContinuous(doc);
  if (findings.length === 0) {
    console.log(`No present-continuous findings in ${args.file}.`);
    return;
  }

  console.log(
    `${findings.length} candidate(s) in ${args.file}${args.apply ? ', asking claude for rewrites' : ' (dry run, pass --apply to write and fix)'}.`
  );
  console.log('');

  const lines = doc.lines.slice();
  let changedCount = 0;

  // Findings are per match, so one line carrying two constructions appears
  // twice. Fixing it once removes both.
  const seenLines = new Set();

  for (const finding of findings) {
    const lineNo = finding.line;
    if (seenLines.has(lineNo)) continue;
    seenLines.add(lineNo);

    const originalLine = lines[lineNo - 1];
    const messageMatch = finding.message.match(/Present continuous: "(.+?)"\./);
    const construction = messageMatch ? messageMatch[1] : null;

    console.log(`L${lineNo}: ${finding.message}`);

    if (!construction) {
      console.log('  Skipped: could not parse finding message.');
      console.log('');
      continue;
    }

    if (!args.apply) {
      console.log('  (dry run, no rewrite requested)');
      console.log('');
      continue;
    }

    const rewritten = askForRewrite(originalLine, construction);
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
      const remaining = checkPresentContinuous(reDoc);
      console.log(`Verification: ${remaining.length} present-continuous finding(s) remain after fixing.`);
      for (const f of remaining) console.log(`  L${f.line}: ${f.message}`);
    }
  } else if (args.apply) {
    console.log('No lines were changed.');
  }
}

main();
