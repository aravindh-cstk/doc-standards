'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { DocModel } = require('../lib/doc-model');
const {
  checkApiRefStructure,
  checkIndexCompleteness,
  checkClassOverviewCompleteness,
  isClassPage,
  isUsageGuidePage,
} = require('../checks/api-ref-structure');
const { lintFile, collectFiles } = require('../lint/lint-api-ref');

const BROKEN_ROOT = path.join(__dirname, 'fixtures', 'api-ref-broken');
const FIXTURES = path.join(BROKEN_ROOT, 'Broken');
const BROKEN_CLASS = path.join(FIXTURES, 'class_reference.md');
const BROKEN_METHOD = path.join(FIXTURES, 'methods', 'broken.md');
const BROKEN_USAGE = path.join(BROKEN_ROOT, 'usage_guide.md');

// A page that already follows the conventions, used as the negative control.
const GOOD_ROOT_DIR = path.join(__dirname, 'fixtures', 'api-ref-good');
const GOOD_ROOT = path.join(GOOD_ROOT_DIR, 'Taxonomy');
const GOOD_METHOD = path.join(GOOD_ROOT, 'methods', 'limit.md');
const GOOD_USAGE = path.join(GOOD_ROOT_DIR, 'usage_guide.md');

function rulesFor(filePath) {
  const doc = DocModel.fromFile(filePath);
  let findings = checkApiRefStructure(doc);
  if (isClassPage(filePath)) findings = findings.concat(checkIndexCompleteness(doc));
  if (isUsageGuidePage(filePath)) findings = findings.concat(checkClassOverviewCompleteness(doc));
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

test('AR-05 accepts a three-column constructor table on a class page', () => {
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

test('a conventions-compliant method page produces no structural findings', () => {
  assert.equal(rulesFor(GOOD_METHOD).length, 0);
});

test('collectFiles finds class pages and method pages, class page first', () => {
  const files = collectFiles(FIXTURES).map((f) => path.relative(FIXTURES, f));
  assert.deepEqual(files, ['class_reference.md', path.join('methods', 'broken.md')]);
});

test('collectFiles picks up the usage guide and orders it above the class folders', () => {
  const files = collectFiles(GOOD_ROOT_DIR).map((f) => path.relative(GOOD_ROOT_DIR, f));
  assert.deepEqual(files, [
    'usage_guide.md',
    path.join('Taxonomy', 'class_reference.md'),
    path.join('Taxonomy', 'methods', 'limit.md'),
  ]);
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

// ---------------------------------------------------------------------------
// UG-01..UG-12, the usage guide (sdk_usage_guides) page shape.
// ---------------------------------------------------------------------------

test('isUsageGuidePage distinguishes a usage guide from the other two page shapes', () => {
  assert.equal(isUsageGuidePage('/x/usage_guide.md'), true);
  // The CMS export names the file with a hyphen, so both spellings classify.
  assert.equal(isUsageGuidePage('/x/usage-guide.md'), true);
  assert.equal(isUsageGuidePage('/x/Taxonomy/class_reference.md'), false);
  assert.equal(isUsageGuidePage('/x/Taxonomy/methods/find.md'), false);
});

test('UG-01 flags empty SEO fields on a usage guide', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-01');
  assert.ok(findings.some((f) => /empty seo_title/.test(f.message)));
  assert.ok(findings.some((f) => /empty seo_description/.test(f.message)));
  // Tier 1 here, against tier 2 for the same omission on a class page: the
  // usage guide is the reference entry most often reached by search.
  assert.ok(findings.every((f) => f.tier === 1));
});

test('UG-02 flags an H2 repeating the title and a heading below H3', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-02');
  assert.ok(findings.some((f) => /repeats the page title/.test(f.message)));
  assert.ok(findings.some((f) => /is H4/.test(f.message)));
});

test('UG-03 flags a missing required section and a reordered page', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-03');
  assert.ok(findings.some((f) => /Missing the "Minimum Working Example" section/.test(f.message)));
  assert.ok(findings.some((f) => /Sections are ordered/.test(f.message)));
});

test('UG-03 does not report SDK Limitations as missing, since omitting it is correct', () => {
  const doc = DocModel.fromFile(GOOD_USAGE);
  const findings = checkApiRefStructure(doc).filter(
    (f) => f.ruleId === 'UG-03' && /SDK Limitations/.test(f.message)
  );
  assert.equal(findings.length, 0);
});

test('UG-04 flags a plain-text class cell and a non-code Accessed via cell', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-04');
  assert.ok(findings.some((f) => f.tier === 1 && /is not a link/.test(f.message)));
  assert.ok(findings.some((f) => f.tier === 2 && /is not inline code/.test(f.message)));
});

test('UG-05 flags a class page on disk that the Class Overview does not link', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-05');
  assert.ok(findings.some((f) => /Class "Broken" exists on disk but is not linked/.test(f.message)));
});

test('UG-05 does not count a Task Index link to a class page as a duplicate row', () => {
  // The good fixture links Taxonomy/class_reference.md once from the Class
  // Overview and twice more from the Task Index, which is legitimate.
  const doc = DocModel.fromFile(GOOD_USAGE);
  const findings = checkClassOverviewCompleteness(doc);
  assert.equal(findings.length, 0);
});

