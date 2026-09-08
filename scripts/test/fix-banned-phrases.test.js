'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { findMarkupViolation } = require('../fix/fix-banned-phrases');

/**
 * The rewrite that made this guard necessary. The model was asked to drop the
 * word "just" from a glossary line and returned the line with its opening bold
 * pair missing, which leaks "**" into the rendered page. Measured on the first
 * 7 rewrites of a live run: 1 of 7 unbalanced a marker.
 */
test('a dropped opening bold pair is a violation', () => {
  const before = '**Repeater**: a container that **repeats one child** for every item.';
  const after = 'Repeater**: a container that **repeats one child** for every item.';
  assert.match(findMarkupViolation(after, before), /bold marker count from 4 to 3/);
});

/**
 * Reported as a dropped code span rather than as a backtick count, because the
 * preserved-span check runs first and names the span that went missing. Either
 * message refuses the reply. The specific one tells the retry what to restore.
 */
test('a dropped backtick is a violation', () => {
  const before = 'Pass `slug` to the helper.';
  const after = 'Pass `slug to the helper.';
  assert.match(findMarkupViolation(after, before), /`slug`.*must survive verbatim/);
});

test('a dropped link bracket is a violation', () => {
  const before = 'See [the guide](../a.md).';
  const after = 'See the guide](../a.md).';
  assert.match(findMarkupViolation(after, before), /square bracket/);
});

test('an ordinary wording change with markup intact is clean', () => {
  const before = '**Repeater**: a container that just repeats one child.';
  const after = '**Repeater**: a container that repeats one child.';
  assert.equal(findMarkupViolation(after, before), null);
});

test('a line with no markup is clean either way', () => {
  assert.equal(findMarkupViolation('It repeats one child.', 'It just repeats one child.'), null);
});

/**
 * Emphasis is out of scope for every banned-phrase rule, so ADDING a marker is
 * damage too. A rewrite that decides a word deserves bold is rewriting more
 * than it was asked to.
 */
test('an added bold pair is also a violation', () => {
  const before = 'The repeater renders one child.';
  const after = 'The **repeater** renders one child.';
  assert.match(findMarkupViolation(after, before), /bold marker/);
});

// --- The container the line belongs to ---------------------------------------

const { findPrefixViolation } = require('../fix/fix-banned-phrases');

/**
 * Nine lines across eight files came back without their "> " after the fixer
 * removed "just" from a callout. Each fell out of the blockquote it belonged
 * to. The prompt said to keep list markers and said nothing about blockquotes,
 * so the model kept one and dropped the other, and no counter above could see
 * it because ">" is neither a word nor emphasis.
 *
 * This is invariant 8 in verify-edit-integrity.js, which exists because a
 * punctuation pass did the same thing in PR #86 and split one table into three
 * on the published site.
 */
test('a dropped blockquote marker is a violation', () => {
  const before = '> **Have a design in hand?** Run the decompose skill just once.';
  const after = '**Have a design in hand?** Run the decompose skill once.';
  assert.match(findPrefixViolation(after, before), /blockquote depth went from 1 to 0/);
});

test('a kept blockquote marker is clean', () => {
  const before = '> **Have a design in hand?** Run the decompose skill just once.';
  const after = '> **Have a design in hand?** Run the decompose skill once.';
  assert.equal(findPrefixViolation(after, before), null);
});

test('a dropped list marker is a violation', () => {
  assert.match(
    findPrefixViolation('Rules: the checklist.', '2. Rules: the just checklist.'),
    /list marker/
  );
});

test('an added list marker is a violation', () => {
  assert.match(
    findPrefixViolation('- Rules: the checklist.', 'Rules: the just checklist.'),
    /added a list marker/
  );
});

test('a changed heading level is a violation', () => {
  assert.match(
    findPrefixViolation('### Just the rules', '## Just the rules'),
    /heading level/
  );
});

test('the prefix guard runs before the marker counts', () => {
  // A reply that both leaves the blockquote AND drops a bold pair reports the
  // container first, because that is the damage a reader sees.
  const before = '> **Rules**: the just checklist.';
  const after = 'Rules**: the checklist.';
  assert.match(findMarkupViolation(after, before), /blockquote depth/);
});

// --- An example from the guidance, pasted verbatim ---------------------------

const { findPastedExample } = require('../fix/fix-banned-phrases');

const END_TO_END_HINT =
  'drop it as filler, or name both ends explicitly ("from content migration to code rewrite")';

/**
 * 22 of the 86 wordlist entries carry an example, and the prompt labelled the
 * whole hint "Suggested replacement". Four lines came back carrying the example
 * attached to "end-to-end", on pages that have nothing to do with migration:
 *
 *   You're done. Studio is wired from content migration to code rewrite.
 *   Run Quickstart 1: Setup from content migration to code rewrite (~10-15 min).
 */
test('an example lifted out of the guidance is a violation', () => {
  const before = "You're done. Studio is wired end-to-end.";
  const after = "You're done. Studio is wired from content migration to code rewrite.";
  assert.match(findPastedExample(after, before, END_TO_END_HINT), /lifted "from content migration to"/);
});

test('wording that fits the sentence is clean', () => {
  const before = "You're done. Studio is wired end-to-end.";
  const after = "You're done. Studio is wired from install to first authored page.";
  assert.equal(findPastedExample(after, before, END_TO_END_HINT), null);
});

