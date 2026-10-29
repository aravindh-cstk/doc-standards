'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { expandOnLine, casedExpansion, planFile, EXPANSIONS } = require('../fix/fix-acronym-first-use');
const acronymData = require('../data/acronyms.json');

// --- The plain-prose case ---------------------------------------------------

test('a bare acronym mid-sentence is expanded in place', () => {
  const r = expandOnLine('Deep SDK internals or SSR bootstrap.', 'SSR');
  assert.equal(r.line, 'Deep SDK internals or server-side rendering (SSR) bootstrap.');
});

test('an acronym opening a sentence gets a capital', () => {
  const r = expandOnLine('CDN caches may take longer.', 'CDN');
  assert.equal(r.line, 'Content delivery network (CDN) caches may take longer.');
});

test('an acronym after a colon opens a clause and gets a capital', () => {
  const r = expandOnLine('- **Symptom**: CDN or your app cache.', 'CDN');
  assert.equal(r.line, '- **Symptom**: Content delivery network (CDN) or your app cache.');
});

test('an already-capitalised expansion keeps its own casing', () => {
  const r = expandOnLine('POSTs an entry to CMA with the uid.', 'CMA');
  assert.equal(r.line, 'POSTs an entry to Content Management API (CMA) with the uid.');
});

// --- The four shapes a splice gets wrong ------------------------------------

test('a heading is left for the model', () => {
  const r = expandOnLine('## SSR streaming patterns', 'SSR');
  assert.equal(r.line, null);
  assert.match(r.why, /heading/);
});

test('a table row is left for the model', () => {
  const r = expandOnLine('| Mode | SSR | Renders on the server |', 'SSR');
  assert.equal(r.line, null);
  assert.match(r.why, /table cell/);
});

/**
 * "CI/CD" is the shape this guard exists for. Expanding one half leaves
 * "continuous integration (CI)/CD", which names neither thing correctly.
 */
test('half of a slashed compound is left for the model', () => {
  const r = expandOnLine('Wire it into your CI/CD pipeline.', 'CI');
  assert.equal(r.line, null);
  assert.match(r.why, /compound/);
});

test('a hyphenated compound is left for the model', () => {
  const r = expandOnLine('Resolve it OAuth-first per the ladder.', 'OAuth');
  assert.equal(r.line, null);
  assert.match(r.why, /compound/);
});

test('an acronym inside a link label is left for the model', () => {
  const r = expandOnLine('See [the SSR guide](../a.md) for detail.', 'SSR');
  assert.equal(r.line, null);
  assert.match(r.why, /link label/);
});

/**
 * The expansion brings its own parentheses, so splicing inside a parenthetical
 * nests them. The first run produced "(client-side rendering (CSR) vs
 * server-side rendering (SSR), App Router vs Pages Router)", which a reader has
 * to parse twice.
 */
test('an acronym inside a parenthetical is left for the model', () => {
  const r = expandOnLine('Every trade-off (CSR vs SSR, App Router vs Pages) is covered.', 'CSR');
  assert.equal(r.line, null);
  assert.match(r.why, /parenthetical/);
});

// --- Masking ----------------------------------------------------------------

test('an acronym only inside a code span is not a first bare use', () => {
  const r = expandOnLine('Set `mode: SSR` in the config.', 'SSR');
  assert.equal(r.line, null);
  assert.match(r.why, /inside code/);
});

test('an acronym inside a link target is not a first bare use', () => {
  const r = expandOnLine('Read [the guide](../ssr/SSR.md).', 'SSR');
  assert.equal(r.line, null);
});

// --- casedExpansion in isolation --------------------------------------------

test('casedExpansion capitalises at line start and after terminal punctuation', () => {
  assert.equal(casedExpansion('content delivery network', 'CDN caches', 0), 'Content delivery network');
  assert.equal(casedExpansion('content delivery network', 'Wait. CDN caches', 6), 'Content delivery network');
  assert.equal(casedExpansion('content delivery network', 'the CDN caches', 4), 'content delivery network');
});

test('casedExpansion sees through a list marker and bold markup', () => {
  assert.equal(casedExpansion('content delivery network', '- **Note**: CDN caches', 12), 'Content delivery network');
});

// --- The per-pass re-check --------------------------------------------------

/**
 * Expanding CDA on a line shifts every later offset on that line. Computing a
 * batch of offsets once and applying them against a shifting line is how a
 * fixer corrupts a file, so the check re-runs after each accepted edit.
 */
test('two acronyms on one line both land, and neither corrupts the other', () => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acr-'));
  const file = path.join(dir, 'a.md');
  fs.writeFileSync(file, '# A\n\nThe CDA reads and the CMA writes.\n');
  try {
    const { lines, applied } = planFile(file);
    assert.equal(applied.length, 2);
    assert.equal(
      lines[2],
      'The Content Delivery API (CDA) reads and the Content Management API (CMA) writes.'
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- Data hygiene -----------------------------------------------------------

test('every acronym in the data file has an expansion the fixer can use', () => {
  for (const { acronym, expansion } of acronymData.acronyms) {
    assert.equal(EXPANSIONS.get(acronym), expansion);
    assert.ok(expansion && expansion.trim(), `${acronym} has an empty expansion`);
    assert.ok(!expansion.includes('('), `${acronym}'s expansion already carries parentheses`);
  }
});

// --- Nested parentheses ------------------------------------------------------

const { maxParenDepth, findViolation } = require('../fix/fix-acronym-first-use');

test('maxParenDepth counts the deepest run, ignoring code spans', () => {
  assert.equal(maxParenDepth('trade-off (CSR vs SSR, App Router)'), 1);
  assert.equal(maxParenDepth('trade-off (client-side rendering (CSR) vs SSR)'), 2);
  assert.equal(maxParenDepth('Call `fn((a))` once.'), 0);
});

/**
 * The shape the deterministic half refuses, produced by the model on its first
 * live call anyway: "every trade-off (CSR vs SSR, App Router vs Pages Router)"
 * came back as "(client-side rendering (CSR) vs SSR, ...)", which a reader
 * parses twice and which leaves SSR unexpanded right beside it.
 */
test('an expansion nested inside an existing parenthetical is refused', () => {
  const item = { text: '- every trade-off (CSR vs SSR, App Router vs Pages Router).' };
  const after = '- every trade-off (client-side rendering (CSR) vs SSR, App Router vs Pages Router).';
  assert.match(findViolation(after, item), /nested one parenthesis inside another/);
});

test('restructuring the clause instead of nesting is accepted', () => {
  const item = { text: '- every trade-off (CSR vs SSR, App Router vs Pages Router).' };
  const after =
    '- every trade-off: client-side rendering (CSR) against server-side rendering (SSR), App Router vs Pages Router.';
  assert.equal(findViolation(after, item), null);
});

/**
 * A line that already nests keeps its own depth as the ceiling, so the guard
 * refuses only NEW nesting rather than every line that happens to carry some.
 */
test('a line that already nests is judged against its own depth', () => {
  const item = { text: 'Set the host (see the map (regional) above) before you call CDA.' };
  const after = 'Set the host (see the map (regional) above) before you call the Content Delivery API (CDA).';
  assert.equal(findViolation(after, item), null);
});
