'use strict';

/**
 * Regression suite for checks/sentence-concision.js.
 *
 * The check had NO test before this file. It was found while auditing why a
 * hand-improved sentence passed the linter: the module hard-coded
 * `escapeRegExp(entry.phrase)` instead of using the shared `entryRegex`, so a
 * `pattern`-only entry added to data/wordy-connectors.json would throw on
 * `undefined.replace`. lint-doc.js converts a thrown check into a tier-1 LD-00
 * finding, so a data edit could fail the lint on every file in the corpus.
 *
 * Test 2 below is that landmine's regression guard, and it has to exist before
 * any pattern entry lands in data/wordy-connectors.json.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { DocModel } = require('../lib/doc-model');
const {
  checkSentenceConcision,
  matchWordyPhrase,
  WORDY_PHRASES_PATH,
  MAX_WORDS,
} = require('../checks/sentence-concision');
const { loadEntryFile } = require('../lib/phrase-list');

function docOf(...bodyLines) {
  return new DocModel('inline.md', ['# T', '', '## Overview', '', ...bodyLines].join('\n'));
}

test('every current wordy-connector entry still fires as C3-07 tier 2', () => {
  const entries = loadEntryFile(WORDY_PHRASES_PATH);
  assert.ok(entries.length > 0, 'the wordlist must not be empty');

  for (const entry of entries) {
    // Only a literal can be planted verbatim into a sentence. A pattern entry
    // is covered by the matcher tests below.
    if (!entry.phrase) continue;
    const doc = docOf(`The runtime resolves the stack ${entry.phrase} the call then proceeds.`);
    const findings = checkSentenceConcision(doc);

    assert.equal(findings.length, 1, `"${entry.phrase}" must produce exactly one finding`);
    assert.equal(findings[0].ruleId, 'C3-07');
    assert.equal(findings[0].tier, 2);
    assert.equal(findings[0].checkId, 'sentence-concision');
    assert.ok(findings[0].falsePositiveNote, 'a judgment-bearing tier-2 finding carries its own caveat');
    assert.match(findings[0].message, new RegExp(entry.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('a pattern-only entry does not throw, which is the landmine this file guards', () => {
  // Before the entryRegex switch this threw TypeError, surfacing as a tier-1
  // LD-00 finding on line 1 of every file in the corpus.
  const patternEntry = { pattern: '\\bwhich mean(s|t)\\b', label: 'which means', fix: 'state the result' };
  assert.doesNotThrow(() => matchWordyPhrase('The URL binds the profile which meant the client cannot switch.', [patternEntry]));
  const hit = matchWordyPhrase('The URL binds the profile which meant the client cannot switch.', [patternEntry]);
  assert.equal(hit, patternEntry, 'an inflected pattern must match where the literal would not');
});

test('a pattern entry reports its label, never the string "undefined"', () => {
  // The real regression risk in the matcher switch: a pattern entry has no
  // `phrase`, so a message built from `entry.phrase` is silently wrong rather
  // than a crash.
  const patternEntry = { pattern: '\\bwhich mean(s|t)\\b', label: 'which means', fix: 'state the result' };
  const hit = matchWordyPhrase('a which meant b', [patternEntry]);
  const found = hit.label || hit.phrase;
  assert.equal(found, 'which means');
  assert.notEqual(found, undefined);
});

test('an uncompilable pattern is skipped rather than taking the check down', () => {
  const bad = { pattern: '\\b(unclosed', label: 'bad', fix: 'x' };
  assert.doesNotThrow(() => matchWordyPhrase('any sentence at all', [bad]));
  assert.equal(matchWordyPhrase('any sentence at all', [bad]), null);
});

test('the word-count path fires independently of the wordlist', () => {
  // So a wordlist edit cannot silently disable the other two signals.
  const long = `The runtime ${'resolves the configured stack and then '.repeat(4)}executes the call against it.`;
  assert.ok(long.split(/\s+/).length > MAX_WORDS);
  const findings = checkSentenceConcision(docOf(long));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\d+ words/);
});

test('the stacked-causal path fires independently of the wordlist', () => {
  const doc = docOf('The call fails because the token expired, therefore the client reconnects.');
  const findings = checkSentenceConcision(doc);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /stacked causal clauses/);
});

test('a short plain sentence with no wordy phrase is not flagged', () => {
  assert.deepEqual(checkSentenceConcision(docOf('The runtime validates the token.')), []);
});

test('headings, table rows, and callouts are skipped', () => {
  const doc = docOf(
    '### Because the token expired, therefore the call fails',
    '',
    '| Field | Because it expired, therefore it fails |',
    '| --- | --- |',
    '',
    '> **Note:** because the token expired, therefore the call fails.'
  );
  assert.deepEqual(checkSentenceConcision(doc), []);
});
