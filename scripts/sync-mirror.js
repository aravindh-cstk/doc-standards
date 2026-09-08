#!/usr/bin/env node
'use strict';

/**
 * Restores byte-identical parity between `skills/src/` and `docs/prompts/`.
 *
 * studio-docs keeps 84 skill files in two places and `scripts/lint-skills.ts`
 * requires the two copies to match byte for byte. A deterministic fixer keeps
 * that true for free: run it over both directories and both get the same edit.
 *
 * A fixer that asks a model does not. `fix/fix-emoji-italics.js --llm` walks
 * `docs/` first, reaching `docs/prompts/` at file 185, then walks `skills/`,
 * reaching `skills/src/` at file 272. It rewrites the two copies of one skill
 * in two separate model calls, and two calls on the same line do not have to
 * return the same sentence. The mirrors drift, and `npm run lint` fails in
 * studio-docs after the pass has already written 170 files.
 *
 * So this runs after any model-backed pass. `skills/src/` is the canonical
 * side, stated in studio-docs/CLAUDE.md, so the copy only ever goes that way.
 *
 * The two files that legitimately exist only in `docs/prompts/` are left alone:
 * `index.md` is the human landing page and `skills-index.md` is mirrored from
 * `skills/skills-index.md` rather than from `src/`. Both are named in
 * lint-skills.ts as the only acceptable diffs.
 *
 * Usage:
 *   node sync-mirror.js            # report drift, change nothing
 *   node sync-mirror.js --apply
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(REPO_ROOT, 'studio-docs', 'skills', 'src');
const MIRROR = path.join(REPO_ROOT, 'studio-docs', 'docs', 'prompts');
const INDEX_SRC = path.join(REPO_ROOT, 'studio-docs', 'skills', 'skills-index.md');
const INDEX_MIRROR = path.join(MIRROR, 'skills-index.md');

/** Only in docs/prompts by design, per lint-skills.ts. */
const MIRROR_ONLY = new Set(['index.md', 'skills-index.md']);

function pairs() {
  const out = [{ from: INDEX_SRC, to: INDEX_MIRROR, name: 'skills-index.md' }];
  for (const name of fs.readdirSync(SRC).sort()) {
    if (!name.endsWith('.md')) continue;
    out.push({ from: path.join(SRC, name), to: path.join(MIRROR, name), name });
  }
  return out;
}

function main() {
  const apply = process.argv.includes('--apply');
  const drifted = [];
  const missing = [];

  for (const { from, to, name } of pairs()) {
    if (!fs.existsSync(to)) {
      missing.push(name);
      if (apply) fs.copyFileSync(from, to);
      continue;
    }
    if (fs.readFileSync(from, 'utf8') !== fs.readFileSync(to, 'utf8')) {
      drifted.push(name);
      if (apply) fs.copyFileSync(from, to);
    }
  }

  // A file in the mirror with no source is drift in the other direction, and
  // copying cannot fix it. Report it rather than delete anything.
  const orphans = fs
    .readdirSync(MIRROR)
    .filter((n) => n.endsWith('.md') && !MIRROR_ONLY.has(n) && !fs.existsSync(path.join(SRC, n)));

  console.log(`mode        ${apply ? 'apply' : 'report'}`);
  console.log(`pairs       ${pairs().length}`);
  console.log(`drifted     ${drifted.length}`);
  console.log(`missing     ${missing.length}`);
  console.log(`orphaned    ${orphans.length}`);

  for (const n of drifted.slice(0, 30)) console.log(`  drift    ${n}`);
  for (const n of missing) console.log(`  missing  docs/prompts/${n}`);
  for (const n of orphans) console.log(`  orphan   docs/prompts/${n}, no skills/src counterpart`);

  if (!apply && (drifted.length || missing.length)) {
    console.log('\nRun with --apply to copy skills/src over docs/prompts.');
    process.exit(1);
  }
  if (orphans.length) process.exit(1);
}

if (require.main === module) main();

module.exports = { pairs, SRC, MIRROR, MIRROR_ONLY };
