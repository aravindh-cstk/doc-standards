'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { collectNumericCandidates, claimsOn, NOT_A_NOUN, UNIT_NOUNS } = require('../checks/numeric-consistency');
const { DocModel } = require('../lib/doc-model');

const docOf = (...lines) => new DocModel('test.md', lines.join('\n'));

// --- The shape it exists for ------------------------------------------------

test('a count that disagrees with the list below it is a candidate', () => {
  const c = collectNumericCandidates(
    docOf('# Page', '', 'Three things are mandatory below:', '', '- One', '- Two', '- Three', '- Four')
  );
  assert.equal(c.length, 1);
  assert.equal(c[0].ruleId, 'C2-13');
  assert.equal(c[0].claimed, 3);
  assert.equal(c[0].found, 4);
});

test('a count that agrees produces nothing', () => {
  const c = collectNumericCandidates(
    docOf('# Page', '', 'Three things are mandatory below:', '', '- One', '- Two', '- Three')
  );
  assert.equal(c.length, 0);
});

test('"both" counts two', () => {
  const c = collectNumericCandidates(
    docOf('# Page', '', 'Both options below apply:', '', '- One', '- Two', '- Three')
  );
  assert.equal(c.length, 1);
  assert.equal(c[0].claimed, 2);
});

test('a table body is counted, not its header', () => {
  const c = collectNumericCandidates(
    docOf('# Page', '', 'The four regions below:', '', '| Region | Host |', '|---|---|', '| a | b |', '| c | d |')
  );
  assert.equal(c.length, 1);
  assert.equal(c[0].structure, 'table');
  assert.equal(c[0].found, 2);
});

/**
 * "Eight deliverables" over a list of eight items that each carry sub-bullets
 * counts eight, not twenty-four. The first item's indentation sets the level.
 */
test('nested list items do not inflate the count', () => {
  const c = collectNumericCandidates(
    docOf('# Page', '', 'The two steps below:', '', '- One', '  - detail', '  - detail', '- Two', '  - detail')
  );
  assert.equal(c.length, 0);
});

// --- What must not become a candidate ---------------------------------------

/**
 * A count about the world is not a claim about this page, and the pointing word
 * is the only thing that separates the two. Without this gate every number in
 * the corpus that happens to sit above a list becomes a question.
 */
test('a count with no pointing word is out of scope', () => {
  const c = collectNumericCandidates(
    docOf('# Page', '', 'Studio runs in seven regions worldwide.', '', '- One', '- Two')
  );
  assert.equal(c.length, 0);
});

test('a paragraph between the claim and the list breaks the association', () => {
  const c = collectNumericCandidates(
    docOf('# Page', '', 'Three things below:', '', 'An unrelated paragraph sits here.', '', '- One', '- Two')
  );
  assert.equal(c.length, 0);
});

test('a unit noun is not a countable enumeration', () => {
  assert.equal(claimsOn('It takes three minutes to run, see below.').length, 0);
  assert.equal(claimsOn('The field accepts 20 characters, listed below.').length, 0);
});

test('a verb in the third person is not a plural noun', () => {
  assert.equal(claimsOn('Two is the number listed below.').length, 0);
  assert.equal(claimsOn('Both has the same effect, described below.').length, 0);
});

test('a number inside a code span is not a claim', () => {
  assert.equal(claimsOn('Set `retries: 3 attempts` as listed below.').length, 0);
});

test('a singular noun after a count is a compound, not an enumeration', () => {
  assert.equal(claimsOn('The three-step flow below explains it.').length, 0);
});

test('"one" is not treated as a count', () => {
  assert.equal(claimsOn('There is one option listed below.').length, 0);
});

test('a number above 99 is a version or a status code, not a count', () => {
  assert.equal(claimsOn('The 404 responses below are expected.').length, 0);
});

// --- Data hygiene -----------------------------------------------------------

test('the unit and non-noun sets do not overlap', () => {
  for (const w of NOT_A_NOUN) assert.ok(!UNIT_NOUNS.has(w), `${w} is in both sets`);
});

test('every candidate carries the question a judge answers', () => {
  const c = collectNumericCandidates(
    docOf('# Page', '', 'Three things below:', '', '- One', '- Two', '- Three', '- Four')
  );
  assert.ok(c[0].decide && c[0].decide.includes('VIOLATION'));
  assert.ok(c[0].signal);
  assert.ok(c[0].evidence.length > 1);
});