test('UG-06 flags Task Index columns that do not match the spec', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-06');
  assert.ok(findings.some((f) => /Expected exactly \[Task, Start here, Class\]/.test(f.message)));
  assert.equal(findings[0].tier, 1);
});

test('UG-08 flags SDK-Wide Notes with no token-type warning', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-08');
  assert.ok(findings.some((f) => /no token-type warning/.test(f.message)));
  assert.ok(findings[0].falsePositiveNote);
});

test('UG-09 flags a missing Before you begin block', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-09');
  assert.ok(findings.some((f) => /No "Before you begin" blockquote/.test(f.message)));
  assert.equal(findings[0].tier, 1);
});

test('UG-09 checks the three facts separately', () => {
  const doc = new DocModel(
    path.join(GOOD_ROOT_DIR, 'usage_guide.md'),
    ['---', 'uid: "x"', 'seo_title: "t"', 'seo_description: "d"', '---', '',
      '# Example SDK API Reference', '', 'Intro sentence.', '',
      '> **Before you begin:** Finish setup first.', '', '## SDK Structure', '', 'Text.', ''].join('\n')
  );
  const findings = checkApiRefStructure(doc).filter((f) => f.ruleId === 'UG-09');
  assert.ok(findings.some((f) => /does not link the Get Started guide/.test(f.message)));
  assert.ok(findings.some((f) => /does not state the runtime versions/.test(f.message)));
  assert.ok(findings.some((f) => /names no changelog or release notes/.test(f.message)));
});

test('UG-10 flags a forbidden heading and an install command in prose', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-10');
  assert.ok(findings.some((f) => /Heading "Installation" belongs to another page/.test(f.message)));
  assert.ok(findings.some((f) => /Install command in prose/.test(f.message)));
});

test('UG-10 does not flag an install command inside a fenced code block', () => {
  const doc = new DocModel(
    path.join(GOOD_ROOT_DIR, 'usage_guide.md'),
    ['# Example SDK API Reference', '', '```', 'pip install contentstack', '```', ''].join('\n')
  );
  const findings = checkApiRefStructure(doc).filter(
    (f) => f.ruleId === 'UG-10' && /Install command in prose/.test(f.message)
  );
  assert.equal(findings.length, 0);
});

test('UG-11 flags too few examples and a generic scenario title', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-11');
  assert.ok(findings.some((f) => /has 1 H3 examples/.test(f.message)));
  assert.ok(findings.some((f) => /"Example 1" is generic/.test(f.message)));
});

test('UG-13 flags SDK-Wide Notes columns that do not match the spec', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-13');
  assert.ok(findings.some((f) => /Expected exactly \[Concern, Behavior, Default when unset\]/.test(f.message)));
  assert.equal(findings[0].tier, 1);
});

test('UG-13 flags a blank Default when unset cell', () => {
  const doc = new DocModel(
    path.join(GOOD_ROOT_DIR, 'usage_guide.md'),
    ['# Example SDK API Reference', '', '## SDK-Wide Notes', '',
      '| Concern | Behavior | Default when unset |',
      '| --- | --- | --- |',
      '| Branches | Every method accepts `branch`. |  |', ''].join('\n')
  );
  const findings = checkApiRefStructure(doc).filter((f) => f.ruleId === 'UG-13');
  assert.ok(findings.some((f) => /Default when unset cell for "Branches" is blank/.test(f.message)));
});

test('UG-12 flags a blank Notes / Alternative cell', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'UG-12');
  assert.ok(findings.some((f) => /is blank/.test(f.message)));
});

test('AR-07 flags a usage guide that ends with a horizontal rule', () => {
  const findings = rulesFor(BROKEN_USAGE).filter((f) => f.ruleId === 'AR-07');
  assert.ok(findings.some((f) => /Usage guide ends with a horizontal rule/.test(f.message)));
});

test('method-only checks do not fire on a usage guide', () => {
  const seen = ids(rulesFor(GOOD_USAGE));
  for (const id of ['AR-03', 'AR-04', 'AR-05', 'AR-06', 'AR-08']) {
    assert.ok(!seen.has(id), `${id} fired on a usage guide, which it does not govern`);
  }
});

test('every checkable UG rule fires on the broken usage guide', () => {
  const seen = ids(rulesFor(BROKEN_USAGE));
  // UG-07, the deduplication ladder, is tier 3 and reviewed by hand, so it has
  // no check and is deliberately absent here.
  const checkable = [
    'UG-01', 'UG-02', 'UG-03', 'UG-04', 'UG-05', 'UG-06',
    'UG-08', 'UG-09', 'UG-10', 'UG-11', 'UG-12', 'UG-13',
  ];
  for (const id of checkable) {
    assert.ok(seen.has(id), `${id} did not fire on the broken usage guide`);
  }
});

test('a conventions-compliant usage guide produces no structural findings', () => {
  assert.equal(rulesFor(GOOD_USAGE).length, 0);
});

test('a conventions-compliant usage guide is clean through the full runner', () => {
  assert.equal(lintFile(GOOD_USAGE, [1, 2]).length, 0);
});
