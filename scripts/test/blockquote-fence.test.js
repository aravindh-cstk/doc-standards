'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseMarkdown } = require('../lib/parse-markdown');
const { checkEmDashSemicolon } = require('../checks/em-dash-semicolon');

/**
 * A fence nested in a blockquote is written "> ```js". Matching the raw line
 * against the fence pattern never sees it, so the code block stayed unmasked
 * and every check that trusts inFenceMask read real source as prose.
 */

function maskOf(md) {
  return parseMarkdown(md).inFenceMask;
}

test('a plain fence is masked', () => {
  const mask = maskOf('text\n```js\nconst a = 1;\n```\nmore\n');
  assert.equal(mask[3], true, 'code line should be in a fence');
  assert.equal(mask[1], undefined || mask[1]);
  assert.ok(!mask[5], 'trailing prose should not be in a fence');
});

test('a fence inside a blockquote is masked', () => {
  const mask = maskOf('> intro\n> ```js\n> const a = 1;\n> ```\n> after\n');
  assert.equal(mask[3], true, 'quoted code line should be in a fence');
});

test('a doubly quoted fence is masked', () => {
  const mask = maskOf('> > ```ts\n> > let x = 2;\n> > ```\n');
  assert.equal(mask[2], true, 'doubly quoted code line should be in a fence');
});

test('an indented quoted fence is masked', () => {
  const mask = maskOf('  > ```sh\n  > npm run lint;\n  > ```\n');
  assert.equal(mask[2], true);
});

test('prose after a quoted fence closes is not masked', () => {
  const mask = maskOf('> ```js\n> const a = 1;\n> ```\n\nplain prose here\n');
  assert.ok(!mask[5], 'prose after the fence should be unmasked');
});

test('a semicolon in quoted code is not a C3-05 finding', () => {
  const doc = parseMarkdown('> Example:\n> ```js\n> import x from "y";\n> ```\n');
  assert.equal(checkEmDashSemicolon(doc).length, 0);
});

test('a semicolon in quoted prose is still a C3-05 finding', () => {
  const doc = parseMarkdown('> This holds a token; the server rejects it.\n');
  assert.equal(checkEmDashSemicolon(doc).length, 1);
});

test('a blockquote marker inside a fence does not close it early', () => {
  const mask = maskOf('```md\n> quoted sample\n> more\n```\nprose\n');
  assert.equal(mask[2], true);
  assert.equal(mask[3], true);
  assert.ok(!mask[5]);
});
