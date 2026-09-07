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
const { reconcile, toFindings, validateVerdictReply, mergeVerdicts } = require('../review-candidates');
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

test('enumerationCompleteness surfaces a coordinated list after an edit verb', () => {
  const doc = new DocModel('enum.md', [
    '# T',
    '',
    '## Edit a profile',
    '',
    'Reopen a profile to change its tools or configuration.',
    '',
    'Click **Save** to store the change.',
    '',
    'Adjust the timeout, for example the read or write value.',
  ].join('\n'));
  const hits = collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-16');
  assert.equal(hits.length, 1, 'only the unmarked coordinated list is a candidate');
  assert.equal(hits[0].line, 5);
  assert.ok(hits[0].signal.includes('tools or configuration'));
});

test('vagueQuantifier surfaces prose only, not table rows or callouts', () => {
  const doc = new DocModel('quant.md', [
    '# T',
    '',
    '## Behavior',
    '',
    'Most clients list the connected server once sign-in completes.',
    '',
    '| Client | Notes |',
    '| --- | --- |',
    '| Cursor | Most tools appear |',
    '',
    '> **Note:** Most clients reconnect on their own.',
  ].join('\n'));
  const hits = collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-17');
  assert.equal(hits.length, 1, 'the table row and the callout are out of scope');
  assert.equal(hits[0].line, 5);
});

test('vagueQuantifier does not report an exact bound as a hedge', () => {
  const doc = new DocModel('bounds.md', [
    '# T',
    '',
    '## Limitations',
    '',
    '- A profile can hold at most 200 tools.',
    '- An organization can hold at least one profile.',
  ].join('\n'));
  assert.equal(collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-17').length, 0);
});

// --- C6-05, the Overview opener ---------------------------------------------

function overviewDoc(opener) {
  return new DocModel('opener.md', ['# Manage profiles', '', '## Overview', '', opener].join('\n'));
}

function openerHits(opener) {
  return collectTier3Candidates(overviewDoc(opener)).filter((c) => c.ruleId === 'C6-05');
}

test('overviewOpenerTopicFirst surfaces an opener that leads with another page topic', () => {
  const hits = openerHits('Beyond creating a profile, you can duplicate one and export it as JSON.');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 5);
  assert.match(hits[0].signal, /"Beyond"/);
});

test('overviewOpenerTopicFirst surfaces a topic that lands only after a result clause', () => {
  const hits = openerHits(
    'An AI client stores one connector URL and posts to it for every call, so the query string acts as configuration.'
  );
  assert.equal(hits.length, 1);
  assert.match(hits[0].signal, /result clause/);
});

test('overviewOpenerTopicFirst leaves a direct opener alone', () => {
  assert.equal(openerHits('This page covers duplicating a profile, exporting it, and importing it.').length, 0);
  assert.equal(openerHits('A profile is a named bundle of Contentstack tools.').length, 0);
  // A trailing coordination continues a list rather than deferring the subject.
  assert.equal(
    openerHits('This page covers the query parameters on a connector URL, and the order Contentstack resolves them in.').length,
    0
  );
});

// --- C4-08, a bolded icon name ----------------------------------------------

const ICON_DOC = [
  '# Manage profiles',
  '',
  '## Where the controls are',
  '',
  'Hover a profile card to reveal its icons:',
  '',
  '| Icon | Tooltip |',
  '| --- | --- |',
  '| Export | **Export JSON** |',
  '',
  '## Export a profile',
  '',
  'Hover the profile card and click **Export JSON**.',
  '',
  'Click **New Profile** to start a profile from scratch.',
].join('\n');

test('hoverIconBoldLabel surfaces a bolded icon name in prose, not the table documenting its tooltip', () => {
  const hits = collectTier3Candidates(new DocModel('icons.md', ICON_DOC)).filter((c) => c.ruleId === 'C4-08');
  const lines = hits.map((h) => h.line);
  assert.ok(lines.includes(13), 'the prose instruction naming the icon is a candidate');
  assert.ok(!lines.includes(9), 'the table row quoting the literal tooltip is covered by the exception');
  assert.ok(!lines.includes(15), 'a button with a visible label sits on a line with no hover or icon cue');
});

