'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkQuickReferenceTable } = require('../checks/quick-reference-table');
const { DocModel } = require('../lib/doc-model');

const docOf = (...lines) => new DocModel('test.md', lines.join('\n'));
const ids = (findings) => findings.map((f) => f.ruleId);

// The three-column shape the Section Definitions in common-rules.md describe.
const genericQuickRef = (...rows) =>
  docOf(
    '# Title',
    '',
    '## Overview',
    '',
    'A lede that says what this page covers.',
    '',
    '## Quick Reference',
    '',
    '| Use Case | Section | Key Call |',
    '|---|---|---|',
    ...rows,
    ''
  );

// The shape MOD2 specifies for a module reference: each module or command
// mapped to its section anchor.
const moduleQuickRef = (...rows) =>
  docOf(
    '# Title',
    '',
    '## Overview',
    '',
    'A lede that says what this page covers.',
    '',
    '## Quick Reference',
    '',
    '| Module | Section |',
    '|---|---|',
    ...rows,
    ''
  );

// --- A compliant module reference is not an error --------------------------

/**
 * The expected column list was one hard-coded triple applied to every doc type,
 * so a module reference built to its own MOD2 shape reported a tier-1 C2-04 for
 * missing "use case" and "key call" columns. MOD2 is the type-specific rule for
 * cli-module-reference and overrides the generic Section Definitions entry,
 * which is how every other type file relates to common-rules.md.
 */
test('a MOD2-shaped Quick Reference is clean on a module reference', () => {
  const doc = moduleQuickRef('| `cm:stacks:export` | [Export](#export) |');
  assert.deepEqual(checkQuickReferenceTable(doc, 'cli-module-reference'), []);
});

test('the MOD2 shape still requires the anchor link', () => {
  // C2-04 is the anchor rule, and it is the half that does apply to this type.
  const doc = moduleQuickRef('| `cm:stacks:export` | Export |');
  const found = checkQuickReferenceTable(doc, 'cli-module-reference');
  assert.deepEqual(ids(found), ['C2-04']);
  assert.equal(found[0].tier, 1);
});

test('a module reference Quick Reference with no Section column is reported', () => {
  const doc = docOf(
    '# Title',
    '',
    '## Quick Reference',
    '',
    '| Module | Where |',
    '|---|---|',
    '| `x` | [X](#x) |',
    ''
  );
  assert.ok(ids(checkQuickReferenceTable(doc, 'cli-module-reference')).includes('C2-04'));
});

// --- The generic shape is unchanged ---------------------------------------

test('the three-column shape stays required on a prose doc', () => {
  const doc = docOf(
    '# Title',
    '',
    '## Quick Reference',
    '',
    '| Module | Section |',
    '|---|---|',
    '| `x` | [X](#x) |',
    ''
  );
  const found = checkQuickReferenceTable(doc, 'feature-doc');
  assert.ok(ids(found).includes('C2-04'), 'a prose doc missing Use Case and Key Call is still reported');
  assert.match(found[0].message, /use case/);
});

test('a compliant generic Quick Reference is clean', () => {
  const doc = genericQuickRef('| Fetch an entry | [Fetch](#fetch) | `entry()` |');
  assert.deepEqual(checkQuickReferenceTable(doc, 'feature-doc'), []);
});

test('a generic Quick Reference row with no anchor is reported', () => {
  const doc = genericQuickRef('| Fetch an entry | Fetch | `entry()` |');
  assert.deepEqual(ids(checkQuickReferenceTable(doc, 'feature-doc')), ['C2-04']);
});

test('a Quick Reference section with no table at all is reported', () => {
  const doc = docOf('# Title', '', '## Quick Reference', '', 'Some prose instead of a table.', '');
  assert.deepEqual(ids(checkQuickReferenceTable(doc, 'feature-doc')), ['C2-04']);
});

test('a doc with no Quick Reference section reports nothing', () => {
  const doc = docOf('# Title', '', '## Overview', '', 'A lede.', '');
  assert.deepEqual(checkQuickReferenceTable(doc, 'feature-doc'), []);
});

test('the Quick Decision Guide columns are unchanged', () => {
  const doc = docOf(
    '# Title',
    '',
    '## Quick Decision Guide',
    '',
    '| Approach | Reason |',
    '|---|---|',
    '| A | B |',
    ''
  );
  assert.deepEqual(ids(checkQuickReferenceTable(doc, 'feature-doc')), ['C1-02']);
});

test('calling with no docType falls back to the generic shape', () => {
  // lint-api-ref.js and older callers pass only the doc.
  const doc = genericQuickRef('| Fetch an entry | [Fetch](#fetch) | `entry()` |');
  assert.deepEqual(checkQuickReferenceTable(doc), []);
});
