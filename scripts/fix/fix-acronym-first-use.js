#!/usr/bin/env node
'use strict';

/**
 * Fixer for C8-07: expand a closed-list acronym at its first bare use.
 *
 * 533 findings across the corpus, 155 of them on published pages, and 40 are
 * SSR alone. The rule is per document and per acronym, so the edit is one line
 * per acronym per file: the FIRST bare use becomes "server-side rendering
 * (SSR)" and every later use stays as it is. Doing it by hand means opening
 * 250 files to change one word in each.
 *
 * Mostly deterministic, unlike the other fixers here, and the reason is that
 * the replacement is a lookup rather than a judgment. What is NOT deterministic
 * is where in the line the expansion belongs, and the corpus supplies four
 * shapes where a naive splice produces nonsense:
 *
 *   A heading. "## SSR streaming patterns" must not become "## Server-side
 *   rendering (SSR) streaming patterns" if the page's own H1 already carries
 *   the expansion, and a heading is a label rather than a sentence.
 *
 *   A table cell. Expanding inside a cell widens a column and can push the row
 *   past what the renderer lays out, and the cell often has no room for a
 *   parenthetical.
 *
 *   An acronym that is part of a longer name. "CDA host", "the CMA credential",
 *   "OAuth Bearer" all read correctly expanded. "CI/CD" does not: expanding one
 *   half leaves "continuous integration (CI)/CD".
 *
 *   A line where the acronym appears inside a link label or an identifier that
 *   happens not to be in backticks.
 *
 * So the deterministic pass takes the plain-prose case, the model takes the
 * rest, and --report says which is which before anything is written.
 *
 * Usage:
 *   node fix/fix-acronym-first-use.js <file|dir>... --report
 *   node fix/fix-acronym-first-use.js <file|dir>... --apply
 *   node fix/fix-acronym-first-use.js <file|dir>... --apply --llm [--max-calls=N]
 */

const fs = require('fs');
const path = require('path');

const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { collectDocs } = require('../sweep-docs');
const { maskProse } = require('../lib/prose-mask');
const { checkAcronymFirstUse } = require('../checks/acronym-first-use');
const { isTableRow, separatorCount, rowShapeOk } = require('../lib/table-shape');
const { findPrefixViolation, findMarkupViolation } = require('./fix-banned-phrases');
const acronymData = require('../data/acronyms.json');

const EXPANSIONS = new Map(acronymData.acronyms.map((a) => [a.acronym, a.expansion]));

/**
 * Acronyms that reach a reader as a compound, where expanding one half leaves
 * the other bare.
 *
 * "CI/CD" is the whole class in this corpus, and it is why the deterministic
 * pass refuses any line where the acronym is adjacent to a slash.
 */
const COMPOUND_RE = /[\/-]/;

