'use strict';

// The four cli-* doc types, merged from CLI Project. checkCliSpecific returns
// nothing unless docType is one of them, so these rules cannot fire on an SDK
// page. CLI Project also sniffed CLI-ness from page content and passed the
// result as a third argument; that heuristic is not carried over, so the tests
// that relied on it pass the type explicitly instead.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { DocModel } = require('../lib/doc-model');

const { checkFrontMatter } = require('../checks/front-matter');
const { checkSectionStructure } = require('../checks/section-structure');
const { checkBannedPhrases } = require('../checks/banned-phrases');
const { checkCliSpecific } = require('../checks/cli-specific');
const { checkInternalLinkForm } = require('../checks/internal-link-form');
const { detectDocType, lintFile } = require('../lint/lint-doc');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

function ids(findings) {
  return findings.map((f) => f.ruleId);
}

test('clean CLI command reference produces no CLI findings', () => {
  const doc = loadFixture('clean-cli-command-reference.md');
  assert.deepEqual(checkCliSpecific(doc, 'cli-command-reference'), []);
  assert.deepEqual(checkSectionStructure(doc, 'cli-command-reference'), []);
});

test('broken CLI command reference: Prerequisites at H3 is reported as misleveled, not missing', () => {
  const doc = loadFixture('broken-cli-command-reference.md');
  const found = ids(checkCliSpecific(doc, 'cli-command-reference'));
  assert.ok(found.includes('CLI-03'), 'expected CLI-03 for Prerequisites at H3');
  assert.ok(!found.includes('CLI-02'), 'must not also report Prerequisites as absent');
});

test('broken CLI command reference: wrong flag-table columns, H4 headings, buried install, bare fences', () => {
  const doc = loadFixture('broken-cli-command-reference.md');
  const found = ids(checkCliSpecific(doc, 'cli-command-reference'));
  assert.ok(found.includes('CLI-01'), 'expected CLI-01 for Flag/Short Flag/Description columns');
  assert.ok(found.includes('CLI-05'), 'expected CLI-05 for the H4 headings');
  assert.ok(found.includes('CLI-07'), 'expected CLI-07 for plugins:install with no Installation section');
  assert.ok(found.includes('CLI-06'), 'expected CLI-06 for the untagged code fence');
});

test('CLI-05 flags every H4, including command facets, which were previously exempt', () => {
  const doc = loadFixture('broken-cli-command-reference.md');
  const depth = checkCliSpecific(doc, 'cli-command-reference').filter((f) => f.ruleId === 'CLI-05');
  // `gadget:list` is a command id, `Flags` is a facet. The facet exemption is gone,
  // because a facet at H4 is just as unlinkable as a command at H4.
  assert.equal(depth.length, 2, 'expected both H4 headings to be reported');
  assert.ok(depth.some((f) => f.message.includes('gadget:list')));
  assert.ok(depth.some((f) => f.message.includes('Flags')));
  assert.ok(depth.every((f) => f.message.includes('bold lead-in')), 'message must name the fix');
});

test('CLI-05 still fires on a CLI doc that carries a non-CLI type', () => {
  // The V1-to-V2 migration guide is typed `migration-guide` but is rendered by the
  // same platform, so its 43 H4s are just as unlinkable. Without the isCli flag
  // this doc is never checked, which is the regression this test guards.
  const doc = loadFixture('broken-cli-command-reference.md');
  const found = ids(checkCliSpecific(doc, 'migration-guide', true));
  assert.ok(found.includes('CLI-05'), 'expected CLI-05 on a CLI doc typed migration-guide');
  assert.ok(!found.includes('CLI-01'), 'type-scoped checks must stay off for a non-CLI type');
  assert.ok(!found.includes('CLI-03'), 'type-scoped checks must stay off for a non-CLI type');
});

test('CLI checks stay silent on a non-CLI doc with a non-CLI type', () => {
  const doc = loadFixture('broken-cli-command-reference.md');
  assert.deepEqual(checkCliSpecific(doc, 'feature-doc', false), []);
  assert.deepEqual(checkCliSpecific(doc, 'how-to-guide', false), []);
});

