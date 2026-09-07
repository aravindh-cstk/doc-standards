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
const { checkAnthropomorphism } = require('../checks/anthropomorphism');
const { checkVagueReference } = require('../checks/vague-reference');
const { collectTier3Candidates } = require('../checks/tier3-candidates');
const { nextRuleId, validateRegistry, unemittedRuleClaims, byId } = require('../lib/rules-registry');
const registry = require('../data/rules-registry.json');
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

// --- Proof case 6: reach out, the sibling of a listed phrase -----------------

// Found while reviewing a rewrite that the linter passed clean. C3-01 already
// owned "reach for" and did not own "reach out", which is the same one-member-
// of-a-verb-family gap that let "advertises" ship.
test('C3-01 flags "reach out", the sibling of the already-listed "reach for"', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const findings = checkBannedPhrases(doc).filter((f) => /reach out/i.test(f.message));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'C3-01');
  assert.equal(findings[0].tier, 1);
  assert.equal(findings[0].line, lineOf(doc, 'so reach out to support'));
});

test('C3-01 leaves a literal "reach" and the compound "each outcome" alone', () => {
  // "cannot reach the discovery endpoint" is the networking sense the C3-18
  // exception protects, and "each outcome" contains the letters but not the
  // phrase. A word-bounded pattern must separate both from the violation.
  const doc = loadFixture('gap-loop-proof.md');
  const exemptLine = lineOf(doc, 'cannot reach the discovery endpoint');
  assert.notEqual(exemptLine, -1, 'the exemption case must be in the fixture');

  const findings = checkBannedPhrases(doc).filter((f) => /reach/i.test(f.message));
  assert.equal(
    findings.some((f) => f.line === exemptLine),
    false,
    'a literal reach and an unrelated compound must stay unflagged'
  );
});

// --- Proof case 5: an intentional verb, a missing rule -----------------------

// The reported line. A reviewer caught "advertises" by eye and asked why the
// linter did not. It could not: the phrase was in no wordlist, and C3-08 owns a
// different exception set. This is the regression guard for that answer.
test('C3-18 flags "advertises zero tools", which no check reported before', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const findings = checkAnthropomorphism(doc).filter((f) => /advertise/i.test(f.message));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'C3-18');
  assert.equal(findings[0].tier, 1, 'blocking, so the reported wording cannot ship again');
  assert.equal(findings[0].checkId, 'anthropomorphism');
  assert.equal(findings[0].line, lineOf(doc, 'advertises zero tools'));
  assert.ok(findings[0].falsePositiveNote);
});

test('C3-18 leaves "exposes" and "discovers" alone on the same fixture', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const exemptLine = lineOf(doc, 'exposes the profile');
  assert.notEqual(exemptLine, -1, 'the exemption case must be in the fixture');

  const findings = checkAnthropomorphism(doc);
  assert.equal(
    findings.some((f) => f.line === exemptLine),
    false,
    'the MCP specification\'s own verbs must stay unflagged'
  );
});

// --- Registry wiring ---------------------------------------------------------

test('the registry and the check modules agree', () => {
  assert.deepEqual(validateRegistry(), []);
});

// --- The C7-02 guard ---------------------------------------------------------
//
// C7-02 was tier 2, checkId "duplicate-links", listed in check-sources.json,
// and had never fired once in its life, because heuristic-flags.js emits only
// C5-04. Every existing pairing test passed. It is now tier 3, served by the
// repeatedFact generator, and its rule text is unchanged because the text was
// never the problem.
//
// This cannot be a validateRegistry failure: check-sources' `rules` array is a
// claim about what a check ADDRESSES, not what it EMITS, and several rules
// legitimately share one emitted ID (B1-01, B2-01 and C1-03 all report as
// C1-01). So the list is frozen instead. It may shrink freely. It may not grow
// without someone deciding to grow it here.
const UNEMITTED_BASELINE = [
  'bare-links:B2-08',
  'bare-links:C1-06',
  'bare-links:RS1-04',
  'callout-frequency:B1-08',
  'callout-frequency:B2-04',
  'callout-frequency:C5-01',
  'callout-frequency:C5-03',
  'duplicate-sections:B1-09',
  'duplicate-sections:B2-06',
  'getting-started-specific:RS3-01',
  'getting-started-specific:RS3-02',
  'migration-specific:MIG-02',
  'section-structure:B1-01',
  'section-structure:B2-01',
  'section-structure:C1-03',
  'section-structure:CLI-19',
  'section-structure:MIG-08',
  'section-structure:PLG-05',
];

