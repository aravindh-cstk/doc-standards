'use strict';

/**
 * sync-mirror.js took four hardcoded studio-docs paths, so it could only run
 * against that one corpus and was excluded from `npm run gate` for it. These
 * tests fix the general contract: any two directories, named on the command
 * line.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { pairs, parseArgs } = require('../sync-mirror');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-mirror-'));
  const src = path.join(root, 'src');
  const mirror = path.join(root, 'mirror');
  fs.mkdirSync(src);
  fs.mkdirSync(mirror);
  fs.writeFileSync(path.join(src, 'a.md'), 'same\n');
  fs.writeFileSync(path.join(mirror, 'a.md'), 'same\n');
  fs.writeFileSync(path.join(src, 'b.md'), 'source\n');
  fs.writeFileSync(path.join(mirror, 'b.md'), 'drifted\n');
  fs.writeFileSync(path.join(src, 'notes.txt'), 'not markdown\n');
  fs.writeFileSync(path.join(root, 'idx.md'), 'index\n');
  return { root, src, mirror, index: path.join(root, 'idx.md') };
}

test('parseArgs separates the two directories from the flags', () => {
  const a = parseArgs(['../x/src', '../x/mirror', '--apply', '--index=../x/i.md', '--mirror-only=index.md,skills-index.md']);
  assert.deepEqual(a.dirs, ['../x/src', '../x/mirror']);
  assert.equal(a.apply, true);
  assert.equal(a.index, '../x/i.md');
  assert.deepEqual(a.mirrorOnly, ['index.md', 'skills-index.md']);
});

test('parseArgs defaults to report mode with no index and no mirror-only', () => {
  const a = parseArgs(['src', 'mirror']);
  assert.equal(a.apply, false);
  assert.equal(a.index, null);
  assert.deepEqual(a.mirrorOnly, []);
});

test('pairs covers every markdown file in the source and nothing else', () => {
  const f = fixture();
  try {
    const names = pairs({ src: f.src, mirror: f.mirror, index: null }).map((x) => x.name);
    assert.deepEqual(names, ['a.md', 'b.md'], 'notes.txt is not markdown and is not mirrored');
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

/**
 * The index file lives outside the source directory, so a readdir of the
 * source never reaches it. It has to be listed explicitly or it silently stops
 * being mirrored.
 */
test('pairs puts an --index file first and targets it by basename', () => {
  const f = fixture();
  try {
    const all = pairs({ src: f.src, mirror: f.mirror, index: f.index });
    assert.equal(all[0].name, 'idx.md');
    assert.equal(all[0].from, f.index);
    assert.equal(all[0].to, path.join(f.mirror, 'idx.md'));
    assert.deepEqual(all.map((x) => x.name), ['idx.md', 'a.md', 'b.md']);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('pairs names no directory that the caller did not pass', () => {
  const f = fixture();
  try {
    for (const { from, to } of pairs({ src: f.src, mirror: f.mirror, index: f.index })) {
      assert.ok(from.startsWith(f.root), `${from} is outside the directories given`);
      assert.ok(to.startsWith(f.mirror), `${to} is outside the mirror given`);
    }
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('the module exports no hardcoded corpus path', () => {
  const mod = require('../sync-mirror');
  assert.deepEqual(Object.keys(mod).sort(), ['pairs', 'parseArgs']);
  const src = fs.readFileSync(path.join(__dirname, '..', 'sync-mirror.js'), 'utf8');
  const code = src.slice(src.indexOf("const fs = require"));
  assert.ok(!/studio-docs/.test(code), 'a corpus path in the code scopes this to one project again');
});
