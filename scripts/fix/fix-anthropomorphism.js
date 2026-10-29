#!/usr/bin/env node
'use strict';

/**
 * Fixer for C3-18: a verb that gives a system component intent, knowledge or
 * perception, where the sentence never says what actually happens.
 *
 * 648 findings, the second largest tier-1 class in this corpus after casual
 * language. Four verbs carry 480 of them: "want" (61 lines), "decide" (56),
 * "see" (28) and "refuse" (17), plus a general cognition class.
 *
 * There is NO deterministic half, and that is the whole point of the rule
 * rather than a limitation of this script. "The runtime wants a locale" has no
 * mechanical replacement, because the sentence never said what the runtime
 * does when it has no locale. The fix is to state the mechanism, which is
 * information the line does not carry:
 *
 *   "a disabled profile advertises zero tools"
 *     -> "a disabled profile returns an empty tool list"
 *   "Studio decides which template to use"
 *     -> "Studio matches the URL against each template's pattern, longest first"
 *   "the SDK sees the composition"
 *     -> "the SDK receives the composition in the fetch response"
 *
 * Each needed a different fact, and none of the three is derivable from the
 * words on the line. So every finding goes to the model, one line at a time,
 * with the surrounding paragraph supplied as context because that is usually
 * where the mechanism is already stated. A batch would lose that context, and a
 * fix invented without it is a fix that states something false.
 *
 * The reply is checked against the rule that produced the finding, so a rewrite
 * that swaps one intentional verb for another is rejected and re-prompted
 * rather than written to disk.
 *
 * Usage:
 *   node fix/fix-anthropomorphism.js <file|dir>... --report
 *   node fix/fix-anthropomorphism.js <file|dir>... --apply [--max-calls=N]
 */

const fs = require('fs');
const path = require('path');

const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { collectDocs } = require('../lint/sweep-docs');
const { maskProse } = require('../lib/prose-mask');
const { checkAnthropomorphism } = require('../checks/anthropomorphism');
const { checkEmDashSemicolon } = require('../checks/em-dash-semicolon');
const { checkBannedPhrases } = require('../checks/banned-phrases');
const { isTableRow, separatorCount, rowShapeOk } = require('../lib/table-shape');
const { findPrefixViolation, findMarkupViolation } = require('./fix-banned-phrases');
const { byId } = require('../lib/rules-registry');

const CLAUDE_TIMEOUT_MS = 180000;

/** How many lines either side of the finding go into the prompt as context. */
const CONTEXT_LINES = 6;

/** A one-line probe document, the shape every check in this tree accepts. */
function probeOf(line) {
  return { bodyStartLine: 1, totalLines: 1, lines: [line], inFenceMask: { 1: false } };
}

/**
 * The paragraph around the finding, which is where the mechanism usually is.
 *
 * "Studio decides which template to use" is unfixable on its own. Two lines
 * below it the page often already says "the longest matching URL pattern wins",
 * and that sentence is the fix. Supplying it is the difference between a
 * rewrite that states the mechanism and one that invents a plausible-sounding
 * mechanism that is not true.
 */
function contextAround(doc, lineNo) {
  const from = Math.max(doc.bodyStartLine, lineNo - CONTEXT_LINES);
  const to = Math.min(doc.totalLines, lineNo + CONTEXT_LINES);
  const out = [];
  for (let l = from; l <= to; l++) {
    out.push(`${l === lineNo ? '>>' : '  '} ${doc.lines[l - 1]}`);
  }
  return out.join('\n');
}

function buildPrompt(item, priorViolation) {
  const rule = byId('C3-18');
  const lines = [
    'You are fixing exactly one line in a technical documentation set.',
    '',
    `Rule (C3-18): ${rule ? rule.rule : 'Do not attribute intent, knowledge, perception, or volition to a system component. Name the mechanism instead.'}`,
    `Exception: ${rule ? rule.exception : ''}`,
    '',
    `What the checker flagged: ${item.message}`,
    '',
    'The line, marked >>, with the paragraph around it:',
    item.context,
    '',
    'Rewrite ONLY the marked line so it names the mechanism rather than an intent.',
    '',
    'How to do it:',
    '- Say what the component DOES, or what it RETURNS, or what CONDITION holds.',
    '  "a disabled profile advertises zero tools" becomes',
    '  "a disabled profile returns an empty tool list".',
    '  "Studio decides which template to use" becomes',
    '  "Studio matches the URL against each template pattern, longest first".',
    '- The surrounding lines above often already state the mechanism. Use what is',
    '  there. If they do not, and you would have to invent a fact to name a',
    '  mechanism, reply with the line UNCHANGED instead. An invented mechanism in',
    '  documentation is worse than an anthropomorphic verb.',
    '',
    'Rules you must not break:',
    '- Return the COMPLETE marked line, from its first character to its last,',
    '  including any heading hashes, list marker, blockquote marker, table pipes,',
    '  or leading whitespace. Do not include the ">>" marker.',
    '- Keep the number of table cell separators ("|") exactly as it is.',
    '- Never change text inside backticks or inside a link target.',
    '- Keep every identifier, parameter name, flag, URL, file path and version',
    '  number byte-identical.',
    '- Do not introduce an em dash, en dash or semicolon. Use a period, comma,',
    '  parentheses, or a colon.',
    '- Do not introduce a casual or marketing phrase.',
    '- Keep the line-start furniture byte-identical: a "> " blockquote marker, a',
    '  list marker, heading hashes, and a table row\'s leading and trailing pipe.',
    '- Keep the bold markers exactly as they are. Emphasis is not in scope here.',
    '- Do not swap one intentional verb for another. "wants" to "expects" and',
    '  "decides" to "chooses" both fail this rule.',
    '',
    'Reply with ONLY the corrected line. No explanation, no quotes, no fence.',
  ];
  if (priorViolation) {
    lines.push('', `Your previous reply was rejected: ${priorViolation}`, 'Fix that specifically this time.');
  }
  return lines.join('\n');
}

