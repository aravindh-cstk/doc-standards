'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { DocModel } = require('../lib/doc-model');
const {
  checkApiRefStructure,
  checkIndexCompleteness,
  isClassPage,
} = require('../checks/api-ref-structure');
const { lintFile, collectFiles } = require('../lint-api-ref');

const FIXTURES = path.join(__dirname, 'fixtures', 'api-ref-broken', 'Broken');
const BROKEN_CLASS = path.join(FIXTURES, 'class_reference.md');
const BROKEN_METHOD = path.join(FIXTURES, 'methods', 'broken.md');

// Real pages that already follow the conventions, used as the negative control.
//
// These are vendored into the repo. They used to be read from a sibling
// checkout, which meant the three tests below skipped on every clone that did
// not happen to have it, so the negative control was absent exactly where the
// suite runs as a gate. The skip is kept for the case where a fixture is
// deleted, because a missing negative control is a coverage gap rather than a
// regression, and a permanently red suite cannot act as a gate.
const GOOD_ROOT = path.join(__dirname, 'fixtures', 'api-ref-good', 'Taxonomy');
const GOOD_METHOD = path.join(GOOD_ROOT, 'methods', 'limit.md');

const NO_GOOD_ROOT = fs.existsSync(GOOD_METHOD)
  ? false
  : `negative-control fixtures not present at ${GOOD_ROOT}`;

function rulesFor(filePath) {
  const doc = DocModel.fromFile(filePath);
  let findings = checkApiRefStructure(doc);
  if (isClassPage(filePath)) findings = findings.concat(checkIndexCompleteness(doc));
  return findings;
}

function ids(findings) {
  return new Set(findings.map((f) => f.ruleId));
}

test('isClassPage distinguishes class pages from method pages', () => {
  assert.equal(isClassPage('/x/Taxonomy/class_reference.md'), true);
  assert.equal(isClassPage('/x/Taxonomy/methods/find.md'), false);
});

test('AR-01 flags a stray front-matter key on a method page', () => {
  const findings = rulesFor(BROKEN_METHOD).filter((f) => f.ruleId === 'AR-01');
  assert.ok(findings.some((f) => /stray_key/.test(f.message)));
  assert.equal(findings[0].tier, 1);
});

test('AR-01 flags an empty seo_title on a class page but not on a method page', () => {
  const classFindings = rulesFor(BROKEN_CLASS).filter(
    (f) => f.ruleId === 'AR-01' && /seo_title/.test(f.message)
  );
  assert.equal(classFindings.length, 1);
  assert.equal(classFindings[0].tier, 2);
});

test('AR-01 does not flag seo_title on a method page', { skip: NO_GOOD_ROOT }, () => {
  const methodFindings = rulesFor(GOOD_METHOD).filter((f) => f.ruleId === 'AR-01');
  assert.equal(methodFindings.length, 0);
});

test('AR-02 flags an H2 on a method page and a heading mismatch', () => {
  const findings = rulesFor(BROKEN_METHOD).filter((f) => f.ruleId === 'AR-02');
  assert.ok(findings.some((f) => /is H2/.test(f.message)));
  assert.ok(findings.some((f) => /does not match the filename/.test(f.message)));
});

test('AR-02 flags an H3 on a class page at tier 2', () => {
  const findings = rulesFor(BROKEN_CLASS).filter(
    (f) => f.ruleId === 'AR-02' && /is H3/.test(f.message)
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].tier, 2);
});

test('AR-03 flags Behavior appearing before Validation', () => {
  const findings = rulesFor(BROKEN_METHOD).filter((f) => f.ruleId === 'AR-03');
  assert.ok(findings.some((f) => /ordered Behavior, Validation/.test(f.message)));
});

test('AR-04 flags a Returns line with no description sentence', () => {
  const findings = rulesFor(BROKEN_METHOD).filter((f) => f.ruleId === 'AR-04');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].tier, 1);
  assert.match(findings[0].message, /Expected a type, a period/);
});

