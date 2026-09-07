'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DocModel } = require('../lib/doc-model');
const { checkPresentContinuous } = require('../checks/present-continuous');

function docFrom(...bodyLines) {
  return new DocModel('tense.md', ['# Title', '', '## Behavior', '', ...bodyLines].join('\n'));
}

test('present continuous as the main verb is flagged as C3-19 tier 2', () => {
  const doc = docFrom(
    'The client is holding a stale cached token.',
    'Confirm the profile calls are landing before you retry.',
    'The model is not reading the input schema correctly.',
    'Two people were running the same profile.'
  );
  const findings = checkPresentContinuous(doc);
  const flagged = findings.map((f) => f.line).sort();

  assert.deepEqual(flagged, [5, 6, 7, 8]);
  for (const f of findings) {
    assert.equal(f.ruleId, 'C3-19');
    assert.equal(f.tier, 2);
    assert.equal(f.checkId, 'present-continuous');
    assert.ok(f.falsePositiveNote, 'the adjective ambiguity needs a note, as passive-voice does');
  }
});

test('a passive progressive belongs to C3-10 and is left alone', () => {
  // "is being created" is a passive. Emitting C3-19 for it would report the
  // wrong rule to the reader and duplicate an existing finding.
  assert.equal(checkPresentContinuous(docFrom('The profile is being created by the wizard.')).length, 0);
});

test('a predicate adjective ending in -ing is not a verb and is not flagged', () => {
  const doc = docFrom(
    'The tool list is missing.',
    'The error message is confusing.',
    'The wizard is showing the remaining tools.'
  );
  const findings = checkPresentContinuous(doc);
  assert.deepEqual(findings.map((f) => f.line), [7], 'only "is showing" is a verb here');
});

test('a fenced code block and an inline code span are out of scope', () => {
  const doc = docFrom(
    '```bash',
    'echo "the server is running"',
    '```',
    'The status reads `the job is running` in the output.'
  );
  assert.equal(checkPresentContinuous(doc).length, 0);
});

test('one line carrying two constructions reports both', () => {
  const doc = docFrom('Confirm calls are succeeding and review what clients are using a profile for.');
  assert.equal(checkPresentContinuous(doc).length, 2);
});
