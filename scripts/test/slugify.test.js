'use strict';

/**
 * The anchor slugger had two implementations that disagreed on 180 of the
 * 3,314 headings in this corpus. These tests pin the GitHub behaviour the docs
 * site actually follows, so a future "tidy-up" cannot quietly reintroduce the
 * collapsing variant.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { slugify } = require('../lib/slugify');
const { slugify: viaParseMarkdown } = require('../lib/parse-markdown');

test('the two entry points are the same function', () => {
  assert.equal(viaParseMarkdown, slugify);
});

test('lowercases and hyphenates', () => {
  assert.equal(slugify('Working With Templates'), 'working-with-templates');
});

/**
 * The bug. GitHub replaces each whitespace character with one hyphen and does
 * not collapse the result, so dropping a "+" between two spaces leaves two
 * hyphens. The old parse-markdown version used `\s+` and produced an anchor no
 * heading has.
 */
test('a dropped separator leaves its whitespace as two hyphens', () => {
  assert.equal(slugify('Save + Deploy'), 'save--deploy');
  assert.equal(slugify('Step 7: Save + preview (30 sec)'), 'step-7-save--preview-30-sec');
  assert.equal(slugify('Save / Deploy / Publish'), 'save--deploy--publish');
  assert.equal(slugify('Studio Project / Canvas'), 'studio-project--canvas');
});

test('three hyphens when a spaced hyphen is the separator', () => {
  assert.equal(slugify('Foo - Bar'), 'foo---bar');
});

/**
 * Decoration is unwrapped before punctuation is dropped, so the words inside
 * it survive. Stripping with the catch-all class first turned a link in a
 * heading into its text glued to its URL.
 */
test('inline code in a heading keeps its text', () => {
  assert.equal(slugify('The `slot` prop'), 'the-slot-prop');
});

test('bold and italics in a heading keep their text', () => {
  assert.equal(slugify('The **only** supported path'), 'the-only-supported-path');
  assert.equal(slugify('An *optional* step'), 'an-optional-step');
});

test('a link in a heading keeps its label and drops its target', () => {
  assert.equal(slugify('See [Templates](../31-templates/overview.md)'), 'see-templates');
});

test('angle brackets are dropped, which is why component headings read as lt and gt', () => {
  // The corpus links to this exact anchor, so the shape is load-bearing.
  assert.equal(
    slugify('Part 2: Runtime Component Default Data (the `data` prop on `<StudioComponent />`)'),
    'part-2-runtime-component-default-data-the-data-prop-on-studiocomponent-'
  );
});

test('underscores survive, because they are word characters', () => {
  assert.equal(slugify('The `{{NEW_SECTION_NAME}}` Section'), 'the-new_section_name-section');
});

test('a trailing punctuation mark leaves no trailing hyphen of its own', () => {
  assert.equal(slugify('Why this matters:'), 'why-this-matters');
});

test('non-string input does not throw', () => {
  assert.equal(slugify(''), '');
  assert.equal(slugify(undefined), 'undefined');
});
