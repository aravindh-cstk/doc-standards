'use strict';

/**
 * Unit tests for audit-wordlists.js and lib/inflect.js. Nothing here shells out
 * to the `claude` CLI: the validator, the generator, the compiler, and the
 * gates are all pure, which is why main() is the only caller of askClaude.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateAuditReply, runGates, buildProposal, entryCacheKey, LETTERS, NEW_HIT_ALARM } = require('../audit-wordlists');
const { siblingsOf, compileWidening, uncoveredSiblings } = require('../lib/inflect');

function itemOf(phrase, forms) {
  return {
    dataFile: 'data/x/y.json',
    entryIndex: 0,
    ruleId: 'C8-03',
    phrase,
    fix: 'name the concrete outcome',
    candidates: forms.map((form) => ({ form, class: 'VERB_INFLECTION', safety: 'LIKELY', stem: phrase, tokenIndex: 0 })),
  };
}

function reply(rows) {
  return JSON.stringify(rows);
}

// --- The reply contract ------------------------------------------------------

test('a non-JSON reply is rejected', () => {
  assert.match(validateAuditReply('sure', [itemOf('unlock', ['unlocks'])]), /must be one JSON array/);
});

test('a reply with the wrong object count is rejected, with both counts named', () => {
  // The arithmetic guard. A model that skips entry 2 is caught by counting.
  const batch = [itemOf('unlock', ['unlocks']), itemOf('empower', ['empowers'])];
  const violation = validateAuditReply(reply([{ n: 1, accept: ['a'], reject: [] }]), batch);
  assert.match(violation, /expected exactly 2 objects/);
  assert.match(violation, /got 1/);
});

test('a candidate left neither accepted nor rejected is rejected', () => {
  // The strongest constraint in this validator, and it has no analogue in
  // judge-tone.js: accept and reject must PARTITION the candidate letters. A
  // per-object count would miss a silently skipped candidate entirely.
  const batch = [itemOf('unlock', ['unlocks', 'unlocked', 'unlocking'])];
  const violation = validateAuditReply(reply([{ n: 1, accept: ['a'], reject: [{ id: 'b', why: 'x' }] }]), batch);
  assert.match(violation, /candidate c was neither accepted nor rejected/);
});

test('a candidate in both accept and reject is rejected', () => {
  const batch = [itemOf('unlock', ['unlocks', 'unlocked'])];
  const violation = validateAuditReply(
    reply([{ n: 1, accept: ['a', 'b'], reject: [{ id: 'b', why: 'x' }] }]),
    batch
  );
  assert.match(violation, /appears in both accept and reject/);
});

test('an invented candidate letter is rejected', () => {
  const batch = [itemOf('unlock', ['unlocks'])];
  assert.match(
    validateAuditReply(reply([{ n: 1, accept: ['z'], reject: [] }]), batch),
    /candidate z is not one of a/
  );
});

test('a rejection without a reason is rejected', () => {
  const batch = [itemOf('unlock', ['unlocks'])];
  assert.match(validateAuditReply(reply([{ n: 1, accept: [], reject: [{ id: 'a' }] }]), batch), /needs a "why"/);
});

test('accepting nothing is valid but must be argued', () => {
  // "No siblings" must stay a first-class answer for a file like
  // product-defect.json, whose entries are verbatim sentence fragments. But it
  // is also what a lazy reply looks like, so it needs a note.
  const batch = [itemOf('just', ['justs'])];
  assert.match(
    validateAuditReply(reply([{ n: 1, accept: [], reject: [{ id: 'a', why: 'not a word' }] }]), batch),
    /needs a "note"/
  );
  assert.equal(
    validateAuditReply(
      reply([{ n: 1, accept: [], reject: [{ id: 'a', why: 'not a word' }], note: 'a minimizer has one form' }]),
      batch
    ),
    null
  );
});

test('a well-formed reply is accepted', () => {
  const batch = [itemOf('unlock', ['unlocks', 'unlocked'])];
  assert.equal(
    validateAuditReply(reply([{ n: 1, accept: ['a', 'b'], reject: [] }]), batch),
    null
  );
});

// --- The model never writes a regex ------------------------------------------

test('the reply carries only candidate letters, never a pattern', () => {
  // The anti-hallucination device: the model picks from a closed set the
  // generator produced, so it cannot propose a sibling that does not exist.
  // compileWidening turns letters into a regex, in Node.
  const batch = [itemOf('unlock', ['unlocks', 'unlocked', 'unlocking'])];
  const answer = { n: 1, accept: ['a', 'b', 'c'], reject: [] };
  assert.equal(validateAuditReply(reply([answer]), batch), null);

  const proposal = buildProposal(batch[0], answer, { corpus: null, allEntries: [], withProbe: false });
  assert.equal(proposal.with.pattern, '\\bunlock(s|ed|ing)?\\b');
  assert.equal(proposal.with.label, 'unlock', 'a pattern entry must always carry a label');
  assert.equal(proposal.with.fix, batch[0].fix, 'the remedy is copied verbatim, never regenerated');
});

test('a proposal replaces the entry rather than adding one', () => {
  // Two entries, a literal and a pattern that subsumes it, would double-report
  // the same line, which doc-gap.md Step 2 forbids.
  const batch = [itemOf('unlock', ['unlocks'])];
  const proposal = buildProposal(batch[0], { n: 1, accept: ['a'], reject: [] }, { allEntries: [], withProbe: false });
  assert.equal(proposal.replace.phrase, 'unlock');
  assert.equal(typeof proposal.entryIndex, 'number');
  assert.equal(proposal.promoted, false, 'nothing is promoted automatically');
});

// --- Gates -------------------------------------------------------------------

test('the superset gate blocks a widening that drops its own input', () => {
  const item = itemOf('unlock', ['unlocks']);
  const bogus = { pattern: '\\bunlocks\\b', covers: ['unlocks'] };
  const gates = runGates(item, bogus, { allEntries: [], withProbe: false });
  assert.equal(gates.verdict, 'BLOCKED_NOT_SUPERSET');
  assert.deepEqual(gates.lostFromOldPattern, ['unlock']);
});

test('the cross-rule gate blocks a widening another rule already owns', () => {
  // The data version of the mistake validateRegistry blocks in code. Found
  // "seamless" and "powerful" owned by both C8-01 and C3-03 in the real tree.
  const item = itemOf('unlock', ['unlocks']);
  const widened = compileWidening('unlock', ['unlocks']);
  const gates = runGates(item, widened, {
    allEntries: [{ ruleId: 'C3-03', phrase: 'unlocks', label: 'unlocks' }],
    withProbe: false,
  });
  assert.equal(gates.verdict, 'BLOCKED_CROSS_RULE');
  assert.match(gates.crossRuleOverlap[0], /already owned by C3-03/);
});

test('an uncompilable pattern is blocked and withheld', () => {
  const item = itemOf('unlock', ['unlocks']);
  const gates = runGates(item, { pattern: '\\b(unclosed', covers: ['unlocks'] }, { allEntries: [], withProbe: false });
  assert.equal(gates.verdict, 'BLOCKED_UNCOMPILABLE');
  assert.equal(gates.compiles, false);
});

test('a clean widening is READY, never "promote it"', () => {
  const item = itemOf('unlock', ['unlocks']);
  const gates = runGates(item, compileWidening('unlock', ['unlocks']), { allEntries: [], withProbe: false });
  assert.equal(gates.verdict, 'READY');
  assert.ok(NEW_HIT_ALARM > 0, 'a widening firing many new times must demand a read');
});

// --- Cache -------------------------------------------------------------------

test('the cache key covers the candidate set, so a new sibling class re-bills', () => {
  // Keying on the phrase alone would serve a verdict reached without the
  // candidate the new class produced.
  const a = entryCacheKey(itemOf('unlock', ['unlocks']));
  const b = entryCacheKey(itemOf('unlock', ['unlocks', 'unlocking']));
  assert.notEqual(a, b);
  assert.equal(a, entryCacheKey(itemOf('unlock', ['unlocks'])));
});

// --- The generator and compiler ----------------------------------------------

test('compileWidening produces the house style already used in this tree', () => {
  assert.equal(compileWidening('reach for', ['reaches for', 'reached for', 'reaching for']).pattern,
    '\\breach(es|ed|ing)? for\\b');
  assert.equal(compileWidening('production-ready', ['production ready', 'productionready']).pattern,
    '\\bproduction[- ]?ready\\b');
});

test('compileWidening never returns a pattern that drops a form it claims', () => {
  // The compiler self-checks before returning, because a compiler that loses
  // its own input is the bug the superset gate exists to catch downstream, and
  // catching it here is free. Unrelated forms fall through to an alternation
  // rather than throwing, which is correct: the alternation still matches
  // everything claimed.
  for (const [phrase, forms] of [
    ['unlock', ['unlocks', 'unlocked', 'unlocking']],
    ['unlock', ['completely-unrelated']],
    ['production-ready', ['production ready', 'productionready']],
    ['reach for', ['reaches for', 'reaching for']],
  ]) {
    const w = compileWidening(phrase, forms);
    const re = new RegExp(w.pattern, 'i');
    assert.ok(re.test(phrase), `${w.pattern} must still match its own original "${phrase}"`);
    for (const f of forms) assert.ok(re.test(f), `${w.pattern} must match the form it claims: ${f}`);
  }
});

test('the object generalization emits one candidate, never a wildcard object', () => {
  // "raise the value" under C3-01 is the only such entry in the tree, and the
  // miss it caused was "raise a support request". A wildcard object regex is
  // how a widening fires forty times on a clean corpus.
  const forms = siblingsOf('raise the value').filter((s) => s.class === 'OBJECT_GENERALIZATION');
  assert.equal(forms.length, 1);
  assert.equal(forms[0].form, 'raise');
  assert.equal(forms[0].safety, 'NOISY');
});

test('uncoveredSiblings drops a form a sibling pattern in the same rule already matches', () => {
  const entry = { phrase: 'reach for', ruleId: 'C3-01' };
  const siblings = siblingsOf('reach for');
  const withCover = uncoveredSiblings(entry, siblings, [
    entry,
    { pattern: '\\breach(es|ed|ing)? for\\b', label: 'reach for', ruleId: 'C3-01' },
  ]);
  assert.deepEqual(withCover.filter((s) => s.class === 'VERB_INFLECTION'), []);
});
