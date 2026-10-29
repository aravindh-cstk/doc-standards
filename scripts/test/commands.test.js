'use strict';

// Guards the slash commands in .claude/commands/.
//
// Every command opens with the same path resolver, because the toolchain sits
// in two different places depending on the consumer: this checkout is its own
// git root, and in a consuming project it is a doc-standards/ subfolder. The
// resolver handles both. Ten copies of eight lines drift, so this asserts they
// have not, and that no command has reverted to the single-layout form that
// broke both original commands when run from inside this repo.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', '..', '.claude', 'commands');

/**
 * The canonical resolver, byte for byte. A command that formats it differently
 * still works, and the point of comparing verbatim is that a fix applied to one
 * copy has to reach all of them. Keep this in sync with the block in
 * .claude/commands/README.md.
 */
const RESOLVER = [
  'ROOT=$(git rev-parse --show-toplevel)',
  'if [ -f "$ROOT/scripts/lint/lint-doc.js" ]; then',
  '  STANDARDS="$ROOT"',
  'elif [ -f "$ROOT/doc-standards/scripts/lint/lint-doc.js" ]; then',
  '  STANDARDS="$ROOT/doc-standards"',
  'else',
  '  D=$PWD',
  '  while [ "$D" != "/" ]; do',
  '    if [ -f "$D/doc-standards/scripts/lint/lint-doc.js" ]; then STANDARDS="$D/doc-standards"; break; fi',
  '    D=$(dirname "$D")',
  '  done',
  'fi',
  '[ -n "$STANDARDS" ] || { echo "doc-standards not found from $PWD"; exit 2; }',
  'REVIEW="$ROOT/.doc-review"',
].join('\n');

/** The single-layout form the resolver replaced. It resolves to a path that does not exist here. */
const BROKEN_FORM = 'STANDARDS="$ROOT/doc-standards"\n';

const EXPECTED = [
  'add-doc-rule',
  'adjudicate-tier3',
  'audit-docs',
  'classify-doc-types',
  'doc-gap',
  'doc-gate',
  'onboard-docs-repo',
  'revamp-api-ref',
  'revamp-cli-doc',
  'revamp-doc',
];

function commandFiles() {
  return fs.readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort();
}

const read = (f) => fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8');

test('all ten commands are present', () => {
  assert.deepEqual(commandFiles().map((f) => path.basename(f, '.md')), EXPECTED);
});

test('every command carries the resolver verbatim', () => {
  for (const file of commandFiles()) {
    assert.ok(
      read(file).includes(RESOLVER),
      `${file} does not carry the shared resolver verbatim. Copy it from .claude/commands/README.md.`,
    );
  }
});

test('no command uses the single-layout resolver that broke inside this repo', () => {
  for (const file of commandFiles()) {
    const body = read(file).replace(RESOLVER, '');
    assert.ok(
      !body.includes(BROKEN_FORM),
      `${file} assigns STANDARDS="$ROOT/doc-standards" outside the resolver. That path does not exist when this repo is its own git root.`,
    );
  }
});

test('no command hardcodes a consuming project name', () => {
  for (const file of commandFiles()) {
    assert.ok(
      !read(file).includes('studio-docs'),
      `${file} hardcodes studio-docs. Take the corpus from an argument so the command works for every consumer.`,
    );
  }
});

test('every command that writes scratch output directs it inside the repo', () => {
  for (const file of commandFiles()) {
    const body = read(file);
    if (!body.includes('review-candidates.js')) continue;
    const invocations = body.match(/review-candidates\.js[^\n`]*/g) || [];
    for (const call of invocations) {
      // Any of --out, --candidates or --verdicts is fine. What matters is that
      // the path is under $REVIEW, because the script's own default resolves to
      // the folder holding this checkout.
      assert.ok(
        call.includes('$REVIEW'),
        `${file} calls review-candidates.js without a $REVIEW path: ${call.trim()}. Its default resolves outside the repo.`,
      );
    }
  }
});

test('every command states its usage', () => {
  for (const file of commandFiles()) {
    const body = read(file);
    assert.match(body, /^# \/[a-z0-9-]+$/m, `${file} needs an "# /name" H1.`);
    assert.ok(body.includes('**Usage:**'), `${file} needs a "**Usage:**" line.`);
  }
});

test('no command references a flag its linter would reject', () => {
  // lint-api-ref.js has no --type flag. Passing one is silently ignored, and a
  // command written as though it types the page would report the wrong shape.
  for (const file of commandFiles()) {
    const lines = read(file).split('\n');
    for (const line of lines) {
      if (!line.includes('lint-api-ref.js')) continue;
      assert.ok(
        !line.includes('--type'),
        `${file} passes --type to lint-api-ref.js, which has no such flag: ${line.trim()}`,
      );
    }
  }
});
