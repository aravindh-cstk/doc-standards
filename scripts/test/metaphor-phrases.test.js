'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { DocModel } = require('../lib/doc-model');
const { checkMetaphors } = require('../checks/metaphor-phrases');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

test('metaphor fixture: walk, grandparent locale, and unwrap are flagged as C3-08 tier 2', () => {
  const doc = loadFixture('metaphor-doc.md');
  const findings = checkMetaphors(doc);

  const messages = findings.map((f) => f.message).join('\n');
  assert.match(messages, /walk/i);
  assert.match(messages, /grandparent locale/i);
  assert.match(messages, /unwrap/i);

  for (const f of findings) {
    assert.equal(f.ruleId, 'C3-08');
    assert.equal(f.tier, 2);
    assert.equal(f.checkId, 'metaphor-phrases');
  }
});

test('metaphor fixture: literal "descendants" naming a term relationship is not flagged', () => {
  const doc = loadFixture('metaphor-doc.md');
  const findings = checkMetaphors(doc);
  const flaggedOnDescendantLine = findings.some((f) => /descendants of the given term/.test(doc.lines[f.line - 1]));
  assert.equal(flaggedOnDescendantLine, false);
});