test('no tier-1 or tier-2 rule newly claims a check that never emits it', () => {
  const actual = unemittedRuleClaims();
  const added = actual.filter((c) => !UNEMITTED_BASELINE.includes(c));

  assert.deepEqual(
    added,
    [],
    `New unemitted rule claim(s): ${added.join(', ')}. A tier-1 or tier-2 rule whose ` +
      'module never emits its ID can never fire, which is how C7-02 shipped dead. Either ' +
      'emit the ID, make the rule tier 3, or add it to UNEMITTED_BASELINE with a reason.'
  );
});

test('the unemitted baseline has no stale entries, so it can only shrink', () => {
  const actual = unemittedRuleClaims();
  const stale = UNEMITTED_BASELINE.filter((c) => !actual.includes(c));
  assert.deepEqual(stale, [], `Fixed, so remove from UNEMITTED_BASELINE: ${stale.join(', ')}`);
});

// --- Proof case 7: a demonstrative pointing forward at an unseen block -------

test('C3-24 flags "this URL" on the line that introduces the block below it', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const findings = checkVagueReference(doc);

  assert.equal(findings.length, 1, 'exactly the one violation, none of the three exemptions');
  assert.equal(findings[0].ruleId, 'C3-24');
  assert.equal(findings[0].tier, 2);
  assert.equal(findings[0].line, lineOf(doc, 'this URL sets a stack'));
});

test('C3-24 leaves a backward demonstrative, a complete set, and an anchor slug alone', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const flagged = new Set(checkVagueReference(doc).map((f) => f.line));

  for (const needle of ['This grants no extra access', 'The following transports', 'the parameter reference']) {
    assert.ok(!flagged.has(lineOf(doc, needle)), `C3-24 must not flag: ${needle}`);
  }
});

test('C3-25 is tier 3, names no check, and its generator asks a question', () => {
  const rule = byId('C3-25');
  assert.equal(rule.tier, 3);
  assert.equal(rule.checkId, null);

  const candidates = collectTier3Candidates(loadFixture('gap-loop-proof.md')).filter(
    (c) => c.generator === 'unanchoredBlockReference'
  );
  for (const c of candidates) {
    assert.equal(c.ruleId, 'C3-25');
    assert.ok(c.decide.endsWith('?'), 'a candidate is a question');
    assert.ok(c.signal, 'a candidate must say why it was selected');
    assert.ok(c.evidence.length > 0);
  }
});

// --- Proof case 8: a lead-in that introduces a block without naming it -------
//
// The reported line was "Several places can set the same value. The highest one
// wins:" above a ranked list. Every wordlist in the corpus missed it, because
// the defect is that nothing in the sentence names the list rather than that
// some flagged word appears in it. C3-24 needs a demonstrative, C3-17 owns the
// "Several" but ships no check, and C3-25 fires only when a block arrives with
// no lead-in at all. C3-26 is the structural answer, and this is its guard.

function leadInCandidates(doc) {
  return collectTier3Candidates(doc).filter((c) => c.generator === 'unnamedLeadInReferent');
}

test('C3-26 flags the lead-in that no wordlist could reach', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const flagged = leadInCandidates(doc);

  const violation = lineOf(doc, 'The highest one wins');
  assert.ok(
    flagged.some((c) => c.line === violation),
    'the reported lead-in must be flagged'
  );

  for (const c of flagged) {
    assert.equal(c.ruleId, 'C3-26');
    assert.equal(c.tier, 3);
    assert.ok(c.decide.endsWith('?'), 'a candidate is a question');
    assert.ok(c.signal, 'a candidate must say why it was selected');
    assert.ok(c.evidence.length > 0);
  }
});

