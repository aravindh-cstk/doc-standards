'use strict';

/**
 * Unit tests for judge-tone.js. Nothing here shells out to the `claude` CLI:
 * every function under test is pure, which is why main() is the only caller of
 * askClaude in that file.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeSentence,
  cacheKey,
  batchRows,
  validateBatchReply,
  buildBatchPrompt,
  rowsFromCandidates,
  validateDiscoverReply,
  findFixViolation,
  findPreservationViolation,
  PROMPT_VERSION,
} = require('../judge-tone');
const { byId } = require('../lib/rules-registry');

const RULE = byId('C3-21');

function batchOf(...sentences) {
  return sentences.map((sentence, i) => ({
    candidateId: `C3-21:f.md:${i + 1}`,
    sentence,
    verbs: ['hold'],
    suggestedFix: 'say contains',
  }));
}

function reply(rows) {
  return JSON.stringify(rows);
}

// --- The batch reply contract ------------------------------------------------

test('a non-JSON reply is rejected', () => {
  const batch = batchOf('A profile holds an enabled flag.');
  assert.match(validateBatchReply('sure, here you go', batch, RULE), /must be one JSON array/);
});

test('a JSON object rather than an array is rejected', () => {
  const batch = batchOf('A profile holds an enabled flag.');
  assert.match(validateBatchReply('{"n":1}', batch, RULE), /must be a JSON array/);
});

test('a short reply is rejected and the message names both counts', () => {
  // The arithmetic guard. This is what makes batching safe at all: a model that
  // skips a row is caught by counting, not by a silently short verdict list.
  const batch = batchOf('one holds.', 'two holds.', 'three holds.');
  const violation = validateBatchReply(
    reply([
      { n: 1, verdict: 'COMPLIANT', reason: 'r' },
      { n: 2, verdict: 'COMPLIANT', reason: 'r' },
    ]),
    batch,
    RULE
  );
  assert.match(violation, /expected exactly 3 objects/);
  assert.match(violation, /got 2/);
});

test('a duplicated sentence number is rejected even when the count is right', () => {
  // A count alone would let this through, which is why the multiset is checked.
  const batch = batchOf('one holds.', 'two holds.');
  const violation = validateBatchReply(
    reply([
      { n: 1, verdict: 'COMPLIANT', reason: 'r' },
      { n: 1, verdict: 'COMPLIANT', reason: 'r' },
    ]),
    batch,
    RULE
  );
  assert.match(violation, /appears more than once/);
});

test('an out-of-range sentence number is rejected', () => {
  const batch = batchOf('one holds.');
  assert.match(
    validateBatchReply(reply([{ n: 7, verdict: 'COMPLIANT', reason: 'r' }]), batch, RULE),
    /between 1 and 1/
  );
});

test('an unknown verdict value is rejected', () => {
  const batch = batchOf('one holds.');
  assert.match(validateBatchReply(reply([{ n: 1, verdict: 'MAYBE', reason: 'r' }]), batch, RULE), /must be one of/);
});

test('a VIOLATION without a fix is rejected', () => {
  const batch = batchOf('A profile holds an enabled flag.');
  assert.match(
    validateBatchReply(reply([{ n: 1, verdict: 'VIOLATION', reason: 'r' }]), batch, RULE),
    /must carry a fix/
  );
});

test('EXCEPTION_APPLIES must quote the registry exception verbatim', () => {
  // The allowlist is machine-enforced rather than advisory: the only text the
  // model may exempt with is the rule's own exception, read from the registry.
  // If someone edits the allowlist out of C3-21, this test fails.
  const batch = batchOf('The runtime exposes the profile tools.');
  const bad = validateBatchReply(
    reply([{ n: 1, verdict: 'EXCEPTION_APPLIES', reason: 'r', exceptionQuoted: 'because I said so' }]),
    batch,
    RULE
  );
  assert.match(bad, /quote the rule exception verbatim/);

  const good = validateBatchReply(
    reply([{ n: 1, verdict: 'EXCEPTION_APPLIES', reason: 'r', exceptionQuoted: 'a server exposes tools' }]),
    batch,
    RULE
  );
  assert.equal(good, null);
  assert.ok(RULE.exception.includes('a server exposes tools'), 'the exception text is load-bearing at runtime');
});

test('a well-formed batch reply is accepted', () => {
  const batch = batchOf('A profile holds an enabled flag.', 'The export carries no credentials.');
  const violation = validateBatchReply(
    reply([
      { n: 1, verdict: 'VIOLATION', reason: 'holds is vague here', fix: 'A profile has an enabled flag.' },
      { n: 2, verdict: 'COMPLIANT', reason: 'carries reads correctly for a file payload' },
    ]),
    batch,
    RULE
  );
  assert.equal(violation, null);
});

// --- Rewrite safety ----------------------------------------------------------

test('a fix carrying a dash or semicolon is rejected', () => {
  const original = 'A profile holds an enabled flag today.';
  assert.match(findFixViolation('A profile has an enabled flag; it is set.', original), /semicolon/);
  assert.match(findFixViolation('A profile has an enabled flag — always.', original), /dash/);
});

test('a fix that trades one violation for another is rejected', () => {
  const original = 'A profile holds an enabled flag today okay.';
  // "advertises" is C3-18, so a rewrite cannot swap a house verb for it.
  assert.match(findFixViolation('A profile advertises an enabled flag today.', original), /anthropomorphic/i);
});

test('a fix that drops half the sentence is rejected', () => {
  const original = 'A profile contains an enabled flag that Contentstack reads on every call.';
  assert.match(findFixViolation('It has a flag.', original), /shorter or longer/);
});

// --- Cache key ---------------------------------------------------------------

test('whitespace, markup, and inline code do not change the cache key', () => {
  const a = 'A profile   **holds** an `enabled` flag.';
  const b = 'A profile holds an   flag.';
  assert.equal(cacheKey(a, 'C3-21'), cacheKey(b, 'C3-21'));
});

test('changing one word changes the cache key', () => {
  assert.notEqual(
    cacheKey('A profile holds an enabled flag.', 'C3-21'),
    cacheKey('A profile contains an enabled flag.', 'C3-21')
  );
});

test('the same sentence under a different rule gets a different key', () => {
  assert.notEqual(cacheKey('A profile holds a flag.', 'C3-21'), cacheKey('A profile holds a flag.', 'C3-18'));
});

test('bumping the prompt version invalidates every key', () => {
  const sentence = 'A profile holds a flag.';
  assert.notEqual(cacheKey(sentence, 'C3-21', PROMPT_VERSION), cacheKey(sentence, 'C3-21', `${PROMPT_VERSION}-next`));
});

test('normalizeSentence strips a list marker so a reflow does not re-bill', () => {
  assert.equal(normalizeSentence('- A profile holds a flag.'), 'a profile holds a flag.');
  assert.equal(normalizeSentence('2. A profile holds a flag.'), 'a profile holds a flag.');
});

// --- Batching ----------------------------------------------------------------

test('batchRows respects the row count', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ sentence: `s${i}` }));
  assert.deepEqual(batchRows(rows, 3).map((b) => b.length), [3, 3, 1]);
});

test('batchRows splits on the character budget before the row count', () => {
  // Twelve short sentences and twelve long paragraphs are very different
  // replies, and only the second gets truncated.
  const rows = Array.from({ length: 6 }, () => ({ sentence: 'x'.repeat(400) }));
  const batches = batchRows(rows, 12, 1000);
  assert.ok(batches.length > 1, 'the character budget must be able to split a batch');
  assert.ok(batches.every((b) => b.length <= 12));
});

test('batchRows never drops or duplicates a row', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ sentence: `s${i}` }));
  const flat = batchRows(rows, 4).flat();
  assert.equal(flat.length, 25);
  assert.deepEqual(new Set(flat.map((r) => r.sentence)).size, 25);
});

// --- Discovery ---------------------------------------------------------------

test('a discovery proposal must quote its sentence verbatim', () => {
  const batch = [{ sentence: 'The runtime announces the new tool list.', file: 'f.md', line: 1 }];
  const violation = validateDiscoverReply(
    reply([
      {
        sentence_n: 1,
        quote: 'the runtime broadcasts',
        class: 'ANTHROPOMORPHIC',
        proposedPattern: '\\bbroadcasts?\\b',
        label: 'broadcast',
        fix: 'name what is returned',
      },
    ]),
    batch,
    []
  );
  assert.match(violation, /verbatim substring/);
});

test('a discovery proposal whose pattern does not match its own quote is rejected', () => {
  const batch = [{ sentence: 'The runtime announces the new tool list.', file: 'f.md', line: 1 }];
  const violation = validateDiscoverReply(
    reply([
      {
        sentence_n: 1,
        quote: 'announces',
        class: 'ANTHROPOMORPHIC',
        proposedPattern: '\\bbroadcasts?\\b',
        label: 'broadcast',
        fix: 'name what is returned',
      },
    ]),
    batch,
    []
  );
  assert.match(violation, /does not match its own/);
});

test('a discovery proposal with an uncompilable pattern is rejected', () => {
  const batch = [{ sentence: 'The runtime announces the new tool list.', file: 'f.md', line: 1 }];
  assert.match(
    validateDiscoverReply(
      reply([
        {
          sentence_n: 1,
          quote: 'announces',
          class: 'ANTHROPOMORPHIC',
          proposedPattern: '\\b(announce',
          label: 'announce',
          fix: 'name what is returned',
        },
      ]),
      batch,
      []
    ),
    /not a valid regular expression/
  );
});

test('a discovery proposal already covered by an existing entry is rejected', () => {
  const batch = [{ sentence: 'A disabled profile advertises zero tools.', file: 'f.md', line: 1 }];
  const known = [{ pattern: '\\badvertis(e|es|ed|ing)\\b', label: 'advertise' }];
  assert.match(
    validateDiscoverReply(
      reply([
        {
          sentence_n: 1,
          quote: 'advertises',
          class: 'ANTHROPOMORPHIC',
          proposedPattern: '\\badvertises\\b',
          label: 'advertises',
          fix: 'say returns',
        },
      ]),
      batch,
      known
    ),
    /already covered by the existing entry/
  );
});

test('an empty discovery reply is valid, so the model need not invent findings', () => {
  const batch = [{ sentence: 'The runtime validates the token.', file: 'f.md', line: 1 }];
  assert.equal(validateDiscoverReply('[]', batch, []), null);
});

// --- Rewrite must preserve code spans and link targets -----------------------

test('a fix that drops an inline code span is rejected', () => {
  // The first live run produced exactly this: the model was handed masked text
  // and returned a rewrite with `mcp-remote` deleted.
  const original = 'It carries the exact `mcp-remote` version Contentstack currently pins.';
  const fix = 'It specifies the exact version Contentstack currently pins.';
  assert.match(findPreservationViolation(fix, original), /dropped the inline code span `mcp-remote`/);
});

test('a fix that empties a markdown link target is rejected', () => {
  const original = 'See [Monitor and troubleshoot](/developers/mcp-monitor), which carries the table.';
  const fix = 'See [Monitor and troubleshoot](), which contains the table.';
  assert.match(findPreservationViolation(fix, original), /link target/);
});

test('a fix that preserves both is accepted', () => {
  const original = 'It carries the exact `mcp-remote` version. See [docs](/x).';
  const fix = 'It specifies the exact `mcp-remote` version. See [docs](/x).';
  assert.equal(findPreservationViolation(fix, original), null);
});

test('the batch validator applies the preservation rule to a VIOLATION fix', () => {
  const batch = [
    {
      candidateId: 'C3-21:f.md:1',
      sentence: 'It carries the exact `mcp-remote` version Contentstack pins today.',
      verbs: ['carry'],
    },
  ];
  const violation = validateBatchReply(
    reply([
      {
        n: 1,
        verdict: 'VIOLATION',
        reason: 'carries is vague',
        fix: 'It specifies the exact version Contentstack pins today.',
      },
    ]),
    batch,
    RULE
  );
  assert.match(violation, /inline code span/);
});

// --- A fix must actually change something ------------------------------------

test('a fix identical to the original sentence is rejected', () => {
  // The C7-06 judging run returned exactly this: for a duplication finding the
  // prompt asked for "the rewritten sentence", so the model returned the
  // sentence unchanged and called it a fix. Twice.
  const original = 'You fixed it less than five minutes ago and it still fails.';
  assert.match(findFixViolation(original, original), /identical to the original/);
  assert.match(findFixViolation(`  ${original}  `, original), /identical to the original/);
});

test('a genuinely different fix of the same length is accepted', () => {
  const original = 'A profile holds an enabled flag today for every client.';
  const fix = 'A profile has an enabled flag today for every one client.';
  assert.equal(findFixViolation(fix, original), null);
});

test('C3-22 and C7-06 exceptions do not restate the compliant case', () => {
  // Both exceptions were drafted so loosely that the judge exempted every
  // candidate. C7-06's licensed any repeat far enough apart, and C3-22's
  // described genuine contrast, which is compliance rather than an exception.
  const c322 = byId('C3-22').exception;
  assert.match(c322, /COMPLIANT rather than exempt/, 'C3-22 must say genuine contrast is compliance');

  for (const id of ['C7-06', 'C7-02']) {
    const exc = byId(id).exception;
    assert.match(exc, /links to the canonical statement/, `${id} must require a cross-reference`);
    assert.match(exc, /Distance alone is not an exception/, `${id} must refuse the distance escape`);
  }
});

// --- C2-09, the passage rule with two repairs --------------------------------

const COHESION_RULE = byId('C2-09');

function cohesionBatch() {
  return [
    {
      candidateId: 'C2-09:f.md:12',
      ruleId: 'C2-09',
      section: 'Override the stack',
      sentence: 'L12: Stack-scoped tools accept an optional `stack_api_key` argument.\n   L16: This grants no extra access.',
      verbs: ['(structural signal, no wordlist)'],
      suggestedFix: null,
      signal: '4 body paragraphs, none with a bolded lead-in',
    },
  ];
}

test('a C2-09 verdict without a fixKind is rejected', () => {
  const violation = validateBatchReply(
    reply([{ n: 1, verdict: 'VIOLATION', reason: 'The paragraphs never connect.', fix: 'Open L16 with Because.' }]),
    cohesionBatch(),
    COHESION_RULE
  );

  assert.match(violation, /"fixKind" must be one of/);
});

test('a C2-09 violation cannot claim no repair applies', () => {
  const violation = validateBatchReply(
    reply([
      { n: 1, verdict: 'VIOLATION', fixKind: 'none', reason: 'The paragraphs never connect.', fix: 'Open L16 with Because.' },
    ]),
    cohesionBatch(),
    COHESION_RULE
  );

  assert.match(violation, /cannot be none/);
});

test('a C2-09 instruction fix escapes the rewrite guards but not the dash guard', () => {
  // An instruction replaces nothing, so the length ratio and the code-span
  // preservation checks would reject every correct answer.
  const accepted = validateBatchReply(
    reply([
      { n: 1, verdict: 'VIOLATION', fixKind: 'connective', reason: 'Nothing signals how L16 follows L12.', fix: 'Open L16 with Because.' },
    ]),
    cohesionBatch(),
    COHESION_RULE
  );
  assert.equal(accepted, null);

  const dashed = validateBatchReply(
    reply([
      { n: 1, verdict: 'VIOLATION', fixKind: 'lead-ins', reason: 'Three separate facts.', fix: 'Label each paragraph; the first names the scope.' },
    ]),
    cohesionBatch(),
    COHESION_RULE
  );
  assert.match(dashed, /em dash, en dash, or semicolon/);
});

test('the C2-09 prompt shows the whole run and names both repairs', () => {
  const prompt = buildBatchPrompt(cohesionBatch(), COHESION_RULE, null);

  assert.match(prompt, /Section: Override the stack/);
  assert.match(prompt, /L16: This grants no extra access\./, 'the judge must see every opener, not just the first');
  assert.match(prompt, /"lead-ins"/);
  assert.match(prompt, /"connective"/);
  assert.match(prompt, /"fix" is an instruction, not a rewritten sentence/);
});

test('rowsFromCandidates joins every evidence line for a passage rule', () => {
  const candidates = {
    candidates: [
      {
        candidateId: 'C2-09:f.md:12',
        ruleId: 'C2-09',
        file: 'f.md',
        line: 12,
        section: 'Override the stack',
        signal: '4 body paragraphs',
        evidence: ['L12: First opener.', 'L16: Second opener.', 'L20: Third opener.'],
      },
    ],
  };

  const [row] = rowsFromCandidates(candidates, 'C2-09');
  assert.match(row.sentence, /First opener/);
  assert.match(row.sentence, /Third opener/);
  assert.equal(row.ruleId, 'C2-09');
  assert.equal(row.section, 'Override the stack');
});
