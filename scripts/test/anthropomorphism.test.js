'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { DocModel } = require('../lib/doc-model');
const { checkAnthropomorphism, PROTOCOL_CONTEXT_RE } = require('../checks/anthropomorphism');
const { byId } = require('../lib/rules-registry');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

test('anthropomorphism fixture: both advertise instances are flagged as C3-18', () => {
  const doc = loadFixture('anthropomorphism-doc.md');
  const findings = checkAnthropomorphism(doc);

  assert.equal(findings.length, 2, 'exactly the two advertise lines');
  const messages = findings.map((f) => f.message).join('\n');
  assert.match(messages, /advertise/i);

  for (const f of findings) {
    assert.equal(f.ruleId, 'C3-18');
    // The check reads its tier from the registry, so assert they agree rather
    // than pinning a literal here. The literal that must not drift silently is
    // the registry's own, asserted in the rule-text test below.
    assert.equal(f.tier, byId('C3-18').tier);
    assert.equal(f.checkId, 'anthropomorphism');
    // lib/report.js prints this under "Possible false positive". Without one, a
    // reader has no way to dismiss a hit on legitimate protocol vocabulary.
    assert.ok(f.falsePositiveNote, 'every finding carries a falsePositiveNote');
  }
});

test('anthropomorphism fixture: protocol and ownership vocabulary is not flagged', () => {
  const doc = loadFixture('anthropomorphism-doc.md');
  const findings = checkAnthropomorphism(doc);
  const flaggedLines = findings.map((f) => doc.lines[f.line - 1]);

  for (const exempt of [
    'exposes the profile',
    'client discovers them',
    'belongs to another region',
    'owns the stack',
    'interprets the tool description',
    'cannot reach the endpoint',
  ]) {
    assert.equal(
      flaggedLines.some((l) => l.includes(exempt)),
      false,
      `"${exempt}" must stay unflagged`
    );
  }
});

test('C3-18 does not fire inside a line carrying protocol vocabulary', () => {
  // The whole-line veto, not a per-entry lookaround. An OAuth paragraph uses
  // these verbs as the specification's own phrasing.
  const doc = new DocModel(
    'inline.md',
    ['# T', '', '## Overview', '', 'The authorization server advertises the scopes it supports.'].join('\n')
  );
  assert.ok(PROTOCOL_CONTEXT_RE.test('The authorization server advertises the scopes it supports.'));
  assert.deepEqual(checkAnthropomorphism(doc), []);
});

test('C3-18 does not fire on a verb inside a markdown link target', () => {
  // A link target is a slug derived from a heading, so a hit inside it reports
  // the heading in every file that links there. lib/phrase-list.js masks the
  // target and keeps the link text, so the visible words still get scanned.
  const doc = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Overview',
      '',
      'Use the [connector URL](/developers/mcp-url-parameters#the-url-decides-which-profile) for it.',
    ].join('\n')
  );
  assert.deepEqual(checkAnthropomorphism(doc), []);
});

test('C3-18 scans the visible link text even though the target is masked', () => {
  const doc = new DocModel(
    'inline.md',
    ['# T', '', '## Overview', '', 'See [the URL that decides the profile](/developers/x) for it.'].join('\n')
  );
  const findings = checkAnthropomorphism(doc);
  assert.equal(findings.length, 1, 'the link text is prose and must still be scanned');
  assert.match(findings[0].message, /decide/i);
});

test('C3-18 treats a bare verb opening a heading or a step as an instruction', () => {
  for (const line of [
    '## Choose an MCP product',
    '# Choose tool groups',
    '2. Choose **Add custom connector**, give it a name, and paste the connector URL.',
    'Decide the one job this profile should support before you start.',
    '- Choose the catalog your plan includes.',
    'Read the table first. Choose the catalog your plan includes.',
  ]) {
    const doc = new DocModel('inline.md', ['# T', '', '## Overview', '', line].join('\n'));
    assert.deepEqual(
      checkAnthropomorphism(doc),
      [],
      `an imperative addressed to the reader must not be flagged: ${line}`
    );
  }
});

test('C3-18 still flags the same verb once it has a component as its subject', () => {
  for (const [line, expected] of [
    ['The URL decides which profile a client can use.', /decide/i],
    ['Contentstack refuses the attempt.', /refuse/i],
    ['Contentstack ignores any parameter this page does not list.', /ignore/i],
  ]) {
    const doc = new DocModel('inline.md', ['# T', '', '## Overview', '', line].join('\n'));
    const findings = checkAnthropomorphism(doc);
    assert.equal(findings.length, 1, `must flag: ${line}`);
    assert.match(findings[0].message, expected);
  }
});

test('C3-18 exempts a reader or a model as the subject', () => {
  for (const line of [
    'You decide whether the profile stays private to you or is shared.',
    'The model chooses which tool to call by reading this description.',
    'The model sees only the tools the profile exposes.',
    'Use it when you want a scoped toolset in a web client.',
  ]) {
    const doc = new DocModel('inline.md', ['# T', '', '## Overview', '', line].join('\n'));
    assert.deepEqual(checkAnthropomorphism(doc), [], `must stay unflagged: ${line}`);
  }
});

test('C3-18 exempts exposes and discovers by rule text, not only by pattern', () => {
  // The registry exception is load-bearing at runtime: it is the only string an
  // EXCEPTION_APPLIES verdict is permitted to quote verbatim. If someone edits
  // the allowlist out of it, the judge silently loses the ability to exempt
  // these verbs, so assert the text itself.
  const rule = byId('C3-18');
  // Promoted from tier 2 once the corpus swept clean. A silent demotion would
  // stop the reported bug from blocking, so pin it here.
  assert.equal(rule.tier, 1);
  assert.equal(rule.checkId, 'anthropomorphism');
  for (const term of ['exposes tools', 'discovers them', 'lacks a scope', 'owns a stack']) {
    assert.ok(rule.exception.includes(term), `the C3-18 exception must name "${term}"`);
  }
});