test('C3-26 leaves a lead-in that names or counts what follows alone', () => {
  const doc = loadFixture('gap-loop-proof.md');
  const flagged = new Set(leadInCandidates(doc).map((c) => c.line));

  // Each exemption route, one line apiece: an element noun plus a direction
  // word, a bare direction word, and a count. Without these the rule has
  // nothing stopping the next widening from flagging every colon in the corpus.
  for (const needle of ['The two URLs below set', 'The following transports', 'A setup involves three pieces']) {
    const line = lineOf(doc, needle);
    assert.notEqual(line, -1, `the exemption case must be in the fixture: ${needle}`);
    assert.ok(!flagged.has(line), `C3-26 must not flag: ${needle}`);
  }
});

test('C3-26 reports the raw sentence, so an identifier survives into the judge prompt', () => {
  // stripNonProse blanks code spans before the pointer test, which is right:
  // an identifier must not be able to supply the pointer. The evidence still
  // has to be the sentence the writer wrote, or the judge reads a line with
  // holes in it.
  const doc = new DocModel(
    'inline.md',
    ['# T', '', '## Overview', '', 'Contentstack rejects it and returns `PROFILE_SCOPE_MISMATCH`:', '', '- One', '- Two'].join('\n')
  );

  const flagged = leadInCandidates(doc);
  assert.equal(flagged.length, 1);
  assert.match(flagged[0].evidence[0], /`PROFILE_SCOPE_MISMATCH`/);
});

test('C3-26 ignores a colon that introduces no block', () => {
  // The precision gate. A colon inside running prose promises the reader
  // nothing structural, and flagging it would bury the real cases.
  const doc = new DocModel(
    'inline.md',
    ['# T', '', '## Overview', '', 'The rule is simple:', '', 'Contentstack resolves the stack before the branch.'].join('\n')
  );

  assert.deepEqual(leadInCandidates(doc), []);
});

test('C7-02 is tier 3 and names no check, so it cannot ship dead again', () => {
  const rule = byId('C7-02');
  assert.equal(rule.tier, 3);
  assert.equal(rule.checkId, null);
});

test('nextRuleId computes rather than guessing by category', () => {
  // The failure this guards against is a hand-counted ID that silently reuses
  // one already in the registry, which happened once. So the assertion is the
  // invariant rather than a literal: whatever comes back is free, and it is one
  // past the highest number the prefix has, not one past the count of rules
  // that look related. IDs are dense but never category-semantic.
  //
  // Stated as an invariant on purpose. A literal here has to be edited every
  // time a rule lands, and the edit is indistinguishable from renumbering the
  // new rule to make the old literal pass, which is the bug itself. The two
  // forks that merged into this repo both hand-counted C2-09 and C3-24 and
  // assigned each to a different rule, which is exactly what a literal hides.
  for (const prefix of ['C1', 'C2', 'C3', 'C8', 'FM']) {
    const next = nextRuleId(prefix);
    assert.match(next, new RegExp(`^${prefix}-\\d\\d$`));
    assert.ok(!byId(next), `${next} is already taken`);

    const highest = registry
      .filter((r) => r.id.startsWith(`${prefix}-`))
      .reduce((max, r) => Math.max(max, parseInt(r.id.split('-')[1], 10)), 0);
    assert.equal(
      parseInt(next.split('-')[1], 10),
      highest + 1,
      `${prefix} should continue from ${highest}, not from a category guess`
    );
  }
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
  assert.deepEqual(result.suggestedIds, [nextRuleId('C3')]);
});

test('triageGap does not re-litigate a line an existing check already reports', () => {
  const result = triageGap(
    { existingFindings: [{ ruleId: 'C3-07', checkId: 'sentence-concision', message: 'x' }] },
    [{ ruleId: 'C3-01', checkId: 'banned-phrases', score: 0.9 }]
  );
  assert.equal(result.classification, 'NOT_A_GAP');
});
