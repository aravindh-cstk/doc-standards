'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { DocModel } = require('../lib/doc-model');

const { checkFrontMatter } = require('../checks/front-matter');
const { checkSectionStructure } = require('../checks/section-structure');
const { checkBannedPhrases } = require('../checks/banned-phrases');
const { checkEmDashSemicolon } = require('../checks/em-dash-semicolon');
const { checkTroubleshootingFormat } = require('../checks/troubleshooting-format');
const { checkNextStepsLinks } = require('../checks/next-steps-links');
const { checkAcronymFirstUse } = require('../checks/acronym-first-use');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

function ids(findings) {
  return findings.map((f) => f.ruleId);
}

test('clean feature doc produces no Tier 1 findings across all checks', () => {
  const doc = loadFixture('clean-feature-doc.md');
  const findings = [
    ...checkFrontMatter(doc, 'feature-doc'),
    ...checkSectionStructure(doc, 'feature-doc'),
    ...checkBannedPhrases(doc),
    ...checkEmDashSemicolon(doc),
    ...checkTroubleshootingFormat(doc),
    ...checkNextStepsLinks(doc),
  ];
  assert.deepEqual(findings, []);
});

test('broken feature doc: malformed front matter line is caught', () => {
  const doc = loadFixture('broken-feature-doc.md');
  const findings = checkFrontMatter(doc, 'feature-doc');
  assert.ok(ids(findings).includes('FM-02'));
  assert.ok(ids(findings).includes('FM-01'));
});

test('broken feature doc: Quick Start is flagged as forbidden for feature-doc', () => {
  const doc = loadFixture('broken-feature-doc.md');
  const findings = checkSectionStructure(doc, 'feature-doc');
  assert.ok(findings.some((f) => f.message.includes('Quick Start')));
});

test('broken feature doc: casual and marketing phrases are all caught', () => {
  const doc = loadFixture('broken-feature-doc.md');
  const findings = checkBannedPhrases(doc);
  const messages = findings.map((f) => f.message);
  assert.ok(messages.some((m) => m.includes('seamless')));
  assert.ok(messages.some((m) => m.includes('just')));
  assert.ok(messages.some((m) => m.includes('right away')));
  assert.ok(messages.some((m) => m.includes('powerful')));
});

test('broken feature doc: Troubleshooting entry missing a Root Cause label is caught', () => {
  const doc = loadFixture('broken-feature-doc.md');
  const findings = checkTroubleshootingFormat(doc);
  assert.ok(findings.some((f) => f.message.includes('missing a bolded **Root Cause** label')));
  assert.ok(findings.every((f) => f.ruleId === 'C1-05'));
});

// The **Root Cause(s)** spelling is what the check deliberately rejects, so the
// clean fixture uses **Root Cause** and this asserts the rejection still holds.
test('the Root Cause(s) spelling does not satisfy the Root Cause label', () => {
  const doc = new DocModel('inline.md', [
    '# T',
    '',
    '## Troubleshooting',
    '',
    '### "Not found" error',
    '',
    '**Root Cause(s)**: The alias does not exist.',
    '',
    '**Resolution**: Add the alias.',
  ].join('\n'));
  const findings = checkTroubleshootingFormat(doc);
  assert.ok(findings.some((f) => f.message.includes('missing a bolded **Root Cause** label')));
});

test('em dash and semicolon detector ignores code fences and inline code', () => {
  const doc = new DocModel('inline.md', [
    '---',
    'title: t',
    'description: d',
    'url: /u',
    '---',
    '',
    '# T',
    '',
    '## Overview',
    '',
    'Use `a; b` inline, that is fine.',
    '',
    '```js',
    'const x = 1; // fine in code',
    '```',
    '',
    'But this sentence has a semicolon; right here.',
  ].join('\n'));
  const findings = checkEmDashSemicolon(doc);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 17);
});

test('acronym check accepts a combined slash-separated expansion like (CI/CD)', () => {
  const doc = new DocModel('inline.md', [
    '---',
    'title: t',
    'description: d',
    'url: /u',
    '---',
    '',
    '# T',
    '',
    '## Overview',
    '',
    'Use in a continuous integration / continuous delivery (CI/CD) pipeline.',
  ].join('\n'));
  const findings = checkAcronymFirstUse(doc);
  assert.deepEqual(findings, []);
});

test('acronym check flags a bare acronym used before its expansion', () => {
  const doc = new DocModel('inline.md', [
    '---',
    'title: t',
    'description: d',
    'url: /u',
    '---',
    '',
    '# T',
    '',
    '## Overview',
    '',
    'This uses SSR for rendering.',
  ].join('\n'));
  const findings = checkAcronymFirstUse(doc);
  assert.ok(findings.some((f) => f.message.includes('SSR')));
});

test('bare link in Next Steps is caught, described link is not', () => {
  const doc = new DocModel('inline.md', [
    '---',
    'title: t',
    'description: d',
    'url: /u',
    '---',
    '',
    '# T',
    '',
    '## Next Steps',
    '',
    '- [Bare Link](https://example.com/bare)',
    '- [Described Link](https://example.com/described): explains the thing.',
  ].join('\n'));
  const findings = checkNextStepsLinks(doc);
  assert.equal(findings.length, 1);
  assert.ok(findings[0].message.includes('bare'));
});
