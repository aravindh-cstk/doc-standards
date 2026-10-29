'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  maskProtected,
  offendingPositions,
  fixDeterministic,
  fixHeading,
  fixBoldLabel,
  fixPairedDashes,
  fixNumericRange,
  fixSemicolonClause,
  fixTableRow,
  parseBatchReply,
} = require('../fix/fix-dashes');

// ---------------------------------------------------------------------------
// Protection. Getting this wrong corrupts code samples, so it is tested first.
// ---------------------------------------------------------------------------

test('a mask is the same length as its input, so offsets stay valid', () => {
  const line = 'Use `a; b` and <img style="max-width: 680px; width: 100%"> here.';
  assert.equal(maskProtected(line).length, line.length);
});

test('a semicolon inside inline code is not an offence', () => {
  assert.deepEqual(offendingPositions('Set `a; b` in the config.'), []);
});

test('a semicolon inside an HTML style attribute is not an offence', () => {
  const line = '<img src="x.png" style="max-width: 680px; width: 100%; height: auto;">';
  assert.deepEqual(offendingPositions(line), []);
});

test('a semicolon inside a link target is not an offence', () => {
  assert.deepEqual(offendingPositions('See [the docs](https://x.test/a;b) for more.'), []);
});

test('an em dash in prose beside protected spans is still found', () => {
  const line = 'Run `npm test` — it must pass.';
  assert.equal(offendingPositions(line).length, 1);
});

/**
 * Indentation stopped protecting a line once the corpus was counted: of every
 * indented non-list line outside a fence, 301 were HTML attribute continuations
 * and 46 were continuation paragraphs under a list item. None was code, and the
 * rule was hiding 46 real prose lines.
 */
test('an indented line is prose, so its semicolon is an offence', () => {
  assert.equal(offendingPositions('    const a = 1; const b = 2;').length, 2);
});

test('an indented HTML attribute continuation is still protected', () => {
  assert.deepEqual(offendingPositions('    style="max-width: 900px; width: 100%;">'), []);
  assert.deepEqual(offendingPositions('    width="480" height="688"'), []);
});

// ---------------------------------------------------------------------------
// Heading rule
// ---------------------------------------------------------------------------

test('a heading dash becomes a colon', () => {
  const out = fixHeading('## Step 1 — Open the Campaign Template');
  assert.equal(out.line, '## Step 1: Open the Campaign Template');
  assert.equal(out.rule, 'heading-colon');
});

test('a heading that already has a colon is left for the model', () => {
  assert.equal(fixHeading('## Rule 4: shapes — pick one first'), null);
});

test('a heading with two dashes is left for the model', () => {
  assert.equal(fixHeading('## A — B — C'), null);
});

test('a heading whose dash has no text after it is not rewritten', () => {
  assert.equal(fixHeading('## Trailing dash —'), null);
});

test('a non-heading line is not treated as a heading', () => {
  assert.equal(fixHeading('Not a heading — just prose.'), null);
});

// ---------------------------------------------------------------------------
// Bold label rule
// ---------------------------------------------------------------------------

test('a bold label followed by a dash becomes a colon', () => {
  const out = fixBoldLabel('- **Rule 1** — deck style only.');
  assert.equal(out.line, '- **Rule 1**: deck style only.');
});

test('the list marker survives a bold label fix', () => {
  const out = fixBoldLabel('  1. **Root Cause** — the token expired.');
  assert.equal(out.line, '  1. **Root Cause**: the token expired.');
});

test('a bold span mid-sentence is not a label', () => {
  assert.equal(fixBoldLabel('The **important** part — read it.'), null);
});

// ---------------------------------------------------------------------------
// Paired dash rule
// ---------------------------------------------------------------------------

test('a balanced pair of dashes becomes parentheses', () => {
  const out = fixPairedDashes('The last element — a descender, say — must clear the edge.');
  assert.equal(out.line, 'The last element (a descender, say) must clear the edge.');
});

test('a single dash is not treated as a pair', () => {
  assert.equal(fixPairedDashes('One clause — another clause.'), null);
});

test('a second dash that ends the line is not a closing bracket', () => {
  assert.equal(fixPairedDashes('First — second — '), null);
});

test('a long span between two dashes is left for the model', () => {
  const long = 'a'.repeat(70);
  assert.equal(fixPairedDashes(`Head — ${long} — tail.`), null);
});

