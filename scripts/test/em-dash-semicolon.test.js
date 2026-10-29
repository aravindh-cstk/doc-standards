'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkEmDashSemicolon } = require('../checks/em-dash-semicolon');

/** Minimal DocModel stand-in: one body line, never inside a fence. */
function docOf(...lines) {
  const mask = {};
  lines.forEach((_, i) => {
    mask[i + 1] = false;
  });
  return { bodyStartLine: 1, totalLines: lines.length, lines, inFenceMask: mask };
}

test('an em dash in prose is a finding', () => {
  const f = checkEmDashSemicolon(docOf('One clause — another clause.'));
  assert.equal(f.length, 1);
  assert.equal(f[0].ruleId, 'C3-05');
  assert.equal(f[0].tier, 1);
});

test('a semicolon in prose is a finding', () => {
  assert.equal(checkEmDashSemicolon(docOf('Do this; then that.')).length, 1);
});

test('an en dash in prose is a finding', () => {
  assert.equal(checkEmDashSemicolon(docOf('Allow 10–20 retries.')).length, 1);
});

test('a semicolon inside an inline code span is not a finding', () => {
  assert.equal(checkEmDashSemicolon(docOf('Set `a; b` in the config.')).length, 0);
});

test('a line inside a code fence is skipped', () => {
  const doc = docOf('const a = 1; const b = 2;');
  doc.inFenceMask[1] = true;
  assert.equal(checkEmDashSemicolon(doc).length, 0);
});

// The gap this rule shipped with. An entity's semicolon is markup, and no edit
// to the entity itself can satisfy the rule, so flagging it forces a reviewer to
// restyle the markdown around it for no reason.

test('a named HTML entity is not a finding', () => {
  assert.equal(checkEmDashSemicolon(docOf('Put &lt;Component/&gt; in the alt text.')).length, 0);
});

test('a quote entity is not a finding', () => {
  assert.equal(checkEmDashSemicolon(docOf('Wrap it in &quot;quotes&quot; first.')).length, 0);
});

test('a decimal numeric entity is not a finding', () => {
  assert.equal(checkEmDashSemicolon(docOf('Avoid &#8212; in prose.')).length, 0);
});

test('a hex numeric entity is not a finding', () => {
  assert.equal(checkEmDashSemicolon(docOf('Avoid &#x2014; in prose.')).length, 0);
});

test('an entity does not shield a real dash elsewhere on the line', () => {
  const f = checkEmDashSemicolon(docOf('Write &lt;title&gt; here — not there.'));
  assert.equal(f.length, 1);
});

test('an ampersand that is not an entity leaves a later semicolon exposed', () => {
  assert.equal(checkEmDashSemicolon(docOf('Fish & chips; also pie.')).length, 1);
});

test('the real corpus line that exposed the gap is clean', () => {
  const line =
    '- [ ] With a component selected, the Data Picker shows **`Additional Entry Data` → &lt;title&gt;** as a binding root.';
  assert.equal(checkEmDashSemicolon(docOf(line)).length, 0);
});

// The regions the check learned about when it started sharing lib/prose-mask.js
// with the fixer. Each of these is required syntax, so a finding here is one no
// reviewer can clear without breaking the markup.

test('a semicolon inside an HTML style attribute is not a finding', () => {
  const line = '<img src="a.png" alt="x" style="max-width: 680px; width: 100%; height: auto;">';
  assert.equal(checkEmDashSemicolon(docOf(line)).length, 0);
});

/**
 * This test used to assert the opposite, that an alt attribute was exempt. It
 * is not, and the reason is that alt text is the only attribute value a person
 * ever reads: a screen reader speaks it. Protecting the whole tag hid 90 em
 * dashes and semicolons plus 6 arrows in alt values across this corpus, in
 * captions that read correctly on screen and broke the house style when spoken.
 *
 * The style attribute stays exempt, because its semicolons are CSS syntax.
 */
test('an em dash inside an HTML alt attribute IS a finding, because alt text is read aloud', () => {
  const line = '<img src="a.png" alt="Before — after comparison">';
  assert.equal(checkEmDashSemicolon(docOf(line)).length, 1);
});

