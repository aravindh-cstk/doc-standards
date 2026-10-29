'use strict';

/**
 * Regression tests for the table corruption that shipped to the CMS.
 *
 * The incident: a corpus-wide C3-05 pass rewrote
 *   | Does it render multiple things AND arrange them? | **Compound — decompose** | — |
 * into
 *   | Does it render multiple things AND arrange them? | **Compound (decompose** |) |
 * across 19 rows, and four separate gates passed it. These tests hold each of
 * those gates shut.
 */

const test = require('node:test');
const assert = require('node:assert');

const {
  isTableRow,
  isAlignmentRow,
  splitCells,
  separatorCount,
  rowShapeOk,
  rowShapeProblems,
} = require('../lib/table-shape');
const { fixDeterministic, fixPairedDashes, fixTableRow } = require('../fix/fix-dashes');
const { tableShapeProblems, blockquoteProblems } = require('../fix/verify-edit-integrity');

const INCIDENT_BEFORE =
  '| Does it render multiple content things AND arrange them? | **Compound — decompose** | — |';
const INCIDENT_AFTER =
  '| Does it render multiple content things AND arrange them? | **Compound (decompose** |) |';

// ---------------------------------------------------------------------------
// The splitter
// ---------------------------------------------------------------------------

test('the outer delimiter pipes do not become empty leading and trailing cells', () => {
  assert.deepEqual(splitCells('| a | b | c |'), ['a', 'b', 'c']);
});

test('a row missing its trailing pipe still splits into the same cells', () => {
  assert.deepEqual(splitCells('| a | b | c'), ['a', 'b', 'c']);
});

test('a genuinely empty interior cell survives, only the outer fragments go', () => {
  assert.deepEqual(splitCells('| a |  | c |'), ['a', '', 'c']);
});

test('a genuinely empty final cell survives', () => {
  assert.deepEqual(splitCells('| a | b |  |'), ['a', 'b', '']);
});

test('a pipe inside an inline code span is not a cell separator', () => {
  assert.deepEqual(splitCells('| a | `x|y` | c |'), ['a', '`x|y`', 'c']);
});

test('an escaped pipe is not a cell separator', () => {
  assert.deepEqual(splitCells('| a \\| still one cell | b |'), ['a \\| still one cell', 'b']);
});

test('a pipe inside an HTML attribute is not a cell separator', () => {
  assert.deepEqual(splitCells('| <img alt="a|b" src="x.png"> | b |'), [
    '<img alt="a|b" src="x.png">',
    'b',
  ]);
});

test('the alignment row is recognised so it is never shape-checked', () => {
  assert.ok(isAlignmentRow('|---|---|---|'));
  assert.ok(isAlignmentRow('| :--- | ---: | :---: |'));
  assert.ok(!isAlignmentRow('| a | b |'));
  assert.ok(isTableRow('| a | b |'));
  assert.ok(!isTableRow('not a row'));
});

// ---------------------------------------------------------------------------
// The shape assertions
// ---------------------------------------------------------------------------

test('the incident row is reported, and the row it replaced is not', () => {
  assert.ok(rowShapeOk(INCIDENT_BEFORE), 'the original row was structurally fine');

  const problems = rowShapeProblems(INCIDENT_AFTER);
  assert.equal(problems.length, 2, 'both the cell that lost "(" and the one that gained ")"');
  assert.deepEqual(
    problems.map((p) => p.cell),
    [2, 3]
  );
  for (const p of problems) assert.match(p.problem, /unbalanced parentheses/);
});

test('an unclosed bold marker inside a cell is reported', () => {
  assert.ok(!rowShapeOk('| **opens and never closes | b | c |'));
  assert.ok(rowShapeOk('| **closes properly** | b | c |'));
});

test('bold italic is three asterisks a side and must not read as unclosed', () => {
  assert.ok(rowShapeOk('| ***bold italic*** | **b** | *i* |'));
});

test('a complete markdown link does not read as an unbalanced bracket', () => {
  assert.ok(rowShapeOk('| See [Building Blocks](../building-blocks.md) | b |'));
  assert.ok(rowShapeOk('| ![diagram](../assets/diagrams/x.png) | caption (short) |'));
  assert.ok(rowShapeOk('| See [a](x.md) and [b](y.md) (both) | two links |'));
});

test('parens and asterisks inside inline code and HTML attributes are not counted', () => {
  assert.ok(rowShapeOk('| `f(x)` and `a*b` | b |'));
  assert.ok(rowShapeOk('| `app/blog/[slug]/page.tsx` | owns the URL |'));
  assert.ok(rowShapeOk('| <img src="a.png" style="max-width: 60px; width: 100%"> | b |'));
});

/**
 * The prose mask's bare-URL pattern used to be `https?:\/\/\S+`, which ran past
 * a closing backtick and took the paren closing the sentence with it. Because
 * the mask unions its spans, that paren counted as protected and five sound
 * table cells read as having an unbalanced paren.
 */
test('a URL in backticks inside parentheses does not read as unbalanced', () => {
  assert.ok(rowShapeOk('| Pasting a full origin (e.g. `https://yoursite.com`) | b |'));
  assert.ok(rowShapeOk('| Canvas URL is a full URL (with `https://`) instead of a path | b |'));
  assert.ok(rowShapeOk('| Base URL includes the locale (`http://localhost:3000/en`) | b |'));
});

// ---------------------------------------------------------------------------
// Gate 1: the fixer must refuse to do it again
// ---------------------------------------------------------------------------