test('CLI-19 fires on a Troubleshooting section in a CLI doc, whatever type it is checked against', () => {
  // The fixture still carries a Troubleshooting H2 deliberately, so this is the one
  // place it is meant to be caught rather than removed: the hub rule (CLI-C14) is
  // enforced here, not by deleting the fixture's coverage of the old shape.
  //
  // The check keys off isCli (the third argument), not off docType, because three
  // real CLI docs are typed under a product-wide template that still requires
  // Troubleshooting: Install the CLI (setup-guide), CLI for CS Assets and Asset
  // Scanning in CLI (feature-doc), and the V1-to-V2 migration guide
  // (migration-guide). `feature-doc` stands in for that whole class here.
  const doc = loadFixture('broken-cli-command-reference.md');
  for (const docType of ['cli-command-reference', 'cli-task-runbook', 'feature-doc']) {
    const findings = checkSectionStructure(doc, docType, true);
    const found = ids(findings);
    assert.ok(found.includes('CLI-19'), `expected CLI-19 for a Troubleshooting H2 on a CLI doc typed ${docType}`);
    assert.ok(
      !findings.some((f) => f.ruleId === 'C1-01' && f.message.includes('Troubleshooting')),
      `Troubleshooting must not also be reported missing for a CLI doc typed ${docType}`
    );
  }
});

test('CLI-19 stays silent when the doc is not CLI, or carries no Troubleshooting section', () => {
  const brokenDoc = loadFixture('broken-cli-command-reference.md');
  const nonCliFindings = checkSectionStructure(brokenDoc, 'feature-doc', false);
  assert.ok(
    !ids(nonCliFindings).includes('CLI-19'),
    'CLI-19 must not fire for a genuinely non-CLI feature-doc, Troubleshooting is normal there'
  );
  assert.ok(
    !nonCliFindings.some((f) => f.ruleId === 'C1-01' && f.message.includes('Troubleshooting')),
    'a non-CLI feature-doc with a Troubleshooting section must not be reported as missing one either'
  );
  const cleanDoc = loadFixture('clean-cli-command-reference.md');
  assert.ok(
    !ids(checkSectionStructure(cleanDoc, 'cli-command-reference', true)).includes('CLI-19'),
    'CLI-19 must not fire on a doc with no Troubleshooting section'
  );
});

test('a CLI doc typed under a product-wide template is not reported as missing Troubleshooting', () => {
  // This is the case the isCli-keyed skip in `comparison.missing` exists for:
  // Install the CLI, CLI for CS Assets, Asset Scanning in CLI, and the V1-to-V2
  // migration guide are all real CLI docs typed setup-guide, feature-doc, or
  // migration-guide, and those templates still require Troubleshooting for the
  // non-CLI docs that use them. `feature-doc` stands in for that class here.
  const cleanDoc = loadFixture('clean-cli-command-reference.md');
  const messages = checkSectionStructure(cleanDoc, 'feature-doc', true).map((f) => f.message);
  assert.ok(
    !messages.some((m) => m.includes('Troubleshooting')),
    'a CLI doc must not be told Troubleshooting is missing, whatever type it is checked against'
  );
});

test('module reference is exempt from the Prerequisites requirement', () => {
  const doc = new DocModel('inline.md', [
    '---', 'title: "X"', 'description: "Y"', 'url: "/z"', '---', '',
    '# CLI Limitations', '', '## Overview', '', 'What this indexes.', '',
  ].join('\n'));
  const found = ids(checkCliSpecific(doc, 'cli-module-reference'));
  assert.ok(!found.includes('CLI-02'), 'module reference must not be asked for Prerequisites');
});

test('CMS-mirror front matter satisfies the title, description, url requirement', () => {
  const doc = new DocModel('mirror.md', [
    '---', 'uid: "blt123"', 'seo_title: "T | Contentstack"', 'seo_description: "D"', '---', '',
    '# T', '',
  ].join('\n'));
  assert.deepEqual(ids(checkFrontMatter(doc, 'cli-command-reference')), []);
});

test('authored front matter still requires title, description, url', () => {
  const doc = new DocModel('authored.md', [
    '---', 'description: "D"', '---', '', '# T', '',
  ].join('\n'));
  const found = ids(checkFrontMatter(doc, 'cli-command-reference'));
  assert.ok(found.filter((x) => x === 'FM-01').length >= 2, 'expected missing title and url');
});