test('hoverIconBoldLabel carries the table header, so a tooltip column reads as a tooltip', () => {
  const hit = collectTier3Candidates(new DocModel('icons.md', ICON_DOC))
    .filter((c) => c.ruleId === 'C4-08')
    .find((c) => c.line === 13);
  // Without the header, the row reads as proof of a visible label and inverts
  // the judgment it was gathered to inform.
  assert.ok(hit.evidence.some((e) => /columns: Icon \| Tooltip/.test(e)));
});

// --- C3-20, a gerund holding the subject slot --------------------------------

function gerundHits(...bodyLines) {
  const doc = new DocModel('gerund.md', ['# Manage profiles', '', '## Duplicate a profile', '', ...bodyLines].join('\n'));
  return collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-20');
}

test('gerundSubjectActor nominates a gerund that opens the sentence', () => {
  const hits = gerundHits('Omitting it uses the configured stack.');
  assert.equal(hits.length, 1);
  assert.match(hits[0].signal, /"Omitting" holds the subject slot and opens the sentence/);
});

test('gerundSubjectActor nominates a gerund after a pivot conjunction', () => {
  const hits = gerundHits('Contentstack writes nothing until you save, so clicking Duplicate does not create a profile.');
  assert.equal(hits.length, 1);
  assert.match(hits[0].signal, /follows a pivot conjunction/);
});

test('gerundSubjectActor carries the preceding line, where the actor often sits', () => {
  // connect-a-client.md:71 is this exact shape: the actor is named in the
  // clause before, which is what separates a hidden actor from a concept.
  const hits = gerundHits(
    'Contentstack pins the version in the snippet.',
    '',
    'Pinning that version is deliberate.'
  );
  assert.equal(hits.length, 1);
  assert.ok(hits[0].evidence.some((e) => /Preceding line: Contentstack pins/.test(e)));
});

test('gerundSubjectActor deliberately nominates the good ones too, for the judge to clear', () => {
  // "Duplicating copies a profile" is correct prose. The generator cannot tell
  // it from line 44, so it must reach the judge rather than be filtered here.
  assert.equal(gerundHits('Duplicating copies a profile into a new custom profile you own.').length, 1);
});

// --- The judge contract ------------------------------------------------------

const JUDGE_CANDIDATE = { exception: 'A table documenting the literal tooltip keeps bold.' };

test('a verdict reply is rejected unless it could survive reconcile', () => {
  const bad = [
    ['not json at all', /one JSON object/],
    ['["a"]', /single JSON object/],
    ['{"verdict":"MAYBE","reason":"x"}', /must be one of/],
    ['{"verdict":"COMPLIANT"}', /needs a reason/],
    ['{"verdict":"VIOLATION","reason":"x"}', /must carry a fix/],
    ['{"verdict":"EXCEPTION_APPLIES","reason":"x","exceptionQuoted":"invented"}', /quote the rule exception/],
  ];
  for (const [reply, expected] of bad) {
    assert.match(validateVerdictReply(reply, JUDGE_CANDIDATE) || '', expected, `should reject: ${reply}`);
  }

  assert.equal(validateVerdictReply('{"verdict":"COMPLIANT","reason":"Names a screen."}', JUDGE_CANDIDATE), null);
  assert.equal(
    validateVerdictReply('{"verdict":"VIOLATION","reason":"No label.","fix":"Use quotes."}', JUDGE_CANDIDATE),
    null
  );
});

test('judging part of the list keeps the verdicts the run did not reach', () => {
  const merged = mergeVerdicts(
    { verdicts: [{ candidateId: 'a', verdict: 'COMPLIANT', reason: 'old' }, { candidateId: 'b', verdict: 'UNCLEAR', reason: 'old' }] },
    { judgedAt: 'now', verdicts: [{ candidateId: 'b', verdict: 'VIOLATION', reason: 'new', fix: 'f' }] }
  );
  assert.equal(merged.verdicts.length, 2);
  assert.equal(merged.verdicts.find((v) => v.candidateId === 'a').reason, 'old');
  assert.equal(merged.verdicts.find((v) => v.candidateId === 'b').verdict, 'VIOLATION');
});

// --- C3-21: house verbs ------------------------------------------------------

