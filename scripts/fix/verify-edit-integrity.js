#!/usr/bin/env node
'use strict';

/**
 * Prove that a corpus-wide punctuation pass changed punctuation and nothing else.
 *
 * The C3-05 pass rewrites thousands of lines. `--report` showing zero remaining
 * findings only proves the dashes are gone. It says nothing about whether a
 * sentence, a table row, a code sample or a link survived, and the failure mode
 * that matters here is a rewrite that quietly drops content, because the diff
 * still looks like the work getting done.
 *
 * So this checks invariants that a punctuation edit must hold and a content loss
 * must break, comparing the working tree against a git ref:
 *
 *   1. Line count is identical. Lines are rewritten in place, never added or
 *      removed, so any change here is content appearing or vanishing.
 *   2. Every fenced code block is byte-identical. Code is never in scope.
 *   3. Every inline code span survives, as a multiset.
 *   4. Every link and image target survives, as a multiset.
 *   5. No line became empty, and no empty line gained content.
 *   6. The word sequence, ignoring the banned punctuation and case, is
 *      preserved to within a small edit budget per line. Replacing a dash with
 *      "to", or splitting a clause into a sentence, moves a word or two. Losing
 *      half a sentence does not.
 *   7. A table row keeps its cell separators, and a row whose cells were
 *      structurally balanced still is.
 *   8. A line keeps its blockquote depth, so it cannot fall out of the callout
 *      or quoted block it belonged to.
 *
 * Invariant 7 was added after the six above passed a real corruption. The
 * paired-dash rule turned
 *   | Does it render multiple things AND arrange them? | **Compound — decompose** | — |
 * into
 *   | Does it render multiple things AND arrange them? | **Compound (decompose** |) |
 * moving the closing paren into a new cell. Invariant 1 held, the line count
 * was unchanged. Invariant 6 held too, and that is the instructive part:
 * `words()` strips `*`, `(` and `)` along with the banned punctuation, so both
 * versions reduced to the same word list and the distance was zero. The damage
 * was made of exactly the characters the comparison was throwing away.
 *
 * Usage:
 *   node fix/verify-edit-integrity.js <dir> [--ref=HEAD] [--budget=4] [--verbose]
 *
 * Exit code 1 on any violation.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { collectDocs } = require('../sweep-docs');
const { isTableRow, separatorCount, rowShapeOk, rowShapeProblems } = require('../lib/table-shape');

const BANNED = /[—–;]/g;

function gitShow(repoRoot, ref, relPath) {
  try {
    return execFileSync('git', ['show', `${ref}:${relPath}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null; // new file, not in the ref
  }
}

function repoRootFor(target) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: fs.statSync(target).isDirectory() ? target : path.dirname(target),
    encoding: 'utf8',
  }).trim();
}

/** Fenced code blocks, in order, as raw text. */
function fences(text) {
  const out = [];
  let current = null;
  for (const line of text.split('\n')) {
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence && current === null) {
      current = [];
      continue;
    }
    if (fence && current !== null) {
      out.push(current.join('\n'));
      current = null;
      continue;
    }
    if (current !== null) current.push(line);
  }
  // An unterminated fence still counts, so a dropped closing fence is visible.
  if (current !== null) out.push(current.join('\n'));
  return out;
}

function multiset(items) {
  const m = new Map();
  for (const i of items) m.set(i, (m.get(i) || 0) + 1);
  return m;
}

function multisetDiff(before, after) {
  const missing = [];
  for (const [k, n] of before) {
    const got = after.get(k) || 0;
    if (got < n) missing.push({ item: k, before: n, after: got });
  }
  return missing;
}

function inlineCode(text) {
  return [...text.matchAll(/`[^`\n]+`/g)].map((m) => m[0]);
}

/**
 * Link targets with the #fragment stripped.
 *
 * The anchor repair that follows a punctuation pass rewrites fragments on
 * purpose, because renaming a heading renames its anchor. Comparing full
 * targets reported all 59 of those repairs as lost links, which is the repair
 * working, not content going missing. The path is what has to survive.
 *
 * Fragments are still checked, by repair-anchors.js --audit, which resolves
 * every anchor against the headings that actually exist.
 */
function linkTargets(text) {
  return [...text.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1].split('#')[0]).filter(Boolean);
}

/**
 * What a punctuation edit did to a table row's shape.
 *
 * Only reports a row that was intact and is not any more. Plenty of rows in
 * this corpus were already broken before the pass, and reporting those as
 * regressions would bury the ones the pass caused.
 */
/**
 * A lost blockquote prefix, which breaks the block the line belonged to.
 *
 * Found the same way as the other two: by a page rendering wrong. A callout in
 * 32-sections/overview.md is a blockquote holding a table, and the punctuation
 * pass rewrote one row without its `> `. The row fell out of the quote and
 * split one table into three, so the "extra knowledge" table rendered as a
 * one-row table, a stray table, then a two-row table.
 *
 * Invariant 6 could not see it: `words()` compares word sequences and `>` is
 * not a word. Neither could invariant 7, since the row's cells were intact.
 */
function blockquoteProblems(before, after) {
  const depth = (line) => {
    const m = line.match(/^(?:\s*>)+/);
    return m ? (m[0].match(/>/g) || []).length : 0;
  };
  const b = depth(before);
  const a = depth(after);
  if (b === a) return [];
  return [`blockquote depth went from ${b} to ${a}, so the line left the block it belonged to`];
}

function tableShapeProblems(before, after) {
  if (!isTableRow(before) && !isTableRow(after)) return [];
  const problems = [];

  const sepBefore = separatorCount(before);
  const sepAfter = separatorCount(after);
  if (sepBefore !== sepAfter) {
    problems.push(`table row cell separators went from ${sepBefore} to ${sepAfter}`);
  }

  if (rowShapeOk(before) && !rowShapeOk(after)) {
    const detail = rowShapeProblems(after)
      .map((p) => `cell ${p.cell} has ${p.problem}`)
      .join(', ');
    problems.push(`table row cells were balanced and now are not: ${detail}`);
  }

  return problems;
}

/** Words with the banned punctuation and case removed, so a swap is invisible here. */
function words(line) {
  return line
    .replace(BANNED, ' ')
    .toLowerCase()
    .replace(/[()[\]{}.,:!?"'*`]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Levenshtein distance over word arrays, capped so a big diff exits early. */
function wordDistance(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      if (row[j] < best) best = row[j];
    }
    if (best > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length];
}

