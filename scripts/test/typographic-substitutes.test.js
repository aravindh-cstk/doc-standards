'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkTypographicSubstitutes, BANNED, ALLOWED, HINTS } = require('../checks/typographic-substitutes');
const { checkNoEmoji } = require('../checks/no-emoji');

/** Minimal DocModel stand-in: body lines, never inside a fence. */
function docOf(...lines) {
  const mask = {};
  lines.forEach((_, i) => {
    mask[i + 1] = false;
  });
  return { bodyStartLine: 1, totalLines: lines.length, lines, inFenceMask: mask };
}

/** The same, but every line is inside a code fence. */
function fencedDocOf(...lines) {
  const mask = {};
  lines.forEach((_, i) => {
    mask[i + 1] = true;
  });
  return { bodyStartLine: 1, totalLines: lines.length, lines, inFenceMask: mask };
}

// --- Violations, one per character the corpus actually carries ---------------

test('a middle dot separating a heading is a finding', () => {
  const f = checkTypographicSubstitutes(docOf('### Session 1 · Block A: Update the Template'));
  assert.equal(f.length, 1);
  assert.equal(f[0].ruleId, 'C3-30');
  assert.equal(f[0].checkId, 'typographic-substitutes');
  assert.equal(f[0].tier, 1);
});

test('a section sign inside a link label is a finding', () => {
  assert.equal(checkTypographicSubstitutes(docOf('See [The Studio page § Step 3](../a.md).')).length, 1);
});

test('a trailing ellipsis in prose is a finding', () => {
  assert.equal(checkTypographicSubstitutes(docOf('Registered components: Hero, Card, Button…')).length, 1);
});

test('a multiplication sign in dimensions is a finding', () => {
  assert.equal(checkTypographicSubstitutes(docOf('Click the 3×3 grid icon.')).length, 1);
});

test('a greater-than-or-equal sign in a version floor is a finding', () => {
  assert.equal(checkTypographicSubstitutes(docOf('Studio SDK requires Node ≥ 18.')).length, 1);
});

// --- One finding per line, not per character --------------------------------

/**
 * A heading with four separators is one editorial decision. Reporting four
 * findings is what buried every other rule on the page when C3-27 was first
 * drafted per character.
 */
test('a line with four banned characters is one finding', () => {
  const f = checkTypographicSubstitutes(docOf('Node ≥ 18 · npm ≥ 9 · disk ≥ 2 GB · RAM ≥ 8 GB'));
  assert.equal(f.length, 1);
});

test('the message names every distinct character on the line', () => {
  const f = checkTypographicSubstitutes(docOf('Session 1 · see § 4, Node ≥ 18'));
  assert.match(f[0].message, /·/);
  assert.match(f[0].message, /§/);
  assert.match(f[0].message, /≥/);
});

// --- The masking, which is the whole reason box drawing is safe --------------

test('box drawing inside a fence is not a finding', () => {
  assert.equal(checkTypographicSubstitutes(fencedDocOf('┌─────┐', '│ Hub │', '└─────┘')).length, 0);
});

/**
 * Box drawing is not in the banned set at all, so it is not a finding even in
 * prose. Every one of the 419 occurrences in this corpus sits inside a fence,
 * and inside a fence is where a diagram belongs.
 */
test('box drawing outside a fence is still not a finding', () => {
  assert.equal(checkTypographicSubstitutes(docOf('├── src/')).length, 0);
});

test('a banned character inside a code span is not a finding', () => {
  assert.equal(checkTypographicSubstitutes(docOf('The field accepts `title ≤ 256` characters.')).length, 0);
});

test('a banned character inside a link target is not a finding', () => {
  assert.equal(checkTypographicSubstitutes(docOf('See [the guide](../a.md#step-1×2).')).length, 0);
});

test('a banned character inside an HTML style attribute is not a finding', () => {
  assert.equal(
    checkTypographicSubstitutes(docOf('<img src="a.png" style="max-width: 680px" width="1440×">')).length,
    0
  );
});

/**
 * alt text is prose, because it is what a screen reader speaks. lib/prose-mask
 * uncovers it deliberately, and this rule is one of the reasons it does: a
 * screen reader saying nothing for "·" is the same defect whether the character
 * sits in a sentence or in a caption.
 */
test('a banned character in alt text is a finding', () => {
  assert.equal(checkTypographicSubstitutes(docOf('<img src="a.png" alt="Studio · the canvas">')).length, 1);
});

// --- Exemptions -------------------------------------------------------------

test('the legal marks are not findings', () => {
  assert.equal(checkTypographicSubstitutes(docOf('Contentstack© and Studio™ and Contentstack®')).length, 0);
});

test('a degree sign is not a finding', () => {
  assert.equal(checkTypographicSubstitutes(docOf('Rotate the frame by 90°.')).length, 0);
});

test('an em dash is not a finding here, because C3-05 owns dashes', () => {
  assert.equal(checkTypographicSubstitutes(docOf('The canvas loads, then the composition resolves.')).length, 0);
});

// --- No overlap with C3-27 --------------------------------------------------

/**
 * Two rules reporting the same character would give a writer two findings for
 * one edit. C3-27's exception was amended when this rule landed, so the two
 * sets are disjoint by construction. This test is what catches a future edit
 * that widens one of them back over the other.
 */
test('no banned character of C3-30 is also a finding under C3-27', () => {
  for (const ch of BANNED) {
    const line = `A sentence carrying ${ch} in prose.`;
    assert.equal(
      checkNoEmoji(docOf(line)).length,
      0,
      `C3-27 also reports ${ch} (U+${ch.codePointAt(0).toString(16).toUpperCase()}), so a writer gets two findings for one edit`
    );
  }
});

// --- Data hygiene -----------------------------------------------------------

test('every banned character carries a replacement hint', () => {
  for (const ch of BANNED) {
    assert.ok(HINTS[ch], `${ch} has no hint, so "remove it" is not actionable`);
  }
});

test('no character is both banned and allowed', () => {
  for (const ch of BANNED) assert.ok(!ALLOWED.has(ch), `${ch} is in both sets`);
});

test('a clean line produces nothing', () => {
  assert.equal(
    checkTypographicSubstitutes(docOf('Set the host explicitly. Node 18 or later is required.')).length,
    0
  );
});
