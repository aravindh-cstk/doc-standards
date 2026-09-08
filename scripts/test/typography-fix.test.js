'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { dotSeparatorToComma, hasTypography } = require('../fix/fix-emoji-italics');

// --- The separator it exists for --------------------------------------------

test('a dot separating bold labels becomes a comma', () => {
  const r = dotSeparatorToComma('Columns: **Title** · **Publish Status** · **Actions**.');
  assert.equal(r.line, 'Columns: **Title**, **Publish Status**, **Actions**.');
});

test('a dot in a heading becomes a comma, and no second colon appears', () => {
  const r = dotSeparatorToComma('### Session 1 · Block A: Update the Template');
  assert.equal(r.line, '### Session 1, Block A: Update the Template');
});

test('a dot in a table cell becomes a comma without touching the pipes', () => {
  const before = '| **Setup** | Stack prerequisites · App-side install |';
  const r = dotSeparatorToComma(before);
  assert.equal(r.line, '| **Setup** | Stack prerequisites, App-side install |');
  assert.equal((r.line.match(/\|/g) || []).length, (before.match(/\|/g) || []).length);
});

// --- The regression the integrity verifier caught ---------------------------

/**
 * The first version of this rule located the dot in the prose mask and then
 * measured the whitespace run in the mask too. Masking blanks a link target to
 * spaces of the same length, so the run swallowed both neighbouring links and
 * splicing those offsets into the raw line produced "- [, [, [". The mask says
 * WHERE a character is. It never says how much of the raw line to replace.
 */
test('a dot between two links keeps both links whole', () => {
  const before =
    '- [`build-repeating-section`](build-repeating-section.md) · [`use-section-slot`](use-section-slot.md)';
  const r = dotSeparatorToComma(before);
  assert.equal(
    r.line,
    '- [`build-repeating-section`](build-repeating-section.md), [`use-section-slot`](use-section-slot.md)'
  );
  for (const target of ['build-repeating-section.md', 'use-section-slot.md']) {
    assert.ok(r.line.includes(target), `${target} must survive verbatim`);
  }
});

test('a dot between two inline code spans keeps both spans whole', () => {
  const before = 'Config: `~/.cursor/mcp.json` · `~/.vscode/mcp.json`';
  const r = dotSeparatorToComma(before);
  assert.equal(r.line, 'Config: `~/.cursor/mcp.json`, `~/.vscode/mcp.json`');
});

// --- What it must not touch --------------------------------------------------

test('a dot with no space around it is not a separator', () => {
  assert.equal(dotSeparatorToComma('The identifier is a·b and stays.'), null);
});

test('a dot inside a code span is invisible to the rule', () => {
  assert.equal(dotSeparatorToComma('Pass `a · b` verbatim.'), null);
});

test('a leading dot has no left-hand item, so it is not a separator', () => {
  assert.equal(dotSeparatorToComma(' · Item'), null);
});

test('a line with no dot returns null rather than an unchanged result', () => {
  assert.equal(dotSeparatorToComma('An ordinary sentence.'), null);
});

// --- The family predicate ----------------------------------------------------

test('hasTypography sees a banned character in prose', () => {
  assert.equal(hasTypography('Node ≥ 18 is required.'), true);
});

test('hasTypography ignores one inside a code span', () => {
  assert.equal(hasTypography('The field accepts `title ≤ 256`.'), false);
});

test('hasTypography ignores box drawing', () => {
  assert.equal(hasTypography('├── src/'), false);
});

// --- The trailing lead-in ellipsis -------------------------------------------

const { trailingLeadInEllipsis } = require('../fix/fix-emoji-italics');

/**
 * The shape the first model pass got wrong, three times in the same run. A
 * table header ending in an ellipsis is a stem the next column completes, and
 * the model returned "You want to, and so on", "Goes on, and so on" and
 * "You're starting with, and so on". None of those says anything, so this shape
 * never reaches the model now.
 */
test('a table header ending in an ellipsis loses the character and nothing else', () => {
  assert.equal(trailingLeadInEllipsis('| You want to… | Use |').line, '| You want to | Use |');
  assert.equal(
    trailingLeadInEllipsis('| Component | Goes on… | Renders |').line,
    '| Component | Goes on | Renders |'
  );
});

test('the pipe count survives the edit', () => {
  const before = '| You are starting with… | Skill | What it does |';
  const after = trailingLeadInEllipsis(before).line;
  assert.equal((after.match(/\|/g) || []).length, (before.match(/\|/g) || []).length);
});

/**
 * An enumeration ends its line the same way and means the opposite: the
 * character stands for members the line stopped listing, so "and so on" is
 * right there and only the model can write it. Two commas in the cell separate
 * a list from a lead-in.
 */
test('an enumeration is left for the model', () => {
  assert.equal(
    trailingLeadInEllipsis('- **Components**: React blocks (Hero, Card, Button…).'),
    null
  );
});

/**
 * Inside quotation marks the character usually reproduces what the product
 * shows, such as a truncated entry title in a screenshot caption. Rewriting it
 * to "and so on" states something the product does not display.
 */
test('a quoted ellipsis is product output and is left alone', () => {
  assert.equal(
    trailingLeadInEllipsis('![Chip shows the Preview Entry ("Welcome to Studio…"), Save right.](a.png)'),
    null
  );
  assert.equal(trailingLeadInEllipsis('## Quick map: "I want to…"'), null);
});

test('an ellipsis inside a code span is invisible to the rule', () => {
  assert.equal(trailingLeadInEllipsis('Drop a `<SectionHeader title="…" />` above it.'), null);
});

test('an ellipsis mid-sentence is not a trailing lead-in', () => {
  assert.equal(trailingLeadInEllipsis('The value… is read at boot.'), null);
});

test('a line with no ellipsis returns null', () => {
  assert.equal(trailingLeadInEllipsis('| You want to | Use |'), null);
});