function checkFile(relPath, before, after, budget) {
  const problems = [];
  const bl = before.split('\n');
  const al = after.split('\n');

  if (bl.length !== al.length) {
    problems.push(`line count changed: ${bl.length} to ${al.length}`);
    return problems; // per-line checks are meaningless once alignment is lost
  }

  const bf = fences(before);
  const af = fences(after);
  if (bf.length !== af.length) {
    problems.push(`code fence count changed: ${bf.length} to ${af.length}`);
  } else {
    for (let i = 0; i < bf.length; i++) {
      if (bf[i] !== af[i]) problems.push(`code fence ${i + 1} was modified`);
    }
  }

  for (const m of multisetDiff(multiset(inlineCode(before)), multiset(inlineCode(after)))) {
    problems.push(`inline code lost: ${m.item} (${m.before} to ${m.after})`);
  }
  for (const m of multisetDiff(multiset(linkTargets(before)), multiset(linkTargets(after)))) {
    problems.push(`link target lost: ${m.item} (${m.before} to ${m.after})`);
  }

  for (let i = 0; i < bl.length; i++) {
    if (bl[i] === al[i]) continue;
    const wasEmpty = bl[i].trim() === '';
    const isEmpty = al[i].trim() === '';
    if (wasEmpty !== isEmpty) {
      problems.push(`line ${i + 1}: ${wasEmpty ? 'blank line gained content' : 'line was emptied'}`);
      continue;
    }
    for (const p of [...blockquoteProblems(bl[i], al[i]), ...tableShapeProblems(bl[i], al[i])]) {
      problems.push(
        `line ${i + 1}: ${p}\n` +
          `      before: ${bl[i].trim().slice(0, 150)}\n` +
          `      after:  ${al[i].trim().slice(0, 150)}`
      );
    }

    const wb = words(bl[i]);
    const wa = words(al[i]);
    const d = wordDistance(wb, wa, budget);
    if (d > budget) {
      problems.push(
        `line ${i + 1}: wording moved by more than ${budget} word(s)\n` +
          `      before: ${bl[i].trim().slice(0, 150)}\n` +
          `      after:  ${al[i].trim().slice(0, 150)}`
      );
    }
  }

  return problems;
}

function main() {
  const argv = process.argv.slice(2);
  const targets = argv.filter((a) => !a.startsWith('--'));
  if (!targets.length) {
    console.error('Usage: verify-edit-integrity.js <dir> [--ref=HEAD] [--budget=4] [--verbose]');
    process.exit(2);
  }
  const refArg = argv.find((a) => a.startsWith('--ref='));
  const ref = refArg ? refArg.split('=')[1] : 'HEAD';
  const budgetArg = argv.find((a) => a.startsWith('--budget='));
  const budget = budgetArg ? parseInt(budgetArg.split('=')[1], 10) : 4;
  const verbose = argv.includes('--verbose');

  const root = repoRootFor(path.resolve(targets[0]));
  const files = [...new Set(targets.flatMap((t) => collectDocs(path.resolve(t))))].sort();

  let checked = 0;
  let changed = 0;
  let clean = 0;
  const failures = [];

  for (const file of files) {
    const rel = path.relative(root, file);
    const before = gitShow(root, ref, rel);
    if (before === null) continue; // untracked, nothing to compare against
    checked += 1;
    const after = fs.readFileSync(file, 'utf8');
    if (before === after) continue;
    changed += 1;
    const problems = checkFile(rel, before, after, budget);
    if (problems.length) failures.push({ rel, problems });
    else clean += 1;
  }

  console.log(`ref                ${ref}`);
  console.log(`files compared     ${checked}`);
  console.log(`files changed      ${changed}`);
  console.log(`changed and clean  ${clean}`);
  console.log(`files with issues  ${failures.length}`);

  if (failures.length) {
    console.log('');
    const show = verbose ? failures : failures.slice(0, 20);
    for (const f of show) {
      console.log(`${f.rel}`);
      for (const p of f.problems.slice(0, verbose ? 100 : 5)) console.log(`    ${p}`);
      if (!verbose && f.problems.length > 5) {
        console.log(`    ... and ${f.problems.length - 5} more`);
      }
    }
    if (!verbose && failures.length > 20) {
      console.log(`\n... and ${failures.length - 20} more file(s). Pass --verbose for all.`);
    }
    process.exitCode = 1;
  } else {
    console.log('\nevery change is punctuation only');
  }
}

if (require.main === module) main();

module.exports = {
  checkFile,
  fences,
  words,
  wordDistance,
  inlineCode,
  linkTargets,
  tableShapeProblems,
  blockquoteProblems,
};