// CLI-16. The note below is the exact sentence that shipped on both Install the
// CLI pages while Create Custom CLI Plugins for Contentstack was live in both
// versions. A developer read it, concluded there were no plugin docs, and built
// their plugin from oclif's own documentation instead.
test('CLI-16 catches a doc claiming its own documentation does not exist', () => {
  const doc = new DocModel('install.md', [
    '---', 'uid: "blt123"', 'seo_title: "T"', 'seo_description: "D"', '---', '',
    '# Install the CLI', '', '## Namespaces', '',
    '> **Note**: The guide to create your own plugin within `csdx` is yet to come.',
    'But, as our CLI is built using the oclif package, you can create your custom',
    'plugin by referring to [oclif plugin documentation](https://oclif.io/docs/plugins).',
    '',
  ].join('\n'));
  const findings = checkBannedPhrases(doc);
  assert.ok(ids(findings).includes('CLI-16'), 'expected CLI-16 on "yet to come"');
});

test('CLI-16 does not fire on the corrected note, and ignores code fences', () => {
  const doc = new DocModel('fixed.md', [
    '---', 'uid: "blt123"', 'seo_title: "T"', 'seo_description: "D"', '---', '',
    '# Install the CLI', '', '## Namespaces', '',
    '> **Note:** To build your own plugin for `csdx`, see',
    '[Create Custom CLI Plugins for Contentstack](/docs/headless-cms/create-custom-cli-plugins).',
    '',
    '```', 'echo "coming soon"', '```', '',
  ].join('\n'));
  assert.ok(!ids(checkBannedPhrases(doc)).includes('CLI-16'));
});

// CLI-17. The check that did not exist. Nine absolute docs links sat in the
// corpus because the word "relative" appeared once in the whole standard, inside
// C2-04, and no check anywhere tested for a URL scheme at all.

test('CLI-17 catches an absolute link to the docs site and names the relative form', () => {
  const doc = new DocModel('abs.md', [
    '---', 'uid: "blt1"', 'seo_title: "T"', 'seo_description: "D"', '---', '',
    '# T', '', '## Overview', '',
    'See [Contentstack CLI](https://www.contentstack.com/docs/headless-cms/install-the-cli).',
    '',
  ].join('\n'));
  const findings = checkInternalLinkForm(doc);
  assert.ok(ids(findings).includes('CLI-17'));
  assert.match(findings[0].message, /\/docs\/headless-cms\/install-the-cli/);
});

test('CLI-17 leaves relative docs links, the login app, and third parties alone', () => {
  const doc = new DocModel('ok.md', [
    '---', 'uid: "blt1"', 'seo_title: "T"', 'seo_description: "D"', '---', '',
    '# T', '', '## Overview', '',
    '- [Install the CLI](/docs/headless-cms/install-the-cli): relative, correct.',
    '- [Contentstack account](https://www.contentstack.com/login): the app, not the docs.',
    '- [oclif](https://oclif.io/docs/plugins): third party.',
    '- [This section](#overview): a bare fragment.',
    '',
  ].join('\n'));
  assert.deepEqual(ids(checkInternalLinkForm(doc)), []);
});

test('CLI-17 ignores an absolute docs URL inside a code fence', () => {
  const doc = new DocModel('fence.md', [
    '---', 'uid: "blt1"', 'seo_title: "T"', 'seo_description: "D"', '---', '',
    '# T', '', '## Overview', '',
    '```', 'curl https://www.contentstack.com/docs/headless-cms/install-the-cli', '```',
    '',
  ].join('\n'));
  assert.deepEqual(ids(checkInternalLinkForm(doc)), []);
});

// --- Type detection must not capture the SDK corpus -------------------------
//
// Every test above passes a docType explicitly, so none of them could see the
// regression this guards: a `csdx` mention anywhere in the body used to be
// proof of a CLI doc. clean-feature-doc.md shows one `csdx plugins:install`
// line in its Installation section, and it was retyped cli-command-reference
// and reported six errors against a template it does not use.

test('an SDK doc that merely shows a csdx command is still typed by its own shape', () => {
  const doc = loadFixture('clean-feature-doc.md');
  assert.match(doc.lines.join('\n'), /csdx /, 'fixture must still carry the csdx line this guards');
  assert.equal(detectDocType(doc), 'feature-doc');
  assert.deepEqual(lintFile('test/fixtures/clean-feature-doc.md', { tiers: [1] }).automatedFindings, []);
});

test('a page documenting commands is typed as a command reference', () => {
  assert.equal(detectDocType(loadFixture('clean-cli-command-reference.md')), 'cli-command-reference');
  assert.equal(detectDocType(loadFixture('broken-cli-command-reference.md')), 'cli-command-reference');
});