test('houseVerbTone emits a C3-21 candidate on a house verb in running prose', () => {
  const doc = new DocModel(
    'inline.md',
    ['# T', '', '## Overview', '', 'A profile holds an enabled flag and carries a description.'].join('\n')
  );
  const candidates = collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-21');

  assert.equal(candidates.length, 1, 'one sentence is one question, not one per verb');
  assert.equal(candidates[0].generator, 'houseVerbTone');
  assert.equal(candidates[0].tier, 3);
  assert.match(candidates[0].signal, /hold/);
  assert.match(candidates[0].signal, /carry/, 'both matched verbs travel together in the evidence');
  assert.match(candidates[0].decide, /\?$/);
});

test('houseVerbTone caps at one candidate per sentence, so the judge is billed once', () => {
  const doc = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Overview',
      '',
      'A profile holds a flag. The export carries no credentials. The message names the path.',
    ].join('\n')
  );
  const candidates = collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-21');
  assert.equal(candidates.length, 3, 'three sentences on one line are three separate questions');
});

test('houseVerbTone skips table rows, callouts, and headings', () => {
  const doc = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Overview',
      '',
      '| Field | Holds |',
      '| --- | --- |',
      '| Status | What the call holds |',
      '',
      '> **Note:** the directory holds cached credentials.',
      '',
      '### What the profile holds',
    ].join('\n')
  );
  assert.deepEqual(
    collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-21'),
    []
  );
});

// --- C5-06: an instruction with no destination -------------------------------

test('missingDestination flags a handoff with no destination after the verb', () => {
  const doc = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Troubleshooting',
      '',
      '**Resolution**: Install the package from an approved registry, or ask IT to allowlist it.',
    ].join('\n')
  );
  const candidates = collectTier3Candidates(doc).filter((c) => c.ruleId === 'C5-06');

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].generator, 'missingDestination');
  assert.equal(candidates[0].tier, 3);
  assert.match(candidates[0].decide, /\?$/);
  // The bug this guards: `**Resolution**` is bold, and an earlier version
  // counted any bolded span as the destination, so a Resolution block could
  // never be flagged at all.
  assert.match(candidates[0].signal, /no link, URL, mailto, or bolded screen name/);
});

test('missingDestination requires the destination to follow the handoff verb', () => {
  // The real corpus case: the line links what "disabled" means, then abandons
  // the reader on the support request. A whole-line veto reads that as fine.
  const doc = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Troubleshooting',
      '',
      '2. Contentstack has probably [disabled the profile](/developers/x), so raise a support request.',
    ].join('\n')
  );
  const candidates = collectTier3Candidates(doc).filter((c) => c.ruleId === 'C5-06');
  assert.equal(candidates.length, 1, 'a link before the verb does not satisfy the instruction');
});

test('missingDestination leaves an instruction that carries its destination alone', () => {
  const doc = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Troubleshooting',
      '',
      '**Resolution**: Contact [Contentstack support](mailto:support@contentstack.com) to re-enable it.',
      '',
      '1. Confirm the plan on the **Org Settings** screen.',
    ].join('\n')
  );
  assert.deepEqual(
    collectTier3Candidates(doc).filter((c) => c.ruleId === 'C5-06'),
    []
  );
});

test('missingDestination ignores a symptom heading and a descriptive sentence', () => {
  // Both were concrete false positives in the tier-2 dry run that led to this
  // rule being tier 3 instead.
  const doc = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Overview',
      '',
      '### The client asks you to authorize repeatedly',
      '',
      'A wider selection asks the user to approve more access at connect time.',
    ].join('\n')
  );
  assert.deepEqual(
    collectTier3Candidates(doc).filter((c) => c.ruleId === 'C5-06'),
    []
  );
});

// --- C3-22: a contrastive connective joining clauses that agree --------------

test('falseContrast flags a mid-sentence but joining two clauses', () => {
  const doc = new DocModel(
    'inline.md',
    ['# T', '', '## Overview', '', 'The flag lives on the endpoint, but that endpoint is internal to the app.'].join('\n')
  );
  const candidates = collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-22');

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].generator, 'falseContrast');
  assert.match(candidates[0].signal, /"but"/);
  assert.match(candidates[0].decide, /opposite directions\?$/);
});

test('falseContrast does not fire on a sentence-initial But, which C3-15 owns', () => {
  const doc = new DocModel('inline.md', ['# T', '', '## Overview', '', 'But the endpoint is internal.'].join('\n'));
  assert.deepEqual(
    collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-22'),
    []
  );
});