// ---------------------------------------------------------------------------
// Numeric range rule
// ---------------------------------------------------------------------------

test('an en dash between numbers becomes the word to', () => {
  const out = fixNumericRange('Allow 10–20 retries.');
  assert.equal(out.line, 'Allow 10 to 20 retries.');
});

test('every numeric range on a line is converted', () => {
  const out = fixNumericRange('Between 6–10px and 10–12px.');
  assert.equal(out.line, 'Between 6 to 10px and 10 to 12px.');
});

test('an en dash not between numbers is left for the model', () => {
  assert.equal(fixNumericRange('Words – more words.'), null);
});

// ---------------------------------------------------------------------------
// Semicolon rule
// ---------------------------------------------------------------------------

test('a semicolon between clauses becomes a sentence boundary', () => {
  const out = fixSemicolonClause('The Repeater iterates the list; a Condition Block picks the design.');
  assert.equal(out.line, 'The Repeater iterates the list. A Condition Block picks the design.');
});

test('a semicolon-separated list is left for the model', () => {
  assert.equal(fixSemicolonClause('Pick red; green; or blue.'), null);
});

test('a semicolon after a fragment is left for the model', () => {
  assert.equal(fixSemicolonClause('Yes; the client holds a stale token.'), null);
});

test('a semicolon followed by a capital is left for the model', () => {
  assert.equal(fixSemicolonClause('The client holds a token; Contentstack rejects it.'), null);
});

// ---------------------------------------------------------------------------
// The combined pass
// ---------------------------------------------------------------------------

test('a clean line is reported clean and unchanged', () => {
  const out = fixDeterministic('Nothing wrong here.');
  assert.equal(out.clean, true);
  assert.equal(out.line, 'Nothing wrong here.');
  assert.deepEqual(out.applied, []);
});

test('a line needing two different rules is fixed by both', () => {
  const out = fixDeterministic('## Step 1 — retry 3–5 times');
  assert.equal(out.clean, true);
  assert.equal(out.line, '## Step 1: retry 3 to 5 times');
  assert.equal(out.applied.length, 2);
});

test('a line no rule can decide is left dirty rather than guessed at', () => {
  const out = fixDeterministic('This becomes a "let me help you" exercise — and that is the problem.');
  assert.equal(out.clean, false);
  assert.equal(out.line, 'This becomes a "let me help you" exercise — and that is the problem.');
});

test('the pass never leaves a line it calls clean with an offence in it', () => {
  const samples = [
    '## Step 1 — Open the Campaign Template',
    '- **Rule 1** — deck style only.',
    'The last element — a descender, say — must clear the edge.',
    'Allow 10–20 retries.',
    'The Repeater iterates the list; a Condition Block picks the design.',
    'Use `a; b` and prose — with a dash.',
  ];
  for (const s of samples) {
    const out = fixDeterministic(s);
    if (out.clean) {
      assert.deepEqual(offendingPositions(out.line), [], `left an offence in: ${out.line}`);
    }
  }
});

test('a protected span is never altered by the deterministic pass', () => {
  const line = '## Setup — configure `a; b` and <span style="a; b">x</span>';
  const out = fixDeterministic(line);
  assert.ok(out.line.includes('`a; b`'));
  assert.ok(out.line.includes('style="a; b"'));
});

// ---------------------------------------------------------------------------
// Batch reply parsing
// ---------------------------------------------------------------------------

test('a numbered batch reply is parsed back to line indexes', () => {
  const items = [{ text: 'a' }, { text: 'b' }];
  const parsed = parseBatchReply('1|first fixed\n2|second fixed', items);
  assert.equal(parsed.get(0), 'first fixed');
  assert.equal(parsed.get(1), 'second fixed');
});

test('a reply line with a pipe in its content keeps the whole content', () => {
  const items = [{ text: 'a' }];
  const parsed = parseBatchReply('1|a table | with pipes | in it', items);
  assert.equal(parsed.get(0), 'a table | with pipes | in it');
});

test('an out-of-range index is discarded rather than written somewhere wrong', () => {
  const items = [{ text: 'a' }];
  const parsed = parseBatchReply('1|ok\n7|stray', items);
  assert.equal(parsed.size, 1);
  assert.equal(parsed.get(0), 'ok');
});