test('dropping the phrase entirely is clean', () => {
  assert.equal(
    findPastedExample('Card grid with slots, a worked example.', 'Card grid with slots, an end-to-end worked example.', END_TO_END_HINT),
    null
  );
});

/**
 * A hint offering a one-word substitute is offering exactly the word to use, so
 * using it is correct rather than pasting.
 */
test('a short substitute from the guidance is not a pasted example', () => {
  assert.equal(findPastedExample('Use the helper.', 'Leverage the helper.', '"use", "call", or "apply"'), null);
});

test('an example the original line already contained is not newly pasted', () => {
  const line = 'The phrase from content migration to code rewrite appears here already.';
  assert.equal(findPastedExample(line, line, END_TO_END_HINT), null);
});

test('a hint with no example is clean', () => {
  assert.equal(findPastedExample('It repeats one child.', 'It just repeats one child.', 'drop the minimizer'), null);
});

// --- The table row --------------------------------------------------------

/**
 * Replacing "by hand" with "manually" returned the row without its leading
 * pipe, so a four-cell row became three and every value rendered one column to
 * the left. This is the exact defect PR #86 spent a pass repairing across 27
 * rows, and lib/table-shape.js is the definition it created to stop it.
 */
test('a dropped leading pipe is a violation', () => {
  const before = '| Registering a Carousel | Author types items in by hand | See the guide |';
  const after = 'Registering a Carousel | Author types items in manually | See the guide |';
  assert.match(findPrefixViolation(after, before), /3 cell separators instead of 4/);
});

test('a row that keeps every pipe is clean', () => {
  const before = '| Registering a Carousel | Author types items in by hand | See the guide |';
  const after = '| Registering a Carousel | Author types items in manually | See the guide |';
  assert.equal(findPrefixViolation(after, before), null);
});

test('a non-table line is unaffected by the row check', () => {
  assert.equal(findPrefixViolation('Author types items in manually.', 'Author types items in by hand.'), null);
});

/**
 * The paraphrase the exact-substring version missed. The hint for "Some things"
 * carries the example "covers naming the profile and choosing its tools", and
 * the reply came back as "Naming the profile and choosing its tools are still
 * better done in code" on a page about Studio layout. One leading word differed,
 * so containment saw nothing, and the sentence describes MCP profiles.
 */
test('a paraphrased example is still a violation', () => {
  const hint =
    'name the items, for example "covers naming the profile and choosing its tools" instead of "covers two things"';
  const before = 'Studio is for layout. Some things are still better done in code:';
  const after = 'Studio is for layout. Naming the profile and choosing its tools are still better done in code:';
  assert.match(findPastedExample(after, before, hint), /lifted "naming the profile and"/);
});

test('naming the items this page actually lists is clean', () => {
  const hint =
    'name the items, for example "covers naming the profile and choosing its tools" instead of "covers two things"';
  const before = 'Studio is for layout. Some things are still better done in code:';
  const after = 'Studio is for layout. Component implementation and app-level concerns stay in code:';
  assert.equal(findPastedExample(after, before, hint), null);
});

test('windowsOf produces overlapping four-word windows, punctuation ignored', () => {
  const { windowsOf } = require('../fix/fix-banned-phrases');
  assert.deepEqual(windowsOf('One, two three four five', 4), [
    'one two three four',
    'two three four five',
  ]);
});

test('a three-word example produces no four-word window and cannot false-positive', () => {
  assert.equal(findPastedExample('Use the helper now.', 'Leverage the helper now.', '"use the helper"'), null);
});

// --- Code spans and link targets --------------------------------------------

const { preserved } = require('../fix/fix-banned-phrases');

/**
 * The other two fixers had this check and this one did not, which broke one
 * anchor. Asked to remove "powerful" from "Why slots are powerful: the List +
 * Slot pattern", the model renamed the heading to "Why slots work" and, on a
 * different line, rewrote the link pointing at it to
 * "#why-slots-pass-scope-through-the-list--slot-pattern", a slug no heading
 * produces. The prompt already forbade it.
 */
test('a rewritten link target is a violation', () => {
  const before = 'This is what lets the [List + Slot pattern](#why-slots-are-powerful-the-list--slot-pattern) work.';
  const after = 'This is what lets the [List + Slot pattern](#why-slots-pass-scope-through-the-list--slot-pattern) work.';
  assert.match(findMarkupViolation(after, before), /link target and must survive verbatim/);
});

test('rewording around an untouched link target is clean', () => {
  const before = 'This is just what lets the [List + Slot pattern](#a-heading) work.';
  const after = 'This is what lets the [List + Slot pattern](#a-heading) work.';
  assert.equal(findMarkupViolation(after, before), null);
});

test('a dropped code span is a violation', () => {
  const before = 'Check that `registerDesignTokens` just runs.';
  const after = 'Check that registerDesignTokens runs.';
  assert.match(findMarkupViolation(after, before), /must survive verbatim/);
});

test('preserved collects both code spans and link targets', () => {
  assert.deepEqual(preserved('Call `init()` per [the guide](../a.md#step-1).'), ['`init()`', '../a.md#step-1']);
});
