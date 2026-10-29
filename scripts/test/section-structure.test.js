'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkSectionStructure, hasLede, LEDE_MIN_CHARS } = require('../checks/section-structure');
const { matches, alternativesFor } = require('../lib/section-index');
const { DocModel } = require('../lib/doc-model');

const docOf = (...lines) => new DocModel('test.md', lines.join('\n'));

// --- The lede satisfies the Overview requirement ----------------------------

/**
 * The matrix asks every doc type for an Overview and C1-01 looked for an H2
 * literally named "Overview". Exactly one page in 272 carries that heading. The
 * other 170 published pages open with a lede paragraph under the H1, and all
 * 170 were reported as missing an Overview.
 */
test('a lede under the H1 satisfies the Overview requirement', () => {
  const doc = docOf(
    '# Set the active project',
    '',
    'The active project decides which stack the CLI writes to, and every later command reads it.',
    '',
    '## Usage'
  );
  assert.equal(hasLede(doc), true);
  const overviewFindings = checkSectionStructure(doc, 'how-to-guide').filter((f) =>
    /"Overview" is missing/.test(f.message)
  );
  assert.equal(overviewFindings.length, 0);
});

/**
 * The case the relaxation must NOT swallow. An H1 followed straight by an H2
 * leaves a reader no way to tell whether they are on the right page. Exactly
 * one page in this corpus does it, and it is a real finding.
 */
test('an H1 followed straight by an H2 is still missing an Overview', () => {
  const doc = docOf('# Section slots', '', '## What they are');
  assert.equal(hasLede(doc), false);
  const overviewFindings = checkSectionStructure(doc, 'how-to-guide').filter((f) =>
    /"Overview" is missing/.test(f.message)
  );
  assert.equal(overviewFindings.length, 1);
});

test('a one-word fragment under the H1 is not a lede', () => {
  assert.equal(hasLede(docOf('# A page', '', 'Draft.', '', '## Usage')), false);
});

test('an explicit Overview heading still satisfies the requirement', () => {
  const doc = docOf('# A page', '', '## Overview', '', 'What this page covers.', '', '## Usage');
  const overviewFindings = checkSectionStructure(doc, 'how-to-guide').filter((f) =>
    /"Overview" is missing/.test(f.message)
  );
  assert.equal(overviewFindings.length, 0);
});

test('an HTML comment under the H1 is not a lede', () => {
  assert.equal(
    hasLede(docOf('# A page', '', '<!-- generated, do not edit by hand at all -->', '', '## Usage')),
    false
  );
});

test('the lede floor is well below three sentences', () => {
  assert.ok(LEDE_MIN_CHARS < 150, 'three sentences is roughly 150 characters');
  assert.ok(LEDE_MIN_CHARS > 0, 'zero would accept an empty line as orientation');
});

// --- A section row may name two acceptable headings -------------------------

/**
 * The matrix asked for "Next Steps", which 10 pages carry, while 157 carry
 * "See also". Both are link lists with a description per item.
 */
test('a row written "A or B" accepts either heading', () => {
  assert.equal(matches('next steps', 'Next Steps or See also'), true);
  assert.equal(matches('see also', 'Next Steps or See also'), true);
});

test('a row written "A or B" still rejects an unrelated heading', () => {
  assert.equal(matches('troubleshooting', 'Next Steps or See also'), false);
});

test('alternativesFor splits the row and drops any parenthetical', () => {
  assert.deepEqual(alternativesFor('Next Steps or See also'), ['next steps', 'see also']);
  assert.deepEqual(alternativesFor('Prerequisites (Quick Start path only)'), ['prerequisites']);
});

test('a single-name row is unaffected', () => {
  assert.deepEqual(alternativesFor('Troubleshooting'), ['troubleshooting']);
  assert.equal(matches('troubleshooting', 'Troubleshooting'), true);
});

// --- The rule still fires on a real gap -------------------------------------

test('a page with neither closing section is still a finding', () => {
  const doc = docOf('# A page', '', 'A lede that orients the reader properly here.', '', '## Usage', '', 'Text.');
  const findings = checkSectionStructure(doc, 'how-to-guide').filter((f) =>
    /"Next Steps or See also" is missing/.test(f.message)
  );
  assert.equal(findings.length, 1);
});
