'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { DocModel } = require('../lib/doc-model');
const { checkTableIntegrity } = require('../checks/table-integrity');

/** A real DocModel, because this check reads doc.tables. */
function docOf(...lines) {
  return new DocModel('inline.md', lines.join('\n'));
}

function messages(doc) {
  return checkTableIntegrity(doc).map((f) => f.message);
}

// --- Violations -------------------------------------------------------------

test('a row with fewer cells than the header is a finding', () => {
  const f = checkTableIntegrity(
    docOf('| A | B | C |', '|---|---|---|', '| one | two |')
  );
  assert.equal(f.length, 1);
  assert.equal(f[0].ruleId, 'C2-10');
  assert.equal(f[0].checkId, 'table-integrity');
  assert.equal(f[0].tier, 1);
  assert.match(f[0].message, /2 cells against 3/);
});

test('a row with more cells than the header is a finding', () => {
  const f = checkTableIntegrity(
    docOf('| A | B |', '|---|---|', '| one | two | three |')
  );
  assert.equal(f.length, 1);
  assert.match(f[0].message, /3 cells against 2/);
});

test('the message says how to write a literal pipe, since that is the usual cause', () => {
  const f = checkTableIntegrity(docOf('| A | B |', '|---|---|', '| a | b | c |'));
  assert.match(f[0].message, /\\\|/);
  assert.match(f[0].message, /backticks/);
});

/**
 * The reported defect. A punctuation pass turned
 *   | ... | **Compound - decompose** | - |
 * into
 *   | ... | **Compound (decompose** |) |
 * which still has three cells, so a cell-count check alone passes it.
 */
test('the reported corruption is caught even though the cell count is right', () => {
  const doc = docOf(
    '| Question | If yes | If no |',
    '|---|---|---|',
    '| Does it render multiple things AND arrange them? | **Compound (decompose** |) |'
  );
  const f = checkTableIntegrity(doc);
  assert.ok(f.length >= 2, 'both the cell that lost "(" and the one that gained ")"');
  assert.ok(f.every((x) => x.line === 3));
  assert.ok(!f.some((x) => /cells against/.test(x.message)), 'the cell count is correct here');
  assert.ok(f.every((x) => /unbalanced parentheses/.test(x.message)));
});

test('an unclosed bold marker inside a cell is a finding', () => {
  const f = checkTableIntegrity(
    docOf('| A | B |', '|---|---|', '| **opens and never closes | b |')
  );
  assert.equal(f.length, 1);
  assert.match(f[0].message, /never closes/);
});

test('a table with no header labels at all is one finding, not one per cell', () => {
  const f = checkTableIntegrity(
    docOf('| | |', '|---|---|', '| `alpha-atom-heading` | 88 compositions |')
  );
  assert.equal(f.length, 1);
  assert.match(f[0].message, /no header labels at all/);
});

test('an empty header cell that is not the leading column is a finding', () => {
  const f = checkTableIntegrity(
    docOf('| A | | C |', '|---|---|---|', '| one | two | three |')
  );
  assert.equal(f.length, 1);
  assert.match(f[0].message, /header cell 2 of 3 is empty/);
});

// --- Exemptions -------------------------------------------------------------

/**
 * 18 of the 19 blank header cells in the real corpus are this shape. Flagging
 * them would have made the rule's first run 19 parts noise to 1 part signal.
 */
test('a blank leading header cell is correct in a comparison table', () => {
  const f = checkTableIntegrity(
    docOf(
      '| | **Component Slot** | **Section Slot** |',
      '|---|---|---|',
      '| Who fills it | The developer | The author |'
    )
  );
  assert.deepEqual(f, []);
});

test('a pipe inside inline code is not a cell separator', () => {
  assert.deepEqual(
    messages(docOf('| A | B |', '|---|---|', '| `a|b` | two |')),
    []
  );
});

test('an escaped pipe is not a cell separator', () => {
  assert.deepEqual(
    messages(docOf('| A | B |', '|---|---|', '| a \\| still one cell | two |')),
    []
  );
});

test('a pipe inside an HTML attribute is not a cell separator', () => {
  assert.deepEqual(
    messages(docOf('| A | B |', '|---|---|', '| <img alt="a|b" src="x.png"> | two |')),
    []
  );
});

test('a complete markdown link does not read as an unbalanced bracket', () => {
  assert.deepEqual(
    messages(
      docOf(
        '| A | B |',
        '|---|---|',
        '| See [Building Blocks](../building-blocks.md) | two |',
        '| ![diagram](../assets/x.png) | caption (short) |'
      )
    ),
    []
  );
});

test('parens inside inline code and a style attribute are not counted', () => {
  assert.deepEqual(
    messages(
      docOf(
        '| A | B |',
        '|---|---|',
        '| `f(x)` and `app/blog/[slug]/page.tsx` | two |',
        '| <img src="a.png" style="max-width: 60px; width: 100%"> | two |'
      )
    ),
    []
  );
});

/**
 * The prose mask's bare-URL pattern used to run past a closing backtick and
 * take the paren closing the sentence with it, which made five sound cells read
 * as unbalanced.
 */
test('a URL in backticks inside parentheses is not unbalanced', () => {
  assert.deepEqual(
    messages(
      docOf(
        '| Mistake | Why |',
        '|---|---|',
        '| Pasting a full origin (e.g. `https://yoursite.com`) | Canvas URL is the path only |',
        '| A full URL (with `https://`) instead of a path | The iframe address breaks |'
      )
    ),
    []
  );
});

test('a well formed table produces nothing', () => {
  assert.deepEqual(
    messages(
      docOf(
        '| Parameter | Type | Default |',
        '|---|---|---|',
        '| `depth` | number | `1` |',
        '| `locale` | string | `en-us` |'
      )
    ),
    []
  );
});

test('a table inside a code fence is not checked', () => {
  assert.deepEqual(
    messages(docOf('```', '| A | B | C |', '|---|---|---|', '| one | two |', '```')),
    []
  );
});

/**
 * Four rows in the real corpus end with a pragma for a different linter, after
 * the closing pipe. Counting it as a cell reported each as one column too many.
 */
test('a trailing HTML comment pragma is not a cell', () => {
  assert.deepEqual(
    messages(
      docOf(
        '| A | B | C |',
        '|---|---|---|',
        '| one | two | three | <!-- style-lint: allow -->'
      )
    ),
    []
  );
});

test('an HTML comment inside a cell is still part of that cell', () => {
  assert.deepEqual(
    messages(docOf('| A | B | C |', '|---|---|---|', '| one | see <!-- note --> here | three |')),
    []
  );
});
