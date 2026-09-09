'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { classify, exemptRulesFor, isExempt, config, REPO_ROOT, toProjectRelative, STANDARDS_DIR } = require('../lib/corpus-class');
const registry = require('../data/rules-registry.json');

const p = (...parts) => path.join(REPO_ROOT, ...parts);

// --- Classification ---------------------------------------------------------

test('a published docs page classifies as published', () => {
  assert.equal(classify(p('studio-docs/docs/90-reference/index.md')), 'published');
});

test('a prompt mirror classifies as an agent prompt', () => {
  assert.equal(classify(p('studio-docs/docs/prompts/install-studio.md')), 'agent-prompt');
});

test('the skills mirror classifies as an agent prompt too', () => {
  assert.equal(classify(p('studio-docs/skills/src/install-studio.md')), 'agent-prompt');
  assert.equal(classify(p('studio-docs/skills/skills-index.md')), 'agent-prompt');
});

test('research and decomposition notes classify as internal', () => {
  assert.equal(classify(p('studio-docs/docs/_research/deferred-improvements-notes.md')), 'internal');
  assert.equal(classify(p('studio-docs/docs/_decompose-verification/blog_post-build-sheet.md')), 'internal');
});

test('contributor guidance classifies as internal', () => {
  assert.equal(classify(p('studio-docs/docs/AGENTS.md')), 'internal');
  assert.equal(classify(p('studio-docs/CLAUDE.md')), 'internal');
});

test('architecture decision records classify as internal', () => {
  assert.equal(classify(p('studio-docs/docs/adr/0001-installer-is-a-per-ide-file-placer.md')), 'internal');
});

/**
 * The prompts prefix has to win over the general docs/ prefix, and it only does
 * because it appears earlier in the pattern list. Reordering the file silently
 * makes every prompt a published page and puts 2,558 findings back.
 */
test('a more specific prefix wins over the general docs prefix', () => {
  const prompts = config.patterns.findIndex((x) => x.prefix === 'docs/prompts/');
  const general = config.patterns.findIndex((x) => x.prefix === 'docs/');
  assert.ok(prompts < general, 'the prompts pattern must come before the general docs pattern');
});

test('a path outside the repo falls to the default, not to published', () => {
  assert.equal(classify('/tmp/somewhere/else.md'), config.default);
  assert.notEqual(config.default, 'published', 'an unrecognised file is not evidence that it ships');
});

test('a relative path resolves the same as an absolute one', () => {
  const abs = p('studio-docs/docs/prompts/install-studio.md');
  const rel = path.relative(process.cwd(), abs);
  assert.equal(classify(rel), classify(abs));
});

// --- Exemptions -------------------------------------------------------------

test('a published page is exempt from nothing', () => {
  assert.equal(exemptRulesFor(p('studio-docs/docs/90-reference/index.md')).size, 0);
});

test('an agent prompt is exempt from the page-shape rules', () => {
  const file = p('studio-docs/docs/prompts/install-studio.md');
  assert.ok(isExempt(file, 'FM-01'), 'SEO front matter is not a skill file concern');
  assert.ok(isExempt(file, 'C1-01'), 'the section matrix does not govern a skill file');
});

/**
 * The scoping is about page shape. A skill file is read by a model and by the
 * humans who maintain it, and both are better served by house prose, so no
 * prose rule may ever appear in an exemption list.
 */
test('no prose rule is exempt in any class', () => {
  const proseRules = ['C3-01', 'C3-03', 'C3-05', 'C3-15', 'C3-18', 'C3-27', 'C3-28', 'C3-30',
    'C8-02', 'C8-03', 'C8-04', 'C8-05', 'C8-06', 'C8-07', 'C8-08', 'C2-10'];
  for (const [name, entry] of Object.entries(config.classes)) {
    for (const ruleId of entry.exemptRules) {
      assert.ok(
        !proseRules.includes(ruleId),
        `class "${name}" exempts ${ruleId}, which is a prose rule and applies everywhere`
      );
    }
  }
});

// --- Data hygiene -----------------------------------------------------------

test('every pattern names a class that exists', () => {
  for (const { prefix, class: className } of config.patterns) {
    assert.ok(config.classes[className], `pattern "${prefix}" names unknown class "${className}"`);
  }
  assert.ok(config.classes[config.default], `default class "${config.default}" does not exist`);
});

test('every exempt rule id is in the registry', () => {
  const known = new Set(registry.map((r) => r.id));
  for (const [name, entry] of Object.entries(config.classes)) {
    for (const ruleId of entry.exemptRules) {
      assert.ok(known.has(ruleId), `class "${name}" exempts ${ruleId}, which is not a registry rule`);
    }
  }
});

test('every class carries a "what" explaining who owns the shape instead', () => {
  for (const [name, entry] of Object.entries(config.classes)) {
    assert.ok(entry.what && entry.what.trim(), `class "${name}" has no explanation`);
  }
});

// --- The patterns must hold for any project, not just the one they came from -

/**
 * The regression this guards is the reason the patterns were rewritten. They
 * used to be prefixed `studio-docs/`, so a file at the same path in any other
 * project matched nothing, fell to the default, and quietly lost its
 * exemptions. Sharing this repo was enough to break it.
 */
test('the same layout classifies the same way in any project', () => {
  for (const project of ['studio-docs', 'mcp-docs', 'cli-docs', 'anything-at-all']) {
    assert.equal(classify(p(project, 'docs/90-reference/index.md')), 'published', project);
    assert.equal(classify(p(project, 'docs/prompts/install.md')), 'agent-prompt', project);
    assert.equal(classify(p(project, 'skills/src/install.md')), 'agent-prompt', project);
    assert.equal(classify(p(project, 'docs/_research/notes.md')), 'internal', project);
    assert.equal(classify(p(project, 'CLAUDE.md')), 'internal', project);
  }
});

test('the standards tree itself is internal, whatever the directory is called', () => {
  assert.equal(classify(p(STANDARDS_DIR, 'doc-templates/feature-docs/common-rules.md')), 'internal');
  assert.equal(classify(p(STANDARDS_DIR, 'scripts/lint/lint-doc.js')), 'internal');
});

test('toProjectRelative drops the project directory and refuses paths outside it', () => {
  assert.equal(toProjectRelative(p('some-project', 'docs/a.md')), 'docs/a.md');
  assert.equal(toProjectRelative('/tmp/outside.md'), null);
});

test('no pattern carries a project directory name', () => {
  for (const { prefix } of config.patterns) {
    assert.ok(
      !/^[a-z0-9-]+-docs\//.test(prefix),
      `pattern "${prefix}" is scoped to one project, so it matches nothing anywhere else`
    );
  }
});