test('a semicolon inside a style attribute is still not a finding, because it is CSS', () => {
  const line = '<img src="a.png" alt="A diagram" style="max-width: 680px; width: 100%">';
  assert.equal(checkEmDashSemicolon(docOf(line)).length, 0);
});

test('an HTML entity inside alt text keeps its semicolon', () => {
  // Uncovering the whole attribute value as prose also uncovered the required
  // trailing semicolon of an entity, and reported four alt values in this
  // corpus as carrying a prose semicolon no edit could clear. Alt text
  // describes markup, so it uses entities.
  const line = '<img src="a.png" alt="with the &quot;Include in export&quot; checkbox visible">';
  assert.equal(checkEmDashSemicolon(docOf(line)).length, 0);
  assert.equal(
    checkEmDashSemicolon(docOf('<img src="a.png" alt="shown as a &lt;ThreeColumn&gt; example">')).length,
    0
  );
});

test('an entity does not shield a real dash elsewhere in the same alt value', () => {
  const line = '<img src="a.png" alt="a &lt;div&gt; wrapper — and a caption">';
  assert.equal(checkEmDashSemicolon(docOf(line)).length, 1);
});

test('title, aria-label and placeholder are read the same way alt is', () => {
  for (const attr of ['title', 'aria-label', 'placeholder']) {
    const line = `<input ${attr}="Pick one — or none">`;
    assert.equal(checkEmDashSemicolon(docOf(line)).length, 1, attr);
  }
});

/**
 * Indentation no longer protects a line, and the corpus is why: counted over
 * every indented non-list line outside a fence, 301 were HTML attribute
 * continuations and 46 were continuation paragraphs under a list item. Nothing
 * was code. Meanwhile the rule hid 46 real prose lines, so the trade was all
 * cost. Fenced code is still protected, by inFenceMask.
 *
 * If genuinely indented code ever appears here, the fix is a document-level
 * detector that knows list nesting, not a per-line guess.
 */
test('an indented line is prose, because this corpus has no indented code', () => {
  assert.equal(checkEmDashSemicolon(docOf('    const a = 1; const b = 2;')).length, 1);
});

test('an indented continuation paragraph under a list item is checked', () => {
  const doc = docOf(
    '1. **Verification.** Open the route and view source.',
    '',
    '    Next injects a FOUC guard and removes it on hydration — a screenshot shows blank.'
  );
  assert.equal(checkEmDashSemicolon(doc).length, 1);
});

test('an HTML attribute continuation line is still protected, style and all', () => {
  assert.equal(checkEmDashSemicolon(docOf('    style="max-width: 900px; width: 100%; height: auto;">')).length, 0);
  assert.equal(checkEmDashSemicolon(docOf('    width="480" height="688"')).length, 0);
});

test('a semicolon inside a link target is not a finding', () => {
  assert.equal(checkEmDashSemicolon(docOf('See [docs](https://x.test/a;b) for more.')).length, 0);
});

test('a semicolon inside a bare URL is not a finding', () => {
  assert.equal(checkEmDashSemicolon(docOf('Fetch https://x.test/a;b=2 first.')).length, 0);
});

test('prose beside a protected span is still checked', () => {
  const line = '<img src="a.png" style="width: 100%;"> and then; this.';
  assert.equal(checkEmDashSemicolon(docOf(line)).length, 1);
});

test('the check and the fixer agree on what counts as prose', () => {
  const { offendingPositions } = require('../fix/fix-dashes');
  const samples = [
    '<img style="max-width: 680px; width: 100%;">',
    '    const a = 1;',
    'See [docs](https://x.test/a;b).',
    'Put &lt;Component/&gt; here.',
    'One clause — another clause.',
    'Do this; then that.',
    'Use `a; b` in config.',
  ];
  for (const s of samples) {
    const byCheck = checkEmDashSemicolon(docOf(s)).length > 0;
    const byFixer = offendingPositions(s).length > 0;
    assert.equal(byCheck, byFixer, `disagreed on: ${s}`);
  }
});
