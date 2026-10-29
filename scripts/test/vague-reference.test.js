'use strict';

/**
 * Unit tests for checks/vague-reference.js (C3-24).
 *
 * The rule is directional, so every test here is really a test of the forward
 * gate. A wordlist hit alone must never produce a finding: "this URL" is
 * correct after the URL and wrong before it, and the same five words appear in
 * both. Half these tests exist to prove the correct half stays silent.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { DocModel } = require('../lib/doc-model');
const { checkVagueReference, pointsForward } = require('../checks/vague-reference');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

/** A minimal in-memory doc, for gate cases too tight to be worth a fixture. */
function inlineDoc(...bodyLines) {
  return new DocModel('inline.md', ['# T', '', '## Overview', '', ...bodyLines].join('\n'));
}

test('a forward-pointing demonstrative above a fence is flagged as C3-24 tier 2', () => {
  const findings = checkVagueReference(loadFixture('gap-loop-proof.md'));

  assert.ok(findings.length > 0, 'the fixture carries violation seven');
  for (const f of findings) {
    assert.equal(f.ruleId, 'C3-24');
    assert.equal(f.tier, 2);
    assert.equal(f.checkId, 'vague-reference');
    assert.ok(f.falsePositiveNote, 'a tier-2 finding must say what it does not flag');
  }

  const messages = findings.map((f) => f.message).join('\n');
  assert.match(messages, /this URL sets a stack/);
});

test('the fixture exemptions stay clean, so the gate is doing the work', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const flaggedText = checkVagueReference(doc).map((f) => doc.lines[f.line - 1]);

  // A demonstrative resolving the paragraph above it.
  assert.ok(!flaggedText.some((t) => /This grants no extra access/.test(t)));
  // C3-04 owns a bare "the following" introducing a verified-complete set.
  assert.ok(!flaggedText.some((t) => /The following transports/.test(t)));
  // An anchor slug is machinery, and stripNonProse masks the link target.
  assert.ok(!flaggedText.some((t) => /parameter reference/.test(t)));
});

test('a demonstrative followed by more prose is not flagged', () => {
  const doc = inlineDoc(
    'Contentstack accepts this argument only on tools that target a stack: CMA and CDA.',
    '',
    'The call still runs on your own token.'
  );
  assert.deepEqual(checkVagueReference(doc), []);
});

test('a trailing colon opens the gate, and a table row below it opens it too', () => {
  const colon = inlineDoc('Contentstack describes the argument to the model like this:', '', '```text', 'Optional.', '```');
  assert.equal(checkVagueReference(colon).length, 1);

  const table = inlineDoc('These tabs each generate a snippet', '', '| Tab | Transport |', '| --- | --- |');
  assert.equal(checkVagueReference(table).length, 1);
});

test('pointsForward reads the next content line, not the next line', () => {
  const doc = inlineDoc('The runtime handles it in this order', '', '', '1. Validate the token.');
  assert.equal(pointsForward(doc, 5), true, 'blank lines between the lead-in and the list do not close the gate');

  const trailing = inlineDoc('The runtime handles it in this order', '', 'Nothing structured follows.');
  assert.equal(pointsForward(trailing, 5), false);
});

test('a heading and a table cell are never flagged, whatever they say', () => {
  const heading = inlineDoc('### Read this table first', '', '| A | B |', '| --- | --- |');
  assert.deepEqual(checkVagueReference(heading), []);

  const cell = inlineDoc('| Message | Fix |', '| --- | --- |', '| Bad key | Copy this URL: |');
  assert.deepEqual(checkVagueReference(cell), []);
});

test('one line produces one finding even when two entries match it', () => {
  const doc = inlineDoc('Read this table, then copy this URL:', '', '```', 'x', '```');
  assert.equal(checkVagueReference(doc).length, 1);
});