/** Every inline code span and link target, which must survive verbatim. */
function preserved(text) {
  return [
    ...[...text.matchAll(/`[^`\n]+`/g)].map((m) => m[0]),
    ...[...text.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1]),
  ];
}

function findViolation(candidate, item) {
  if (!candidate || candidate.includes('\n')) return 'the reply must be exactly one line of text';

  // The container and the markup FIRST, reusing the guards fix-banned-phrases
  // grew the hard way rather than writing a third copy. Six times today a fixer
  // validated what its own rule cared about and nothing about what it had to
  // leave alone: a blockquote marker, a list marker, a table row's leading
  // pipe, a bold pair. This one is checked before it runs at scale rather than
  // after, which is the only difference.
  const prefix = findPrefixViolation(candidate, item.text);
  if (prefix) return prefix;
  const markup = findMarkupViolation(candidate, item.text);
  if (markup) return markup;

  const probe = probeOf(candidate);
  if (checkAnthropomorphism(probe).length) {
    return 'still attributes intent to a component. Name what it does, returns, or requires';
  }
  if (checkEmDashSemicolon(probe).length) return 'contains an em dash, en dash or semicolon';
  const banned = checkBannedPhrases(probe);
  if (banned.length) return `introduced a banned phrase (${banned[0].message})`;

  for (const piece of preserved(item.text)) {
    if (!candidate.includes(piece)) return `dropped ${piece}, which must survive verbatim`;
  }
  if (isTableRow(item.text)) {
    if (separatorCount(candidate) !== separatorCount(item.text)) {
      return `is a table row and came back with ${separatorCount(candidate)} separators instead of ${separatorCount(item.text)}`;
    }
    if (rowShapeOk(item.text) && !rowShapeOk(candidate)) return 'left the row shape broken';
  }
  const ratio = candidate.length / Math.max(item.text.length, 1);
  if (ratio < 0.4 || ratio > 2.0) return 'the reply length looked wrong for a single-line fix';
  return null;
}

/**
 * Every C3-18 finding in the file, in reverse line order.
 *
 * Reverse, so an accepted rewrite on line 80 cannot invalidate the line number
 * recorded for a finding on line 40. The check is not re-run per edit the way
 * fix-acronym-first-use.js does, because C3-18 reports every occurrence rather
 * than only the first, so the finding list is stable under an edit to a
 * different line.
 */
function planFile(filePath) {
  const doc = DocModel.fromFile(filePath);
  const findings = checkAnthropomorphism(doc)
    .filter((f) => f.line)
    .sort((a, b) => b.line - a.line);

  return {
    doc,
    lines: doc.lines.slice(),
    items: findings.map((f) => ({
      lineNo: f.line,
      message: f.message,
      text: doc.lines[f.line - 1],
      context: contextAround(doc, f.line),
    })),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { targets: [], apply: false, report: false, maxCalls: Infinity };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--report') args.report = true;
    else if (arg.startsWith('--max-calls=')) args.maxCalls = parseInt(arg.slice('--max-calls='.length), 10);
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.targets.length) {
    console.error('Usage: fix-anthropomorphism.js <file|dir>... [--report] [--apply] [--max-calls=N]');
    process.exit(2);
  }

  const files = [...new Set(args.targets.flatMap((t) => collectDocs(path.resolve(t))))].sort();
  let calls = 0;
  let fixed = 0;
  let unchanged = 0;
  let refused = 0;
  let flagged = 0;

  for (const file of files) {
    const { lines, items } = planFile(file);
    if (!items.length) continue;
    flagged += items.length;

    if (args.report) {
      console.log(`\n${path.relative(process.cwd(), file)}  ${items.length} finding(s)`);
      for (const item of items.slice(0, 4)) {
        console.log(`  ${item.lineNo}  ${item.text.trim().slice(0, 120)}`);
      }
      continue;
    }

    let changed = false;
    for (const item of items) {
      if (calls >= args.maxCalls) break;
      calls += 1;
      const reply = askClaude({
        timeoutMs: CLAUDE_TIMEOUT_MS,
        buildPrompt: (prior) => buildPrompt(item, prior),
        validate: (candidate) => findViolation(candidate, item),
      });
      if (!reply) {
        refused += 1;
        continue;
      }
      if (reply === item.text) {
        unchanged += 1;
        continue;
      }
      lines[item.lineNo - 1] = reply;
      changed = true;
      fixed += 1;
    }

    if (changed && args.apply) fs.writeFileSync(file, lines.join('\n'));
    if (changed) console.log(`  ${path.relative(process.cwd(), file)}: ${fixed} so far, ${calls} calls`);
  }

  console.log(`\nmode              ${args.report ? 'report' : args.apply ? 'apply' : 'dry run'}`);
  console.log(`findings          ${flagged}`);
  if (!args.report) {
    console.log(`rewritten         ${fixed}`);
    console.log(`left unchanged    ${unchanged}  (the model would have had to invent a mechanism)`);
    console.log(`refused           ${refused}  (no reply passed the constraints)`);
    console.log(`model calls       ${calls}`);
  }
}

if (require.main === module) main();

module.exports = { planFile, buildPrompt, findViolation, contextAround, probeOf, CONTEXT_LINES };