test('AR-05 flags both an em dash and a blank Default cell', () => {
  const findings = rulesFor(BROKEN_METHOD).filter((f) => f.ruleId === 'AR-05');
  assert.ok(findings.some((f) => /em or en dash/.test(f.message)));
  assert.ok(findings.some((f) => /is blank/.test(f.message)));
});

test('AR-05 accepts a three-column constructor table on a class page', { skip: NO_GOOD_ROOT }, () => {
  const good = path.join(GOOD_ROOT, 'class_reference.md');
  const findings = rulesFor(good).filter((f) => f.ruleId === 'AR-05');
  assert.equal(findings.length, 0);
});

test('AR-06 flags a Validation section with no Additional Resource callout', () => {
  const findings = rulesFor(BROKEN_METHOD).filter((f) => f.ruleId === 'AR-06');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].tier, 2);
  assert.ok(findings[0].falsePositiveNote);
});

test('AR-07 flags a method page with no trailing rule and a class page that has one', () => {
  const method = rulesFor(BROKEN_METHOD).filter((f) => f.ruleId === 'AR-07');
  assert.ok(method.some((f) => /does not end with a horizontal rule/.test(f.message)));

  const cls = rulesFor(BROKEN_CLASS).filter((f) => f.ruleId === 'AR-07');
  assert.ok(cls.some((f) => /ends with a horizontal rule/.test(f.message)));
});

test('AR-08 flags a trailing Methods list alongside the Method Index', () => {
  const findings = rulesFor(BROKEN_CLASS).filter((f) => f.ruleId === 'AR-08');
  assert.ok(findings.some((f) => /trailing "Methods" list/.test(f.message)));
  assert.equal(findings[0].tier, 1);
});

test('AR-09 flags a dead index link and a method listed twice', () => {
  const findings = rulesFor(BROKEN_CLASS).filter((f) => f.ruleId === 'AR-09');
  assert.ok(findings.some((f) => /methods\/ghost\.md.*does not exist/.test(f.message)));
  assert.ok(findings.some((f) => /has 2 rows in the Method Index/.test(f.message)));
});

test('AR-09 flags a relative link that does not resolve', () => {
  const doc = DocModel.fromFile(BROKEN_CLASS);
  const findings = checkApiRefStructure(doc).filter(
    (f) => f.ruleId === 'AR-09' && /does not resolve/.test(f.message)
  );
  assert.ok(findings.length >= 1);
});

test('every AR rule that the fixtures exercise actually fires', () => {
  const seen = new Set([...ids(rulesFor(BROKEN_CLASS)), ...ids(rulesFor(BROKEN_METHOD))]);
  for (const id of ['AR-01', 'AR-02', 'AR-03', 'AR-04', 'AR-05', 'AR-06', 'AR-07', 'AR-08', 'AR-09']) {
    assert.ok(seen.has(id), `${id} did not fire on the broken fixtures`);
  }
});

test('a conventions-compliant method page produces no structural findings', { skip: NO_GOOD_ROOT }, () => {
  assert.equal(rulesFor(GOOD_METHOD).length, 0);
});

test('collectFiles finds class pages and method pages, class page first', () => {
  const files = collectFiles(FIXTURES).map((f) => path.relative(FIXTURES, f));
  assert.deepEqual(files, ['class_reference.md', path.join('methods', 'broken.md')]);
});

test('lintFile honours the tier filter', () => {
  const tier1 = lintFile(BROKEN_METHOD, [1]);
  const tier2 = lintFile(BROKEN_METHOD, [2]);
  assert.ok(tier1.length > 0);
  assert.ok(tier1.every((f) => f.tier === 1));
  assert.ok(tier2.every((f) => f.tier === 2));
});

test('content checks still run through the api-ref runner', () => {
  // The broken method page carries an em dash in a table cell, which C3-05 owns.
  const findings = lintFile(BROKEN_METHOD, [1, 2]);
  assert.ok(findings.some((f) => f.ruleId === 'C3-05'));
});
