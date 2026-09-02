'use strict';

/**
 * Tests for the tier-3 candidate layer and its script-to-agent contract.
 *
 * The candidates themselves are questions, so there is no right answer to
 * assert. What must hold is the contract: every candidate carries enough
 * evidence to judge without reopening the file, and reconcile refuses a review
 * that is silently incomplete.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { DocModel } = require('../lib/doc-model');
const { collectTier3Candidates } = require('../checks/tier3-candidates');
const { reconcile, toFindings } = require('../review-candidates');
const { byId } = require('../lib/rules-registry');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

test('every candidate carries what a reviewer needs to judge it', () => {
  const candidates = collectTier3Candidates(loadFixture('gap-loop-proof.md'));
  assert.ok(candidates.length > 0, 'the fixture should produce candidates');

  for (const c of candidates) {
    assert.ok(c.candidateId, 'candidateId is the join key with the verdicts file');
    assert.equal(c.tier, 3);
    assert.ok(c.decide && c.decide.endsWith('?'), `${c.candidateId} must ask a question`);
    assert.ok(Array.isArray(c.evidence) && c.evidence.length > 0, `${c.candidateId} must carry evidence`);
    assert.ok(c.signal, `${c.candidateId} must say why it was selected`);
    assert.ok(byId(c.ruleId), `${c.candidateId} must name a real registry rule`);
    assert.ok(typeof c.line === 'number' && c.line > 0);
  }
});

test('candidates never claim a tier the lint pipeline would act on', () => {
  const candidates = collectTier3Candidates(loadFixture('gap-loop-proof.md'));
  // A candidate is a question. If any of these came back tier 1 or 2 it would
  // flow into an exit code and turn an open question into a build failure.
  assert.ok(candidates.every((c) => c.tier === 3));
});

test('candidateId is stable across regenerations of the same file', () => {
  const a = collectTier3Candidates(loadFixture('gap-loop-proof.md')).map((c) => c.candidateId);
  const b = collectTier3Candidates(loadFixture('gap-loop-proof.md')).map((c) => c.candidateId);
  assert.deepEqual(a, b);
});

// --- The reconcile contract --------------------------------------------------

const CANDIDATES = {
  candidates: [
    { candidateId: 'C6-01:a.md:10', ruleId: 'C6-01', file: 'a.md', line: 10, exception: 'None.' },
    { candidateId: 'C2-01:a.md:20', ruleId: 'C2-01', file: 'a.md', line: 20, exception: 'Narrative-dependent items.' },
  ],
};

function verdicts(list) {
  return { verdicts: list };
}

test('reconcile refuses a review that skipped candidates', () => {
  const r = reconcile(CANDIDATES, verdicts([
    { candidateId: 'C6-01:a.md:10', verdict: 'COMPLIANT', reason: 'Heading matches.' },
  ]));
  assert.equal(r.unjudged, 1);
  assert.ok(r.problems.some((p) => p.includes('Unjudged candidate C2-01:a.md:20')));
});

test('reconcile requires a fix on a VIOLATION and a reason on everything', () => {
  const r = reconcile(CANDIDATES, verdicts([
    { candidateId: 'C6-01:a.md:10', verdict: 'VIOLATION', reason: 'Names the wrong thing.' },
    { candidateId: 'C2-01:a.md:20', verdict: 'COMPLIANT' },
  ]));
  assert.ok(r.problems.some((p) => p.includes('must carry a fix')));
  assert.ok(r.problems.some((p) => p.includes('needs a reason')));
});

test('reconcile makes EXCEPTION_APPLIES quote the rule it invokes', () => {
  const bad = reconcile(CANDIDATES, verdicts([
    { candidateId: 'C6-01:a.md:10', verdict: 'COMPLIANT', reason: 'ok' },
    { candidateId: 'C2-01:a.md:20', verdict: 'EXCEPTION_APPLIES', reason: 'ok', exceptionQuoted: 'invented text' },
  ]));
  assert.ok(bad.problems.some((p) => p.includes('must quote the rule')));

  const good = reconcile(CANDIDATES, verdicts([
    { candidateId: 'C6-01:a.md:10', verdict: 'COMPLIANT', reason: 'ok' },
    { candidateId: 'C2-01:a.md:20', verdict: 'EXCEPTION_APPLIES', reason: 'ok', exceptionQuoted: 'Narrative-dependent' },
  ]));
  assert.deepEqual(good.problems, []);
});

test('reconcile rejects an unknown verdict value and a stale candidateId', () => {
  const r = reconcile(CANDIDATES, verdicts([
    { candidateId: 'C6-01:a.md:10', verdict: 'MAYBE', reason: 'ok' },
    { candidateId: 'C2-01:a.md:20', verdict: 'COMPLIANT', reason: 'ok' },
    { candidateId: 'C9-04:gone.md:1', verdict: 'COMPLIANT', reason: 'ok' },
  ]));
  assert.ok(r.problems.some((p) => p.includes('is not one of')));
  assert.ok(r.problems.some((p) => p.includes('unknown candidate')));
});

test('confirmed violations render as findings for the existing report pipeline', () => {
  const findings = toFindings(CANDIDATES, verdicts([
    { candidateId: 'C6-01:a.md:10', verdict: 'VIOLATION', reason: 'Names the wrong thing.', fix: 'Rename it.' },
    { candidateId: 'C2-01:a.md:20', verdict: 'COMPLIANT', reason: 'Fine.' },
  ]));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'C6-01');
  assert.equal(findings[0].tier, 3);
  assert.equal(findings[0].line, 10);
  assert.match(findings[0].message, /Rename it\./);
});
