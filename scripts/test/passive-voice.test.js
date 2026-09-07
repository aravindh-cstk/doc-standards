'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { DocModel } = require('../lib/doc-model');
const { checkPassiveVoice } = require('../checks/passive-voice');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

function flaggedOn(findings, doc, pattern) {
  return findings.some((f) => pattern.test(doc.lines[f.line - 1]));
}

test('passive-voice fixture: regular, irregular, modal, get-passive, and by-agent constructions are flagged as C3-10 tier 2', () => {
  const doc = loadFixture('passive-voice-doc.md');
  const findings = checkPassiveVoice(doc);

  assert.equal(flaggedOn(findings, doc, /is chained/i), true);
  assert.equal(flaggedOn(findings, doc, /are stored/i), true);
  assert.equal(flaggedOn(findings, doc, /is serialized/i), true);
  assert.equal(flaggedOn(findings, doc, /is read from the manifest/i), true);
  assert.equal(flaggedOn(findings, doc, /pointer is set/i), true);
  assert.equal(flaggedOn(findings, doc, /can be tagged with/i), true);
  assert.equal(flaggedOn(findings, doc, /must be inspected/i), true);
  assert.equal(flaggedOn(findings, doc, /gets validated/i), true);
  assert.equal(flaggedOn(findings, doc, /is sent by find/i), true);
  assert.equal(flaggedOn(findings, doc, /is not published/i), true);

  for (const f of findings) {
    assert.equal(f.ruleId, 'C3-10');
    assert.equal(f.tier, 2);
    assert.equal(f.checkId, 'passive-voice');
  }
});

test('passive-voice fixture: predicate adjectives, idioms, and non-participles are not flagged', () => {
  const doc = loadFixture('passive-voice-doc.md');
  const findings = checkPassiveVoice(doc);

  assert.equal(flaggedOn(findings, doc, /is unchanged/i), false);
  assert.equal(flaggedOn(findings, doc, /is unlocalized/i), false);
  assert.equal(flaggedOn(findings, doc, /is based on/i), false);
  assert.equal(flaggedOn(findings, doc, /default color for a draft entry is red/i), false);
  assert.equal(flaggedOn(findings, doc, /response body is None/i), false);
  assert.equal(flaggedOn(findings, doc, /is used to normalize/i), false);
});

test('passive-voice fixture: "is enabled by default" is flagged once via the bare pattern, not via by-agent', () => {
  const doc = loadFixture('passive-voice-doc.md');
  const findings = checkPassiveVoice(doc);
  const onEnabledLine = findings.filter((f) => /is enabled by default/i.test(doc.lines[f.line - 1]));
  assert.equal(onEnabledLine.length, 1);
  assert.equal(onEnabledLine[0].message.includes('by-agent'), false);
});

test('passive-voice fixture: by-agent matches carry a lighter falsePositiveNote than bare matches', () => {
  const doc = loadFixture('passive-voice-doc.md');
  const findings = checkPassiveVoice(doc);
  const byAgent = findings.find((f) => /is sent by find/i.test(doc.lines[f.line - 1]));
  const bare = findings.find((f) => /is chained/i.test(doc.lines[f.line - 1]));
  assert.match(byAgent.falsePositiveNote, /by-agent/i);
  assert.match(bare.falsePositiveNote, /predicate adjective/i);
});

test('passive-voice fixture: auxiliary-less constructions are flagged as C3-10 tier 2', () => {
  const doc = loadFixture('passive-voice-doc.md');
  const findings = checkPassiveVoice(doc);

  assert.equal(flaggedOn(findings, doc, /tool set, shared across/i), true);
  assert.equal(flaggedOn(findings, doc, /delivery token scoped to/i), true);
  assert.equal(flaggedOn(findings, doc, /Profiles exported from/i), true);
  assert.equal(flaggedOn(findings, doc, /with everything pre-filled/i), true);
  assert.equal(flaggedOn(findings, doc, /needs the tool re-picked/i), true);
  assert.equal(flaggedOn(findings, doc, /Once configured/i), true);
  assert.equal(flaggedOn(findings, doc, /Hosted at the regional endpoint/i), true);
  assert.equal(flaggedOn(findings, doc, /Sign-in required/i), true);
  assert.equal(flaggedOn(findings, doc, /is bound to the session scope/i), true);
  assert.equal(flaggedOn(findings, doc, /is being reviewed by/i), true);

  for (const f of findings) {
    assert.equal(f.ruleId, 'C3-10');
    assert.equal(f.tier, 2);
    assert.equal(f.checkId, 'passive-voice');
  }
});

test('passive-voice fixture: status labels and prenominal participles are not flagged', () => {
  const doc = loadFixture('passive-voice-doc.md');
  const findings = checkPassiveVoice(doc);

  assert.equal(flaggedOn(findings, doc, /\| Token \| Required \| Not Required \|/i), false);
  assert.equal(flaggedOn(findings, doc, /is designed for streaming/i), false);
  assert.equal(flaggedOn(findings, doc, /A required field is absent/i), false);
});
