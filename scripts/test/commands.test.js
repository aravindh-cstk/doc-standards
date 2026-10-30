'use strict';

// Guards the slash commands in .claude/commands/.
//
// Every command opens with the same path resolver, because the toolchain sits
// in a different place depending on the consumer: this checkout as its own git
// root, a doc-standards/ subfolder of a consuming project, the Claude Code
// plugin's own copy, or the ~/.doc-standards link that install-commands.sh
// makes for other agents. The resolver handles all of them. Seven copies of eight lines drift, so this asserts they
// have not, and that no command has reverted to the single-layout form that
// broke both original commands when run from inside this repo.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const COMMANDS_DIR = path.join(REPO, '.claude', 'commands');

/**
 * The canonical resolver, byte for byte. A command that formats it differently
 * still works, and the point of comparing verbatim is that a fix applied to one
 * copy has to reach all of them. Keep this in sync with the block in
 * .claude/README.md.
 */
const RESOLVER = [
  'ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)',
  'STANDARDS=',
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
  'if [ -z "$STANDARDS" ] && [ -f "${CLAUDE_PLUGIN_ROOT}/scripts/lint/lint-doc.js" ]; then STANDARDS="${CLAUDE_PLUGIN_ROOT}"; fi',
  'if [ -z "$STANDARDS" ] && [ -f "$HOME/.doc-standards/scripts/lint/lint-doc.js" ]; then STANDARDS="$HOME/.doc-standards"; fi',
  '[ -n "$STANDARDS" ] || { echo "doc-standards not found from $PWD"; exit 2; }',
  'REVIEW="$ROOT/.doc-review"',
].join('\n');

/**
 * The check that stops a toolchain-editing command from running against the
 * plugin's copy, which each plugin update replaces. Keep this in sync with the
 * block in doc-gate.md.
 */
const GUARD = [
  'case "$STANDARDS" in */.claude/plugins/*) echo "Run this command from inside your doc-standards clone, not the plugin copy at $STANDARDS."; exit 2 ;; esac',
  '[ "$(git -C "$STANDARDS" rev-parse --show-toplevel 2>/dev/null)" = "$(cd "$STANDARDS" && pwd -P)" ] || { echo "$STANDARDS is not a git clone of doc-standards. Run this command from inside your clone."; exit 2; }',
].join('\n');

/** The commands that edit or check the toolchain itself. */
const TOOLCHAIN_COMMANDS = ['add-doc-rule', 'apply-feedback', 'doc-gap', 'doc-gate'];

/** The single-layout form the resolver replaced. It resolves to a path that does not exist here. */
const BROKEN_FORM = 'STANDARDS="$ROOT/doc-standards"\n';

const EXPECTED = [
  'add-doc-rule',
  'apply-feedback',
  'audit-docs',
  'doc-gap',
  'doc-gate',
  'fix-docs',
  'onboard-docs-repo',
];

function commandFiles() {
  return fs.readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort();
}

const read = (f) => fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8');

test('all seven commands are present', () => {
  assert.deepEqual(commandFiles().map((f) => path.basename(f, '.md')), EXPECTED);
});

test('every command carries the resolver verbatim', () => {
  for (const file of commandFiles()) {
    assert.ok(
      read(file).includes(RESOLVER),
      `${file} does not carry the shared resolver verbatim. Copy it from .claude/README.md.`,
    );
  }
});

test('the commands folder holds only the commands', () => {
  // Claude Code reads every markdown file in this folder as a command, and the
  // plugin ships the whole folder, so an index here becomes a stray /README.
  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md')).sort();
  assert.deepEqual(
    files,
    EXPECTED.map((name) => `${name}.md`),
    'Only command files belong in .claude/commands/. The index lives at .claude/README.md.',
  );
});

test('the plugin manifests ship the commands folder', () => {
  const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(REPO, ...p), 'utf8'));
  const plugin = readJson('.claude-plugin', 'plugin.json');
  const marketplace = readJson('.claude-plugin', 'marketplace.json');

  assert.equal(plugin.name, 'doc-standards');
  assert.equal(path.resolve(REPO, plugin.commands), COMMANDS_DIR);
  // A version pins every install to it until somebody bumps it. Without one,
  // each pushed commit counts as an update.
  assert.equal(plugin.version, undefined, 'plugin.json sets a version, so pushes stop reaching installs.');

  const entry = marketplace.plugins.find((p) => p.name === plugin.name);
  assert.ok(entry, 'marketplace.json does not list the doc-standards plugin.');
  assert.equal(entry.source, './', 'The marketplace entry must ship the whole repository, scripts included.');
});

test('every command that edits the toolchain refuses the plugin copy', () => {
  for (const name of TOOLCHAIN_COMMANDS) {
    assert.ok(
      read(`${name}.md`).includes(GUARD),
      `${name}.md does not carry the clone check verbatim. Copy it from doc-gate.md.`,
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
