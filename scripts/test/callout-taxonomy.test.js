'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkCalloutTaxonomy } = require('../checks/callout-taxonomy');
const { DocModel } = require('../lib/doc-model');

const docOf = (...lines) => new DocModel('test.md', lines.join('\n'));
const ids = (findings) => findings.map((f) => f.ruleId);

const withCallout = (line) => docOf('# Title', '', '## Section', '', line, '');

// --- The label set accepts both numbers ------------------------------------

/**
 * C2-11 shipped with a singular-only label set while AR-06 requires the plural
 * whenever a callout carries two or more links, and api-ref-structure.js
 * enforces that agreement in both directions. So the one spelling AR-06
 * mandates for a multi-link callout was a tier-1 C2-11 error, and
 * test/fixtures/api-ref-good/Taxonomy/class_reference.md carries exactly that
 * spelling. Number agreement belongs to AR-06, which owns it. This check owns
 * only the closed label set.
 */
test('a plural Additional Resources label is not a label violation', () => {
  const doc = withCallout('> **Additional Resources:** [a](x), [b](y), [c](z)');
  assert.deepEqual(checkCalloutTaxonomy(doc), []);
});

test('a singular Additional Resource label stays valid', () => {
  const doc = withCallout('> **Additional Resource:** [a](x)');
  assert.deepEqual(checkCalloutTaxonomy(doc), []);
});

test('the other three labels stay valid', () => {
  for (const label of ['Warning', 'Note', 'Tip']) {
    const doc = withCallout(`> **${label}:** something`);
    assert.deepEqual(checkCalloutTaxonomy(doc), [], `${label} should be valid`);
  }
});

test('an invented label is still a tier-1 finding', () => {
  for (const label of ['Important', 'Attention', 'Caution']) {
    const found = checkCalloutTaxonomy(withCallout(`> **${label}:** something`));
    assert.deepEqual(ids(found), ['C2-11'], `${label} should be reported`);
    assert.equal(found[0].tier, 1);
  }
});

test('a plural of a label that has no plural form is still reported', () => {
  // "Notes" is not in the label set. Only Additional Resource(s) takes a number,
  // because only that label's number carries meaning under AR-06.
  assert.deepEqual(ids(checkCalloutTaxonomy(withCallout('> **Notes:** something'))), ['C2-11']);
});

/**
 * UG-09 is tier 1 and requires a `> **Before you begin:**` blockquote on an
 * api-ref usage guide, and api-ref-structure.js matches that exact label. C2-11
 * is also tier 1 and its label set rejected it, so the two rules contradicted
 * each other outright. Nothing caught it only because lint-api-ref.js happens
 * to leave callout-taxonomy out of its check list, and the api-ref-good fixture
 * carries the label.
 */
test('the Before you begin label UG-09 requires is valid', () => {
  const doc = withCallout('> **Before you begin:** install the SDK first.');
  assert.deepEqual(checkCalloutTaxonomy(doc, 'feature-doc', false), []);
});

// --- The colon-outside-the-bold form is visible ----------------------------

/**
 * The blockquote pattern matched only the colon-inside form, so `> **Note**:`
 * matched nothing and produced no finding at all: not C2-11, whose label set it
 * never reached, and not CLI-09, which exists for precisely this spelling.
 */
test('a valid label with the colon outside the bold is reported as CLI-09 on a CLI doc', () => {
  const doc = withCallout('> **Note**: something');
  const found = checkCalloutTaxonomy(doc, 'cli-command-reference', true);
  assert.deepEqual(ids(found), ['CLI-09']);
  assert.equal(found[0].tier, 2);
});

test('the colon-outside form is not a CLI-09 finding on a non-CLI doc', () => {
  // CLI-C7 is a CLI convention. A prose doc has no rule about colon placement,
  // so reporting one there would be inventing a rule the registry does not hold.
  const doc = withCallout('> **Note**: something');
  assert.deepEqual(checkCalloutTaxonomy(doc, 'feature-doc', false), []);
});

test('an invented label is caught in the colon-outside form too', () => {
  const found = checkCalloutTaxonomy(withCallout('> **Important**: something'), 'feature-doc', false);
  assert.deepEqual(ids(found), ['C2-11']);
});

test('a CLI doc with an invented label in the drift form reports both rules', () => {
  const found = checkCalloutTaxonomy(withCallout('> **Important**: x'), 'cli-task-runbook', true);
  assert.deepEqual(ids(found).sort(), ['C2-11', 'CLI-09']);
});

test('the compliant colon-inside form reports nothing on a CLI doc', () => {
  const doc = withCallout('> **Note:** something');
  assert.deepEqual(checkCalloutTaxonomy(doc, 'cli-command-reference', true), []);
});

// --- Existing behavior that must not regress -------------------------------

test('a callout inside a fence is ignored', () => {
  const doc = docOf('# Title', '', '## Section', '', '```markdown', '> **Important:** x', '```', '');
  assert.deepEqual(checkCalloutTaxonomy(doc, 'feature-doc', false), []);
});

test('a plain blockquote with no label is ignored', () => {
  assert.deepEqual(checkCalloutTaxonomy(withCallout('> just a quote'), 'feature-doc', false), []);
});

test('the finding names the line it was found on', () => {
  const found = checkCalloutTaxonomy(withCallout('> **Important:** x'));
  assert.equal(found[0].line, 5);
  assert.equal(found[0].checkId, 'callout-taxonomy');
});
