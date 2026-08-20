'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { DocModel } = require('../lib/doc-model');
const { checkPeriphrasis } = require('../checks/periphrasis-phrases');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

test('periphrasis fixture: "long list...read in pages" is flagged as C3-09 tier 2', () => {
  const doc = loadFixture('periphrasis-doc.md');
  const findings = checkPeriphrasis(doc);

  const messages = findings.map((f) => f.message).join('\n');
  assert.match(messages, /pagination/i);

  for (const f of findings) {
    assert.equal(f.ruleId, 'C3-09');
    assert.equal(f.tier, 2);
    assert.equal(f.checkId, 'periphrasis-phrases');
  }
});

test('periphrasis fixture: "paginate" stated directly is not flagged', () => {
  const doc = loadFixture('periphrasis-doc.md');
  const findings = checkPeriphrasis(doc);
  const flaggedOnPaginateLine = findings.some((f) => /Use skip and limit together to paginate/.test(doc.lines[f.line - 1]));
  assert.equal(flaggedOnPaginateLine, false);
});