// --- C7-06 and C7-02: the same fact stated more than once -------------------

test('repeatedFact groups every occurrence into one candidate, not a pair', () => {
  const fact = 'The app has no control for this flag and no supported way to set it';
  const doc = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Where the controls are',
      '',
      `${fact} anywhere.`,
      '',
      '## Enable and disable',
      '',
      `${fact} at all.`,
      '',
      '## Limitations',
      '',
      `${fact} in the app.`,
    ].join('\n')
  );
  const candidates = collectTier3Candidates(doc).filter((c) => c.ruleId === 'C7-06');

  assert.equal(candidates.length, 1, 'three occurrences are one question, not three pairs');
  assert.equal(candidates[0].generator, 'repeatedFact');
  assert.equal(candidates[0].evidence.length, 3, 'every occurrence travels in the evidence');
  assert.match(candidates[0].signal, /3 places/);
});

test('repeatedFact also covers C7-02 when one occurrence is in Prerequisites', () => {
  // C7-02's narrower claim, which it described correctly and never once fired
  // on, because its checkId named a module that emits only C5-04.
  const fact = 'You need the organization role that permits creating and deleting profiles';
  const doc = new DocModel(
    'inline.md',
    ['# T', '', '## Prerequisites', '', `- ${fact}.`, '', '## Delete a profile', '', `${fact} here too.`].join('\n')
  );
  const candidates = collectTier3Candidates(doc).filter((c) => c.ruleId === 'C7-06');

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].alsoCovers, ['C7-02']);
});

test('repeatedFact leaves distinct sentences alone', () => {
  const doc = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Overview',
      '',
      'The runtime validates the token and resolves the configured stack.',
      '',
      'An export carries no credentials and no stack binding whatsoever.',
    ].join('\n')
  );
  assert.deepEqual(
    collectTier3Candidates(doc).filter((c) => c.ruleId === 'C7-06'),
    []
  );
});

// --- C3-23: a documented concept described instead of named -----------------

test('circledConcept flags a described concept and stops once it is named', () => {
  // The gap this closes: C3-09 is concept-general in its rule text but its
  // wordlist holds one file about pagination, so a periphrastic description of
  // a token could never match an entry. This works from the concept side.
  const described = new DocModel(
    'inline.md',
    [
      '# T',
      '',
      '## Overview',
      '',
      'It authenticates with a short-lived token the dashboard issues for its own use.',
    ].join('\n')
  );
  const hits = collectTier3Candidates(described).filter((c) => c.ruleId === 'C3-23');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].generator, 'circledConcept');
  assert.match(hits[0].signal, /auth token/);
  assert.match(hits[0].decide, /\?$/);

  // Naming the concept must silence it, or the generator re-flags every
  // sentence it already caused someone to fix.
  const named = new DocModel(
    'inline.md',
    ['# T', '', '## Overview', '', 'It authenticates with a temporary auth token.'].join('\n')
  );
  assert.deepEqual(
    collectTier3Candidates(named).filter((c) => c.ruleId === 'C3-23'),
    []
  );
});

test('circledConcept does not fire on the ordinary word "credentials"', () => {
  // It did, on "cached MCP credentials" and "carries no credentials". A bare
  // common noun is not a periphrasis for a named token type.
  for (const line of [
    'Clear the cached MCP credentials and reconnect.',
    'An export carries no credentials and no stack binding.',
  ]) {
    const doc = new DocModel('inline.md', ['# T', '', '## Overview', '', line].join('\n'));
    assert.deepEqual(
      collectTier3Candidates(doc).filter((c) => c.ruleId === 'C3-23'),
      [],
      `must not fire: ${line}`
    );
  }
});

test('C3-23 is tier 3 with no checkId, so it cannot claim C3-09s check', () => {
  // C3-09 is tier 2 with a working pagination wordlist. A tier-3 candidate
  // claiming C3-09 would report tier 3 while the registry says tier 2.
  const rule = byId('C3-23');
  assert.equal(rule.tier, 3);
  assert.equal(rule.checkId, null);
  assert.equal(byId('C3-09').tier, 2, 'C3-09 keeps its own tier-2 check');
  assert.match(rule.exception, /C3-09 covers the narrower case/);
});
