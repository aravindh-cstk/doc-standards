'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkNoItalics } = require('../checks/no-italics');

function docOf(...lines) {
  const mask = {};
  lines.forEach((_, i) => {
    mask[i + 1] = false;
  });
  return { bodyStartLine: 1, totalLines: lines.length, lines, inFenceMask: mask };
}

function fencedDocOf(...lines) {
  const mask = {};
  lines.forEach((_, i) => {
    mask[i + 1] = true;
  });
  return { bodyStartLine: 1, totalLines: lines.length, lines, inFenceMask: mask };
}

// --- Violations -------------------------------------------------------------

test('single-word asterisk emphasis is a finding', () => {
  const f = checkNoItalics(docOf('It renders the content *and* arranges it.'));
  assert.equal(f.length, 1);
  assert.equal(f[0].ruleId, 'C3-28');
  assert.equal(f[0].checkId, 'no-italics');
  assert.equal(f[0].tier, 1);
  assert.match(f[0].message, /single-word emphasis/);
});

test('multi-word asterisk emphasis is a finding', () => {
  assert.equal(checkNoItalics(docOf('This is a *stateful compound* component.')).length, 1);
});

test('underscore emphasis is a finding', () => {
  assert.equal(checkNoItalics(docOf('It is _not_ a primitive.')).length, 1);
});

test('a wrapped quotation is reported with its own fix', () => {
  const f = checkNoItalics(docOf('Ask *"What if two entries share a slug?"* first.'));
  assert.equal(f.length, 1);
  assert.match(f[0].message, /wrapped quotation/);
  assert.match(f[0].message, /keep the quotation marks/);
});

test('an HTML italic tag is a finding', () => {
  assert.equal(checkNoItalics(docOf('A <em>stateful compound</em> component.')).length, 1);
  assert.equal(checkNoItalics(docOf('A <i>stateful</i> component.')).length, 1);
});

test('the message quotes the raw line, not the mask', () => {
  // The mask blanks inline code to spaces. Quoting the mask turned this into a
  // run of whitespace the reader could not find in the file.
  const f = checkNoItalics(docOf('- *"Was `<XyzComponent>` removed on purpose?"* If so, replace it.'));
  assert.equal(f.length, 1);
  assert.match(f[0].message, /`<XyzComponent>`/);
});

test('two italics on one line are both named', () => {
  const f = checkNoItalics(docOf('Both *this* and *that* matter.'));
  assert.equal(f.length, 1);
  assert.match(f[0].message, /\*this\*/);
  assert.match(f[0].message, /\*that\*/);
});

// --- Exemptions -------------------------------------------------------------

test('bold is not italics', () => {
  assert.equal(checkNoItalics(docOf('Click **Load more** to continue.')).length, 0);
});

test('bold italic is not matched as a stray single asterisk', () => {
  assert.equal(checkNoItalics(docOf('The ***only*** supported path.')).length, 0);
});

test('a bullet marker is not an italic opener', () => {
  assert.equal(checkNoItalics(docOf('* First item', '* Second item')).length, 0);
});

test('a bullet marker followed by bold is not an italic opener', () => {
  assert.equal(checkNoItalics(docOf('* **Rule 1** applies here')).length, 0);
});

test('an underscore inside an identifier is not emphasis', () => {
  assert.equal(checkNoItalics(docOf('Set `article_section.heading` and snake_case_name.')).length, 0);
  assert.equal(checkNoItalics(docOf('The article_section field and the nav_order field.')).length, 0);
  assert.equal(checkNoItalics(docOf('Python defines __init__ and __main__.')).length, 0);
});

test('arithmetic asterisks are not emphasis', () => {
  assert.equal(checkNoItalics(docOf('Compute 2 * 3 * 4 per row.')).length, 0);
});

test('an asterisk inside inline code is not emphasis', () => {
  assert.equal(checkNoItalics(docOf('Use `SELECT *` and `a*b` here.')).length, 0);
});

test('italics inside a code fence are not a finding', () => {
  assert.equal(checkNoItalics(fencedDocOf('const x = *ptr;', 'let a = b *c* d;')).length, 0);
});

test('an intra-word asterisk is not emphasis', () => {
  assert.equal(checkNoItalics(docOf('The glob foo*bar* pattern.')).length, 0);
});

test('an unclosed asterisk is not reported as emphasis', () => {
  assert.equal(checkNoItalics(docOf('A footnote marker* with no partner.')).length, 0);
});

test('front matter above bodyStartLine is not scanned', () => {
  const doc = docOf('seo_title: A *guide* to Studio', 'Body text.');
  doc.bodyStartLine = 2;
  assert.equal(checkNoItalics(doc).length, 0);
});

test('a clean line produces nothing', () => {
  assert.equal(checkNoItalics(docOf('It renders the content and arranges it.')).length, 0);
});