test('unparseable chatter around the reply is ignored', () => {
  const items = [{ text: 'a' }];
  const parsed = parseBatchReply('Sure, here you go:\n\n1|ok\n\nLet me know.', items);
  assert.equal(parsed.size, 1);
  assert.equal(parsed.get(0), 'ok');
});

// ---------------------------------------------------------------------------
// HTML entities. Their trailing semicolon is markup, not prose punctuation.
// ---------------------------------------------------------------------------

test('a semicolon that closes an HTML entity is not an offence', () => {
  assert.deepEqual(offendingPositions('Put &lt;Component/&gt; in the alt text.'), []);
});

test('a numeric HTML entity is protected too', () => {
  assert.deepEqual(offendingPositions('Use &#8212; sparingly and &#x2014; never.'), []);
});

test('an entity does not shield a real dash on the same line', () => {
  assert.equal(offendingPositions('Write &lt;title&gt; here — not there.').length, 1);
});

test('an ampersand that is not an entity still exposes a later semicolon', () => {
  assert.equal(offendingPositions('Fish & chips; also pie.').length, 1);
});

// ---------------------------------------------------------------------------
// Ranges beyond digit-to-digit
// ---------------------------------------------------------------------------

test('a letter range becomes the word to', () => {
  assert.equal(fixNumericRange('Blocks B–D exercise the skills.').line, 'Blocks B to D exercise the skills.');
});

test('a labelled range becomes the word to', () => {
  assert.equal(fixNumericRange('enforces Q1–Q4 at registration').line, 'enforces Q1 to Q4 at registration');
});

test('a range endpoint keeps its unit', () => {
  assert.equal(fixNumericRange('Allow 6–10px of padding.').line, 'Allow 6 to 10px of padding.');
});

test('a mixed letter and digit pair is not treated as a range', () => {
  assert.equal(fixNumericRange('the a–3 mapping'), null);
});

test('an en dash between two words is left for another rule', () => {
  assert.equal(fixNumericRange('Responsive by default – collapses on mobile.'), null);
});

test('a token inside a longer word is never taken as a range endpoint', () => {
  assert.equal(fixNumericRange('Words–more words'), null);
});

// ---------------------------------------------------------------------------
// Table rows
// ---------------------------------------------------------------------------

test('a semicolon inside a table cell is split into a sentence', () => {
  const out = fixTableRow('| Repeater | Evaluates the condition; children render when truthy. |');
  assert.equal(out.line, '| Repeater | Evaluates the condition. Children render when truthy. |');
});

test('a table row keeps its pipe count', () => {
  const line = '| **A — B** | c; d | 3–4 |';
  const out = fixTableRow(line);
  assert.ok(out, 'expected a rewrite');
  assert.equal((out.line.match(/\|/g) || []).length, (line.match(/\|/g) || []).length);
});

test('an em dash alone in a cell becomes a hyphen', () => {
  const out = fixTableRow('| Section Slot | no Preview Mode | — |');
  assert.equal(out.line, '| Section Slot | no Preview Mode | - |');
});

test('a range inside a table cell is converted', () => {
  const out = fixTableRow('| **3–6 stack** | Still run |');
  assert.ok(out.line.includes('3 to 6'));
});

test('cell padding spaces survive a rewrite', () => {
  const out = fixTableRow('| Repeater | the list is iterated; each item renders once |');
  assert.ok(out, 'expected a rewrite');
  assert.ok(out.line.startsWith('| Repeater | '), `lost the padding: ${out.line}`);
  assert.ok(out.line.endsWith(' |'), `lost the trailing pad: ${out.line}`);
});

test('a non-table line is not treated as a table row', () => {
  assert.equal(fixTableRow('Just prose — with a dash.'), null);
});

test('a pipe inside inline code does not split a cell', () => {
  const line = '| `design | preview` | the toggle is per instance; each node remembers it |';
  const out = fixTableRow(line);
  assert.ok(out, 'expected a rewrite');
  assert.ok(out.line.includes('`design | preview`'), `mangled the code span: ${out.line}`);
  assert.equal((out.line.match(/\|/g) || []).length, (line.match(/\|/g) || []).length);
});

test('a table row the rules cannot decide is left alone', () => {
  assert.equal(fixTableRow('| some clause — another clause | b |'), null);
});