/** Capitalises the expansion when it opens a sentence, and not otherwise. */
function casedExpansion(expansion, line, index) {
  const before = line.slice(0, index).replace(/[`*_>#\-\s]/g, '');
  const opensSentence = before === '' || /[.!?:]$/.test(before);
  if (!opensSentence) return expansion;
  return expansion.charAt(0).toUpperCase() + expansion.slice(1);
}

/**
 * The line with the first bare use expanded, or null when this line is one of
 * the shapes a splice gets wrong.
 *
 * Returns a reason alongside the null so --report can say why a line went to
 * the model rather than leaving a reviewer to guess.
 */
function expandOnLine(line, acronym) {
  const expansion = EXPANSIONS.get(acronym);
  if (!expansion) return { line: null, why: `no expansion recorded for ${acronym}` };

  // Located in the mask, so an acronym inside a code span, a link target or an
  // HTML attribute is not the first bare use and must not be touched.
  const masked = maskProse(line);
  const re = new RegExp(`\\b${acronym}\\b`, 'g');
  const m = re.exec(masked);
  if (!m) return { line: null, why: 'the acronym is inside code or a link target' };

  if (/^\s*#{1,6}\s/.test(line)) {
    return { line: null, why: 'a heading is a label, and an expansion there reads as a different title' };
  }
  if (isTableRow(line)) {
    return { line: null, why: 'a table cell has no room for a parenthetical' };
  }
  const neighbourhood = line.slice(Math.max(0, m.index - 1), m.index + acronym.length + 1);
  if (COMPOUND_RE.test(neighbourhood.replace(acronym, ''))) {
    return { line: null, why: 'the acronym is half of a compound such as CI/CD' };
  }
  // Inside a link label, expanding changes what the link claims to point at.
  const beforeIdx = line.slice(0, m.index);
  if ((beforeIdx.split('[').length - 1) > (beforeIdx.split(']').length - 1)) {
    return { line: null, why: 'the acronym sits inside a link label' };
  }

  // Inside a parenthetical, because the expansion brings its own parentheses
  // and the result nests. "(CSR vs SSR, App Router vs Pages Router)" became
  // "(client-side rendering (CSR) vs server-side rendering (SSR), App Router
  // ...)", which a reader has to parse twice. The line needs rewording, not
  // splicing, so it goes to the model.
  if ((beforeIdx.split('(').length - 1) > (beforeIdx.split(')').length - 1)) {
    return { line: null, why: 'the acronym sits inside a parenthetical, where the expansion would nest' };
  }

  const replacement = `${casedExpansion(expansion, line, m.index)} (${acronym})`;
  const out = line.slice(0, m.index) + replacement + line.slice(m.index + acronym.length);
  return { line: out, why: null };
}

/**
 * Every C8-07 finding in the file, paired with the line it names and a proposed
 * edit.
 *
 * The check is re-run after each accepted edit rather than once up front,
 * because expanding SSR on line 12 can satisfy nothing else but expanding CDA
 * on line 12 changes that line's offsets for the CMA finding on the same line.
 * Running once and applying a batch of offsets against a shifting line is how a
 * fixer corrupts a file.
 */
function planFile(filePath) {
  let doc = DocModel.fromFile(filePath);
  const lines = doc.lines.slice();
  const applied = [];
  const pending = [];

  for (let pass = 0; pass < EXPANSIONS.size + 1; pass++) {
    const model = new DocModel(filePath, lines.join('\n'));
    const findings = checkAcronymFirstUse(model).filter(
      (f) => !pending.some((p) => p.message === f.message)
    );
    if (!findings.length) break;

    let progressed = false;
    for (const finding of findings) {
      const acronym = (finding.message.match(/Acronym "([^"]+)"/) || [])[1];
      const lineNo = finding.line;
      const raw = lines[lineNo - 1];
      const { line: fixed, why } = expandOnLine(raw, acronym);

      if (!fixed) {
        pending.push({ lineNo, acronym, text: raw, why, message: finding.message });
        continue;
      }
      lines[lineNo - 1] = fixed;
      applied.push({ lineNo, acronym, before: raw, after: fixed });
      progressed = true;
      break;
    }
    if (!progressed) break;
  }

  return { doc, lines, applied, pending };
}

// ---------------------------------------------------------------------------
// Model pass, for the shapes a splice gets wrong
// ---------------------------------------------------------------------------

function buildPrompt(item, priorViolation) {
  const expansion = EXPANSIONS.get(item.acronym);
  const lines = [
    'You are editing one line of technical documentation.',
    '',
    `This document uses the acronym "${item.acronym}" without ever expanding it.`,
    `House style requires the full form at first use: "${expansion} (${item.acronym})".`,
    `A deterministic splice was refused here because ${item.why}.`,
    '',
    'The line:',
    item.text,
    '',
    'Rewrite the line so a reader meets the full form. Rules you must not break:',
    '- Return the COMPLETE line, from its first character to its last, including any',
    '  heading hashes, list marker, blockquote marker, table pipes, or leading whitespace.',
    '- Keep the number of table cell separators ("|") exactly as it is.',
    '- Never change text inside backticks or inside a link target. Leave those byte-identical.',
    '- Keep every identifier, parameter name, flag, URL, file path and version number byte-identical.',
    `- Do not expand any acronym other than ${item.acronym}.`,
    '- Do not reword anything the expansion does not require.',
    '- Never put a parenthesis inside a parenthesis. The full form brings its own,',
    '  so if the acronym sits inside a parenthetical, restructure the clause: turn',
    '  it into a colon list, or move the expansion outside the brackets.',
    '- Do not introduce an em dash, en dash or semicolon.',
    '- Keep the line-start furniture byte-identical: a "> " blockquote marker, a',
    '  list marker, heading hashes, and a table row\'s leading and trailing pipe.',
    '- Keep the bold markers exactly as they are. Emphasis is not in scope here.',
    '- If the line genuinely cannot carry the expansion (a heading that would become a',
    '  different title, a cell with no room), reply with the line UNCHANGED and nothing else.',
    '',
    'Reply with the corrected line and nothing else. No explanation, no markdown fence.',
  ];
  if (priorViolation) {
    lines.push('', `Your previous reply was rejected: ${priorViolation}`, 'Fix that specifically.');
  }
  return lines.join('\n');
}

/** The deepest run of open parentheses on a line, ignoring code spans. */
function maxParenDepth(line) {
  const masked = maskProse(line);
  let depth = 0;
  let max = 0;
  for (const ch of masked) {
    if (ch === '(') max = Math.max(max, ++depth);
    else if (ch === ')') depth = Math.max(0, depth - 1);
  }
  return max;
}

/** Every inline code span and link target, which must survive verbatim. */
function preserved(text) {
  return [
    ...[...text.matchAll(/`[^`\n]+`/g)].map((m) => m[0]),
    ...[...text.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1]),
  ];
}