test('the paired-dash rule refuses a table row outright', () => {
  assert.equal(fixPairedDashes('| Alpha — beta | gamma — delta |'), null);
});

test('the paired-dash rule still brackets an aside in ordinary prose', () => {
  const r = fixPairedDashes('the last element — a descender, say — must clear the edge');
  assert.equal(r.line, 'the last element (a descender, say) must clear the edge');
  assert.equal(r.rule, 'paired-dash-parens');
});

test('the deterministic pass no longer produces the corruption', () => {
  const r = fixDeterministic(INCIDENT_BEFORE);
  assert.notEqual(r.line, INCIDENT_AFTER, 'this exact output is the incident');
  assert.ok(rowShapeOk(r.line), 'whatever it does, the row stays balanced');
  assert.equal(separatorCount(r.line), separatorCount(INCIDENT_BEFORE));
});

test('the minimal cross-cell case is left for the model rather than guessed at', () => {
  const row = '| Alpha — beta | gamma — delta |';
  const r = fixDeterministic(row);
  assert.equal(r.line, row, 'unchanged');
  assert.equal(r.clean, false, 'so the driver routes it to the model');
});

test('fixTableRow rejects its own output if a cell rule unbalanced a cell', () => {
  // An em dash alone in a cell is still handled, because that is cell-local.
  const r = fixTableRow('| `"local"` | `localStorage` survives visits | — |');
  assert.ok(r, 'the empty-cell placeholder rule still fires');
  assert.ok(rowShapeOk(r.line));
  assert.equal(separatorCount(r.line), 4);
});

// ---------------------------------------------------------------------------
// Gate 2: the integrity verifier must see it
// ---------------------------------------------------------------------------

test('the integrity verifier reports the incident it used to pass', () => {
  const problems = tableShapeProblems(INCIDENT_BEFORE, INCIDENT_AFTER);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /cells were balanced and now are not/);
});

test('the integrity verifier reports a lost or gained cell separator', () => {
  const problems = tableShapeProblems('| a | b | c |', '| a | b c |');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /separators went from 4 to 3/);
});

test('a row that was already broken is not reported as a regression', () => {
  assert.deepEqual(tableShapeProblems(INCIDENT_AFTER, INCIDENT_AFTER), []);
});

test('an ordinary punctuation edit inside one cell is not reported', () => {
  const problems = tableShapeProblems(
    '| **Next.js Pages Router** | **SSR** — `getServerSideProps` |',
    '| **Next.js Pages Router** | **SSR**: `getServerSideProps` |'
  );
  assert.deepEqual(problems, []);
});

test('a non-table line is not shape-checked at all', () => {
  assert.deepEqual(tableShapeProblems('a sentence (with an aside) here', 'a sentence here'), []);
});

// ---------------------------------------------------------------------------
// The same incident, generalized past table cells
// ---------------------------------------------------------------------------

/**
 * The table-row guard was the first fix and it was too narrow. A pipe is only
 * one of the boundaries a bracketing rule can straddle. Inside an alt
 * attribute the same rule turned
 *   real entry data — 'Summer Sale — 40% off' with a Shop now button
 * into
 *   real entry data ('Summer Sale) 40% off' with a Shop now button
 * because the two dashes sat on opposite sides of a quoted phrase.
 *
 * So the span between the dashes now has to open and close everything it
 * contains, whatever the container is.
 */
test('the paired-dash rule refuses a span that crosses a quote', () => {
  const line =
    '    alt="Two journeys. real entry data — \'Summer Sale — 40% off\' with a Shop now button."';
  assert.equal(fixPairedDashes(line), null);
});

test('the paired-dash rule refuses a span that crosses a bold run', () => {
  assert.equal(fixPairedDashes('a label — **bold — text** — after'), null);
});

test('the paired-dash rule refuses a span with an unclosed bracket', () => {
  assert.equal(fixPairedDashes('the list — items [a, b — and c'), null);
});

test('the paired-dash rule still brackets an aside containing balanced parens', () => {
  const r = fixPairedDashes('the value — a count (of rows) — is cached');
  assert.equal(r.line, 'the value (a count (of rows)) is cached');
});

test('a paren inside inline code does not make a span look unbalanced', () => {
  const r = fixPairedDashes('the helper — call `f(x)` first — then continue');
  assert.ok(r, 'a balanced aside whose code span holds parens is still an aside');
  assert.match(r.line, /\(call `f\(x\)` first\)/);
});

/**
 * A third container the same pass broke. A callout in 32-sections/overview.md
 * is a blockquote holding a table, and one row was rewritten without its `> `.
 * The row fell out of the quote and split one table into three.
 *
 * Neither existing invariant could see it: `words()` does not treat `>` as a
 * word, and the row's own cells were intact.
 */
test('the integrity verifier reports a lost blockquote prefix', () => {
  const problems = blockquoteProblems('> | **CMS wiring** — the map |', '| **CMS wiring**: the map |');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /blockquote depth went from 1 to 0/);
});

test('a punctuation edit that keeps the prefix is not reported', () => {
  assert.deepEqual(blockquoteProblems('> | a — b |', '> | a: b |'), []);
});

test('a line that was never quoted is not reported', () => {
  assert.deepEqual(blockquoteProblems('a — b', 'a: b'), []);
});

test('losing one level of nesting is reported', () => {
  assert.equal(blockquoteProblems('> > deep', '> deep').length, 1);
});
