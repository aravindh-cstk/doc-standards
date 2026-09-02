'use strict';

/**
 * Regression suite for the doc-standards gap loop.
 *
 * The three violations below were caught by a human, not by the linter. Each
 * one now has a check, and each check has an exemption it must respect. This
 * file is what stops a future widening from silently un-catching any of them,
 * or from over-firing on the constructs that were always legitimate.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { DocModel } = require('../lib/doc-model');
const { checkBannedPhrases } = require('../checks/banned-phrases');
const { checkEmbeddedQuestionPhrases } = require('../checks/embedded-question-phrases');
const { checkOrderedListSequence } = require('../checks/ordered-list-sequence');
const { checkQaHeaders } = require('../checks/qa-headers');
const { nextRuleId, validateRegistry } = require('../lib/rules-registry');
const { triageGap } = require('../probe-corpus');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

function lineOf(doc, needle) {
  const idx = doc.lines.findIndex((l) => l.includes(needle));
  return idx === -1 ? -1 : idx + 1;
}

// --- Proof case 1: casual phrase, a wordlist gap -----------------------------

test('C3-01 flags "the same kinds of work"', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const findings = checkBannedPhrases(doc).filter((f) => /kinds of/i.test(f.message));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'C3-01');
  assert.equal(findings[0].tier, 1);
  assert.equal(findings[0].checkId, 'banned-phrases');
  assert.equal(findings[0].line, lineOf(doc, 'cover the same kinds of work'));
});

test('C3-01 flags "ends up with" on the same fixture', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const findings = checkBannedPhrases(doc).filter((f) => /ends up with/i.test(f.message));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'C3-01');
});

// Found by running the loop itself on the live corpus, which is the drill that
// proves the loop works rather than just the three fixes it was built from.
test('C3-01 flags the vague "two things" instead of naming the items', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const findings = checkBannedPhrases(doc).filter((f) => /two things/i.test(f.message));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'C3-01');
  assert.equal(findings[0].line, lineOf(doc, 'This step covers two things'));
});

test('C3-01 does not flag a plain count of real nouns', () => {
  // The exemption guard: the rule targets the vague noun, not the numeral. A
  // widening that starts flagging "two parameters" has gone too far.
  const doc = new DocModel('inline.md', ['# T', '', '## Overview', '', 'The URL carries two parameters and three flags.'].join('\n'));
  assert.deepEqual(checkBannedPhrases(doc).filter((f) => /things/i.test(f.message)), []);
});

// --- Proof case 2: indirect question, a regex that was too narrow ------------

test('C3-12 flags a mid-sentence "how" and exempts headings and table cells', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const findings = checkOnlyQuestion(doc);

  const violation = lineOf(doc, 'They differ in how you install them');
  assert.ok(findings.some((f) => f.line === violation), 'the indirect question must be flagged');

  for (const f of findings) {
    assert.equal(f.ruleId, 'C3-12');
    assert.equal(f.tier, 2);
    assert.equal(f.checkId, 'embedded-question-phrases');
  }

  // The exemptions. A capitalized "How" opening a heading or a table cell is an
  // accepted convention, and the check must stay case sensitive to preserve it.
  const headingLine = lineOf(doc, '### How a tool call works');
  const cellLine = lineOf(doc, 'How many levels above the term');
  assert.ok(!findings.some((f) => f.line === headingLine), 'a How heading must not be flagged');
  assert.ok(!findings.some((f) => f.line === cellLine), 'a How many table cell must not be flagged');
});

function checkOnlyQuestion(doc) {
  return checkEmbeddedQuestionPhrases(doc);
}

// --- Proof case 3: numbered list that is not a sequence, no rule existed -----

test('C3-14 flags a numbered set and exempts real sequences', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const findings = checkOrderedListSequence(doc);

  assert.equal(findings.length, 1, 'exactly the component list, not the two real sequences');
  assert.equal(findings[0].ruleId, 'C3-14');
  assert.equal(findings[0].tier, 2);
  assert.equal(findings[0].checkId, 'ordered-list-sequence');
  assert.equal(findings[0].line, lineOf(doc, '**Profiles:** a set of tools'));
  assert.ok(findings[0].falsePositiveNote, 'a judgment-bearing tier 2 finding must carry its own caveat');

  // The exemptions, asserted by absence above but named here so a failure says why.
  assert.ok(!findings.some((f) => f.line === lineOf(doc, 'Clear the filters')), 'imperative steps keep their numbers');
  assert.ok(!findings.some((f) => f.line === lineOf(doc, 'Tool arguments on a single call')), 'a ranked list keeps its numbers');
});

// --- C3-02 exception: an H1 that names the page as a question -----------------
//
// Found while closing out the corpus sweep: "What is MCP Profile Hub?" is the
// deliberate title of a published conceptual guide, and the check had no H1
// exemption. Renaming a page whose URL and seo_title already ship that title
// is a content decision, not a lint fix, so the check was narrowed instead.

test('C3-02 exempts the H1 but still flags a question-form H2', () => {
  const doc = new DocModel('inline.md', [
    '---',
    'seo_title: t',
    'seo_description: d',
    'url: /u',
    '---',
    '',
    '# What is MCP Profile Hub?',
    '',
    '## Overview',
    '',
    'Body text here.',
    '',
    '## Is this section a question?',
    '',
    'More body text.',
  ].join('\n'));

  const findings = checkQaHeaders(doc);
  assert.equal(findings.length, 1, 'only the H2 question should be flagged, not the H1');
  assert.equal(findings[0].section, 'Is this section a question?');
  assert.equal(findings[0].ruleId, 'C3-02');
});

test('C3-02 still exempts a question-form H2 inside a dedicated FAQ section', () => {
  const doc = new DocModel('inline.md', [
    '# T',
    '',
    '## FAQ',
    '',
    '### Does this still work?',
    '',
    'Yes.',
  ].join('\n'));

  assert.deepEqual(checkQaHeaders(doc), []);
});

// --- Registry wiring ---------------------------------------------------------

test('the registry and the check modules agree', () => {
  assert.deepEqual(validateRegistry(), []);
});

test('nextRuleId computes rather than guessing by category', () => {
  // C3-13 is the retry-count rule and C3-14 the ordered-list rule. Neither is a
  // sibling in meaning of C3-12, which is why the next id must be computed.
  assert.equal(nextRuleId('C3'), 'C3-15');
  assert.equal(nextRuleId('FM'), 'FM-03');
});

// --- Triage: the loop must reproduce the diagnosis, not just the fix ---------

test('triageGap routes a wordlist gap to the wordlist file', () => {
  const result = triageGap({ existingFindings: [] }, [{ ruleId: 'C3-01', checkId: 'banned-phrases', score: 0.5 }]);
  assert.equal(result.classification, 'WORDLIST_GAP');
  assert.ok(result.changeFiles.some((f) => f.includes('data/banned-phrases')));
});

test('triageGap routes a too-narrow regex to the module and its patterns', () => {
  const result = triageGap({ existingFindings: [] }, [
    { ruleId: 'C3-12', checkId: 'embedded-question-phrases', score: 0.5 },
  ]);
  assert.equal(result.classification, 'REGEX_TOO_NARROW');
  assert.ok(result.changeFiles.includes('checks/embedded-question-phrases.js'));
  assert.ok(result.patterns.includes('PHRASE_RE'));
});

test('triageGap reports NO_RULE with a computed id when nothing owns the case', () => {
  const result = triageGap({ existingFindings: [] }, []);
  assert.equal(result.classification, 'NO_RULE');
  assert.deepEqual(result.suggestedIds, ['C3-15']);
});

test('triageGap does not re-litigate a line an existing check already reports', () => {
  const result = triageGap(
    { existingFindings: [{ ruleId: 'C3-07', checkId: 'sentence-concision', message: 'x' }] },
    [{ ruleId: 'C3-01', checkId: 'banned-phrases', score: 0.9 }]
  );
  assert.equal(result.classification, 'NOT_A_GAP');
});
