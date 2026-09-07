'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkNoEmoji, EMOJI_RE, ALLOWED } = require('../checks/no-emoji');

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

// --- Violations -------------------------------------------------------------

test('an arrow in prose is a finding', () => {
  const f = checkNoEmoji(docOf('Open Settings → Advanced → Canvas URL.'));
  assert.equal(f.length, 1);
  assert.equal(f[0].ruleId, 'C3-27');
  assert.equal(f[0].checkId, 'no-emoji');
  assert.equal(f[0].tier, 1);
});

test('a status-marker emoji in prose is a finding', () => {
  assert.equal(checkNoEmoji(docOf('| CMA v3 | ✅ verified | ❌ no |')).length, 1);
});

/**
 * This is the case a naive implementation misses. proseMatches tests one UTF-16
 * code unit at a time, and a lone surrogate carries no Unicode property, so
 * every emoji above U+FFFF reads as two characters that match nothing.
 */
test('an astral emoji is a finding, not two unmatched surrogates', () => {
  for (const ch of ['🚀', '🎨', '🧠', '📦', '🔴', '🟡', '🧭']) {
    const f = checkNoEmoji(docOf(`Ship it ${ch} today.`));
    assert.equal(f.length, 1, `${ch} should be one finding`);
    assert.ok(f[0].message.includes(ch), `${ch} should be named in the message`);
  }
});

test('a check or cross mark without the emoji property is still a finding', () => {
  // U+2713 and U+2717 are not Extended_Pictographic, but they do the same job
  // as U+2705 and U+274C, which are.
  for (const ch of ['✓', '✗', '✘', '✔']) {
    assert.equal(checkNoEmoji(docOf(`Supported ${ch}`)).length, 1, ch);
  }
});

test('a variation selector is a finding so it cannot be orphaned', () => {
  assert.equal(checkNoEmoji(docOf('Careful ⚠️ here.')).length, 1);
});

test('one finding per line, however many emoji the line carries', () => {
  const f = checkNoEmoji(docOf('A → B → C → D ✅ ❌ 🚀'));
  assert.equal(f.length, 1);
});

test('every emoji on the line is named once in the message', () => {
  const f = checkNoEmoji(docOf('A → B → C ✅'));
  assert.equal(f.length, 1);
  assert.equal(f[0].message.match(/U\+2192/g).length, 1, 'the repeated arrow is named once');
  assert.ok(f[0].message.includes('U+2705'));
});

test('the message names the replacement, because "remove the arrow" is not actionable', () => {
  const f = checkNoEmoji(docOf('Settings → Advanced'));
  assert.match(f[0].message, /name the relation/);
});

// --- Exemptions -------------------------------------------------------------

test('an emoji inside a code fence is not a finding', () => {
  assert.equal(checkNoEmoji(fencedDocOf('echo "deploy 🚀"', 'A → B')).length, 0);
});

test('an emoji inside an inline code span is not a finding', () => {
  assert.equal(checkNoEmoji(docOf('Run `echo "🚀"` to test.')).length, 0);
  assert.equal(checkNoEmoji(docOf('The `a → b` operator.')).length, 0);
});

test('an arrow inside a machine-read HTML attribute is not a finding', () => {
  assert.equal(checkNoEmoji(docOf('<img src="a→b.png" style="max-width: 60px">')).length, 0);
});

/**
 * Alt text is the one attribute value a person reads, because a screen reader
 * speaks it. An arrow there has the same problem it has in body prose: the
 * listener hears nothing at all where the relation should have been.
 */
test('an arrow inside an alt attribute IS a finding, because alt text is read aloud', () => {
  assert.equal(checkNoEmoji(docOf('<img alt="Layer 1 → Layer 2" src="x.png">')).length, 1);
});

test('the legal marks are permitted', () => {
  assert.equal(checkNoEmoji(docOf('Contentstack® and Studio™, © 2026.')).length, 0);
  for (const ch of ['©', '®', '™']) assert.ok(ALLOWED.has(ch));
});

test('typographic and mathematical symbols are out of scope', () => {
  // Named individually because the plan put them out of scope deliberately and
  // a future widening of the ranges must not quietly take them.
  const allowed = '— … • ’ › ≥ ≤ ≠ ≈ − ⋯ ∩ ∈ ⌘';
  assert.equal(checkNoEmoji(docOf(`Symbols ${allowed} stay.`)).length, 0);
  for (const ch of allowed.replace(/ /g, '')) {
    assert.ok(!EMOJI_RE.test(ch), `${ch} (U+${ch.codePointAt(0).toString(16)}) must stay allowed`);
  }
});

test('box drawing characters are out of scope, so ASCII trees survive', () => {
  const tree = '├── src\n│   └── index.ts\n└── package.json';
  assert.equal(checkNoEmoji(docOf(...tree.split('\n'))).length, 0);
  for (const ch of '─│├└┌┐┘┼') assert.ok(!EMOJI_RE.test(ch), ch);
});

test('front matter above bodyStartLine is not scanned', () => {
  const doc = docOf('title: A → B', 'Body text.');
  doc.bodyStartLine = 2;
  assert.equal(checkNoEmoji(doc).length, 0);
});

test('a clean line produces nothing', () => {
  assert.equal(checkNoEmoji(docOf('Open Settings, then Advanced, then Canvas URL.')).length, 0);
});
