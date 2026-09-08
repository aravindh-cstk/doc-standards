#!/usr/bin/env node
'use strict';

/**
 * Restores byte-identical parity between a source directory and a mirror of it.
 *
 * A doc set that keeps the same markdown in two places needs the two copies to
 * match byte for byte, and a deterministic fixer keeps that true for free: run
 * it over both directories and both get the same edit.
 *
 * A fixer that asks a model does not. `fix/fix-emoji-italics.js --llm` walks
 * one directory and then the other, so it rewrites the two copies of one file
 * in two separate model calls, and two calls on the same line do not have to
 * return the same sentence. The mirrors drift, and the consuming repo's own
 * parity check fails after the pass has already written every file.
 *
 * So this runs after any model-backed pass. The source side is canonical, so
 * the copy only ever goes that way.
 *
 * Usage:
 *   node sync-mirror.js <source-dir> <mirror-dir>            # report drift
 *   node sync-mirror.js <source-dir> <mirror-dir> --apply
 *
 *   --index=<file>        a file mirrored from outside the source directory,
 *                         copied to <mirror-dir>/<its basename>
 *   --mirror-only=a,b     files that exist only in the mirror by design, so
 *                         they are not reported as orphans
 *
 * The studio-docs layout this was written for is:
 *   node sync-mirror.js ../../studio-docs/skills/src ../../studio-docs/docs/prompts \
 *     --index=../../studio-docs/skills/skills-index.md \
 *     --mirror-only=index.md,skills-index.md
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { apply: false, index: null, mirrorOnly: [], dirs: [] };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg.startsWith('--index=')) args.index = arg.slice('--index='.length);
    else if (arg.startsWith('--mirror-only=')) {
      args.mirrorOnly = arg
        .slice('--mirror-only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (!arg.startsWith('--')) args.dirs.push(arg);
  }
  return args;
}

/**
 * Every file that must exist identically on both sides.
 *
 * `index` is listed first because it comes from outside the source directory,
 * so the readdir below would never reach it.
 */
function pairs({ src, mirror, index }) {
  const out = [];
  if (index) {
    out.push({ from: index, to: path.join(mirror, path.basename(index)), name: path.basename(index) });
  }
  for (const name of fs.readdirSync(src).sort()) {
    if (!name.endsWith('.md')) continue;
    out.push({ from: path.join(src, name), to: path.join(mirror, name), name });
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.dirs.length !== 2) {
    console.error('Usage: sync-mirror.js <source-dir> <mirror-dir> [--apply] [--index=<file>] [--mirror-only=a.md,b.md]');
    process.exit(2);
  }

  const src = path.resolve(args.dirs[0]);
  const mirror = path.resolve(args.dirs[1]);
  const index = args.index ? path.resolve(args.index) : null;

  for (const [label, dir] of [['source', src], ['mirror', mirror]]) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      console.error(`sync-mirror: ${label} directory does not exist: ${dir}`);
      process.exit(2);
    }
  }
  if (index && !fs.existsSync(index)) {
    console.error(`sync-mirror: --index file does not exist: ${index}`);
    process.exit(2);
  }

  const mirrorOnly = new Set(args.mirrorOnly);
  const all = pairs({ src, mirror, index });
  const drifted = [];
  const missing = [];

  for (const { from, to, name } of all) {
    if (!fs.existsSync(to)) {
      missing.push(name);
      if (args.apply) fs.copyFileSync(from, to);
      continue;
    }
    if (fs.readFileSync(from, 'utf8') !== fs.readFileSync(to, 'utf8')) {
      drifted.push(name);
      if (args.apply) fs.copyFileSync(from, to);
    }
  }

  // A file in the mirror with no source is drift in the other direction, and
  // copying cannot fix it. Report it rather than delete anything.
  const sourceNames = new Set(all.map((x) => x.name));
  const orphans = fs
    .readdirSync(mirror)
    .filter((n) => n.endsWith('.md') && !mirrorOnly.has(n) && !sourceNames.has(n));

  // Whichever reads shorter. A relative path is easier to scan for a sibling
  // checkout and unreadable for anything else, which is what a run against a
  // temp directory or another volume produces.
  const rel = (p) => {
    const r = path.relative(process.cwd(), p) || '.';
    return r.length <= p.length ? r : p;
  };

  console.log(`mode        ${args.apply ? 'apply' : 'report'}`);
  console.log(`source      ${rel(src)}`);
  console.log(`mirror      ${rel(mirror)}`);
  console.log(`pairs       ${all.length}`);
  console.log(`drifted     ${drifted.length}`);
  console.log(`missing     ${missing.length}`);
  console.log(`orphaned    ${orphans.length}`);

  for (const n of drifted.slice(0, 30)) console.log(`  drift    ${n}`);
  for (const n of missing) console.log(`  missing  ${rel(path.join(mirror, n))}`);
  for (const n of orphans) console.log(`  orphan   ${rel(path.join(mirror, n))}, no counterpart in ${rel(src)}`);

  if (!args.apply && (drifted.length || missing.length)) {
    console.log(`\nRun with --apply to copy ${rel(src)} over ${rel(mirror)}.`);
    process.exit(1);
  }
  if (orphans.length) process.exit(1);
}

if (require.main === module) main();

module.exports = { pairs, parseArgs };
