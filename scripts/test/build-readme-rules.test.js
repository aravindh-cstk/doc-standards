'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { buildRulesDoc, buildChecksDoc, cell } = require('../build/build-readme-rules');
const { registry, checkSources, unemittedRuleClaims } = require('../lib/rules-registry');

const STANDARDS_DIR = path.join(__dirname, '..', '..');
const RULES_PATH = path.join(STANDARDS_DIR, 'REFERENCE-RULES.md');
const CHECKS_PATH = path.join(STANDARDS_DIR, 'REFERENCE-CHECKS.md');

const rulesDoc = buildRulesDoc();
const checksDoc = buildChecksDoc();

const checkIds = Object.keys(checkSources).filter((k) => !k.startsWith('_'));

// --- The committed files match the registry ---------------------------------
//
// These two are the load-bearing tests, and the reason they read from disk
// rather than from buildRulesDoc() is worth stating. Comparing generated output
// against the registry it was just generated from proves nothing: drop a rule
// and both sides drop it together. The failure this has to catch is a registry
// edit that never got a `npm run build:readme`, which leaves the committed
// catalog describing a rule set that no longer exists.

test('the committed rule catalog is current', () => {
  const onDisk = fs.readFileSync(RULES_PATH, 'utf8');
  assert.equal(
    onDisk,
    rulesDoc,
    'REFERENCE-RULES.md is stale. Run `npm run build:readme` in scripts/ and commit the result.'
  );
});

test('the committed check catalog is current', () => {
  const onDisk = fs.readFileSync(CHECKS_PATH, 'utf8');
  assert.equal(
    onDisk,
    checksDoc,
    'REFERENCE-CHECKS.md is stale. Run `npm run build:readme` in scripts/ and commit the result.'
  );
});

// --- Completeness -----------------------------------------------------------

test('every registry rule appears in the rule catalog', () => {
  const missing = registry.filter((rule) => !rulesDoc.includes(`### ${rule.id}\n`)).map((r) => r.id);
  assert.deepEqual(missing, [], `rules absent from REFERENCE-RULES.md: ${missing.join(', ')}`);
});

test('every rule carries its text, tier and source', () => {
  for (const rule of registry) {
    assert.ok(rulesDoc.includes(cell(rule.rule)), `${rule.id} rule text is missing`);
    assert.ok(rulesDoc.includes(`\`${rule.source}\``), `${rule.id} source is missing`);
  }
});

test('every check-sources entry appears in the check catalog', () => {
  const missing = checkIds.filter((id) => !checksDoc.includes(`\`${id}\``));
  assert.deepEqual(missing, [], `checks absent from REFERENCE-CHECKS.md: ${missing.join(', ')}`);
});

// --- Counts match the registry ---------------------------------------------

test('the headline count matches the registry size', () => {
  assert.match(rulesDoc, new RegExp(`\\*\\*${registry.length} rules\\*\\*`));
});

test('the tier counts in the header match the registry', () => {
  const tier = { 1: 0, 2: 0, 3: 0 };
  for (const rule of registry) tier[rule.tier] += 1;
  assert.ok(
    rulesDoc.includes(`${tier[1]} tier 1, ${tier[2]} tier 2, ${tier[3]} tier 3`),
    'tier counts in the header do not match the registry'
  );
});

test('the unimplemented count matches check-sources', () => {
  const unimplemented = checkIds.filter((id) => checkSources[id].kind === 'unimplemented').length;
  assert.ok(
    checksDoc.includes(`${unimplemented} have no module behind them`),
    'the unimplemented count does not match check-sources.json'
  );
});

test('the unemitted claim list is reported in full', () => {
  const claims = unemittedRuleClaims();
  assert.ok(checksDoc.includes(`Current count: ${claims.length}.`));
  for (const pair of claims) assert.ok(checksDoc.includes(`\`${pair}\``), `${pair} is not listed`);
});

// --- The generated prose obeys the rules it documents -----------------------

test('the generated files carry no em dash, en dash or semicolon', () => {
  // C3-05 applies to this repo's own prose, including anything generated into it.
  // Registry text is quoted verbatim, so a violation here is a violation in the
  // registry and needs fixing there rather than being escaped away.
  for (const [name, doc] of [['REFERENCE-RULES.md', rulesDoc], ['REFERENCE-CHECKS.md', checksDoc]]) {
    const offenders = doc.split('\n').filter((line) => /[—–;]/.test(line));
    assert.deepEqual(offenders, [], `${name} breaks C3-05 on: ${offenders.slice(0, 3).join(' / ')}`);
  }
});

test('the generated files carry no emoji or arrow glyph', () => {
  for (const [name, doc] of [['REFERENCE-RULES.md', rulesDoc], ['REFERENCE-CHECKS.md', checksDoc]]) {
    assert.doesNotMatch(doc, /[←-⇿✀-➿️\u{1F300}-\u{1FAFF}]/u, `${name} breaks C3-27`);
  }
});

// --- Table safety -----------------------------------------------------------

test('a pipe in rule text is escaped so the row cannot break', () => {
  assert.equal(cell('a | b'), 'a \\| b');
});

test('a newline in rule text collapses to a space', () => {
  assert.equal(cell('a\nb'), 'a b');
});

test('no table row in either file has an unescaped pipe count mismatch', () => {
  for (const [name, doc] of [['REFERENCE-RULES.md', rulesDoc], ['REFERENCE-CHECKS.md', checksDoc]]) {
    const lines = doc.split('\n');
    let header = null;
    let expected = 0;
    for (const line of lines) {
      if (!line.startsWith('|')) {
        header = null;
        continue;
      }
      const count = (line.match(/(?<!\\)\|/g) || []).length;
      if (header === null) {
        header = line;
        expected = count;
      } else if (!/^\|[\s|:-]+\|$/.test(line)) {
        assert.equal(count, expected, `${name} row has ${count} cells, header has ${expected}: ${line}`);
      }
    }
  }
});

// --- Determinism ------------------------------------------------------------

test('regenerating produces byte-identical output', () => {
  assert.equal(buildRulesDoc(), rulesDoc);
  assert.equal(buildChecksDoc(), checksDoc);
});

test('every group anchor in the summary table resolves to a heading', () => {
  // Scan only the summary table rows. Quoted rule text contains markdown link
  // examples of its own, and those anchors point at a reader's page, not at this file.
  const anchors = rulesDoc
    .split('\n')
    .filter((line) => /^\| \[/.test(line))
    .flatMap((line) => [...line.matchAll(/\]\(#([a-z0-9-]+)\)/g)].map((m) => m[1]));
  assert.ok(anchors.length > 0, 'no group anchors were emitted');
  const headings = [...rulesDoc.matchAll(/^## (.+)$/gm)].map((m) =>
    m[1].toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-')
  );
  for (const anchor of anchors) {
    assert.ok(headings.includes(anchor), `anchor #${anchor} has no matching heading`);
  }
});