function findViolation(text, item) {
  // The container and the markup first, reusing the guards the other fixers
  // grew the hard way. Seven times today a fixer validated what its own rule
  // cared about and nothing about what it had to leave alone.
  const prefix = findPrefixViolation(text, item.text);
  if (prefix) return prefix;
  const markup = findMarkupViolation(text, item.text);
  if (markup) return markup;

  if (/[—–;]/.test(maskProse(text))) return 'introduced an em dash, en dash or semicolon';

  // Nested parentheses, which is what an expansion produces when the acronym
  // already sits inside one. The deterministic half refuses that shape for
  // exactly this reason, and the model produced it anyway on the first live
  // call: "every trade-off (CSR vs SSR, App Router vs Pages Router)" came back
  // as "(client-side rendering (CSR) vs SSR, App Router ...)", which a reader
  // has to parse twice and which leaves SSR unexpanded beside it. The line
  // needs rewording, so refusing sends it back for one.
  if (maxParenDepth(text) > Math.max(1, maxParenDepth(item.text))) {
    return 'nested one parenthesis inside another. Reword the clause so the full form sits outside the parentheses, or restructure it as a colon list';
  }
  for (const piece of preserved(item.text)) {
    if (!text.includes(piece)) return `dropped ${piece}, which must survive verbatim`;
  }
  if (isTableRow(item.text)) {
    if (separatorCount(text) !== separatorCount(item.text)) {
      return `is a table row and came back with ${separatorCount(text)} separators instead of ${separatorCount(item.text)}`;
    }
    if (rowShapeOk(item.text) && !rowShapeOk(text)) return 'left the row shape broken';
  }
  return null;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { targets: [], apply: false, report: false, llm: false, maxCalls: Infinity };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--report') args.report = true;
    else if (arg === '--llm') args.llm = true;
    else if (arg.startsWith('--max-calls=')) args.maxCalls = parseInt(arg.slice('--max-calls='.length), 10);
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.targets.length) {
    console.error('Usage: fix-acronym-first-use.js <file|dir>... [--report] [--apply] [--llm] [--max-calls=N]');
    process.exit(2);
  }

  const files = [...new Set(args.targets.flatMap((t) => collectDocs(path.resolve(t))))].sort();
  let totalApplied = 0;
  let totalPending = 0;
  let calls = 0;
  const filesTouched = [];
  const reasons = {};

  for (const file of files) {
    const { lines, applied, pending } = planFile(file);
    let working = lines;

    if (args.llm) {
      for (const item of pending.slice()) {
        if (calls >= args.maxCalls) break;
        calls += 1;
        const reply = askClaude({
          buildPrompt: (prior) => buildPrompt(item, prior),
          validate: (text) => findViolation(text, item),
        });
        if (!reply || reply === item.text) continue;
        working[item.lineNo - 1] = reply;
        applied.push({ lineNo: item.lineNo, acronym: item.acronym, before: item.text, after: reply, viaModel: true });
        pending.splice(pending.indexOf(item), 1);
      }
    }

    for (const p of pending) reasons[p.why] = (reasons[p.why] || 0) + 1;
    totalApplied += applied.length;
    totalPending += pending.length;

    if (applied.length) {
      filesTouched.push({ file, applied, pending });
      if (args.apply) fs.writeFileSync(file, working.join('\n'));
    } else if (pending.length) {
      filesTouched.push({ file, applied, pending });
    }
  }

  console.log(`mode              ${args.apply ? 'apply' : 'dry run'}${args.llm ? ' + model' : ''}`);
  console.log(`files with issues ${filesTouched.length}`);
  console.log(`expanded          ${totalApplied}`);
  console.log(`left for a human  ${totalPending}`);
  if (calls) console.log(`model calls       ${calls}`);

  if (Object.keys(reasons).length) {
    console.log('\nwhy a line was left:');
    for (const [why, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}  ${why}`);
    }
  }

  if (args.report) {
    console.log('\nproposed edits:');
    for (const f of filesTouched.slice(0, 40)) {
      for (const a of f.applied.slice(0, 3)) {
        console.log(`  ${path.relative(process.cwd(), f.file)}:${a.lineNo}  [${a.acronym}]`);
        console.log(`    - ${a.before.trim().slice(0, 120)}`);
        console.log(`    + ${a.after.trim().slice(0, 120)}`);
      }
    }
  }
}

if (require.main === module) main();

module.exports = { expandOnLine, planFile, casedExpansion, buildPrompt, findViolation, maxParenDepth, EXPANSIONS };
