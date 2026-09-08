#!/usr/bin/env node
'use strict';

/**
 * Run every step that has to follow a corpus-wide C3-05 pass, in order.
 *
 * The order is not cosmetic. Each step depends on the one before it, and two of
 * them fail silently if run out of sequence:
 *
 *   1. Anchor repair MUST come before anything reads the corpus as final. A
 *      heading's anchor is derived from its text, so the pass renamed anchors
 *      under every link pointing at them. It needs the snapshot taken before
 *      the pass.
 *   2. A skills mirror MUST be resynced, for a project that keeps one. A pass
 *      over the docs tree edits the mirrored copy and leaves the source copy
 *      untouched, which breaks byte identity for every mirrored file at once.
 *      Skipped, and reported as skipped, when no mirror is named.
 *   3. Integrity verification MUST compare against the pre-pass ref, so it has
 *      to run before anyone commits.
 *
 * Every step is read-only unless --apply is passed.
 *
 * Usage:
 *   node fix/finish-dash-pass.js <corpus-dir>              # report only
 *   node fix/finish-dash-pass.js <corpus-dir> --apply
 *   node fix/finish-dash-pass.js <corpus-dir> --apply --ref=<sha>
 *
 * For a project that keeps a skills mirror, add step 2:
 *   --mirror-src=<dir> --mirror-dir=<dir>
 *   --mirror-index=<file>      a file mirrored from outside the source dir
 *   --mirror-only=a.md,b.md    files that exist only in the mirror by design
 */

const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = path.join(__dirname, '..');

function run(label, cmd, args, opts = {}) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(label);
  console.log('='.repeat(70));
  try {
    const out = execFileSync(cmd, args, {
      cwd: opts.cwd || SCRIPTS,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    process.stdout.write(out);
    return { ok: true, out };
  } catch (err) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    return { ok: false, out: err.stdout || '', status: err.status };
  }
}

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const opt = (name) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };
  const ref = opt('ref') || 'HEAD';
  const writeFlag = apply ? ['--apply'] : [];

  const positional = argv.filter((a) => !a.startsWith('--'));
  if (positional.length !== 1) {
    console.error('Usage: finish-dash-pass.js <corpus-dir> [--apply] [--ref=<sha>]');
    console.error('       [--mirror-src=<dir> --mirror-dir=<dir> [--mirror-index=<file>] [--mirror-only=a.md,b.md]]');
    process.exit(2);
  }
  const CORPUS = path.resolve(positional[0]);
  const mirrorSrc = opt('mirror-src');
  const mirrorDir = opt('mirror-dir');
  if (Boolean(mirrorSrc) !== Boolean(mirrorDir)) {
    console.error('finish-dash-pass: --mirror-src and --mirror-dir must be given together.');
    process.exit(2);
  }

  const results = {};

  // Step 0. Is the punctuation actually gone? If not, the pass is unfinished
  // and repairing anchors now would snapshot a half-done state.
  const remaining = run('STEP 0  remaining C3-05 findings', 'node', [
    'fix/fix-dashes.js',
    CORPUS,
    '--report',
  ]);
  const flaggedMatch = /flagged lines\s+(\d+)/.exec(remaining.out || '');
  const flagged = flaggedMatch ? parseInt(flaggedMatch[1], 10) : -1;
  results.flagged = flagged;
  if (flagged > 0) {
    console.log(`\n${flagged} line(s) still carry banned punctuation.`);
    console.log('Finish the pass before running the wrap-up, or the anchor repair');
    console.log('records a half-done state as final.');
    process.exitCode = 1;
    return;
  }

  // Step 1. Repoint every link whose target heading was renamed.
  results.anchors = run('STEP 1  repair anchor links', 'node', [
    'fix/repair-anchors.js',
    '--repair',
    CORPUS,
    ...writeFlag,
  ]);

  // Step 2. Restore any mirror the project requires to be byte-identical.
  // Reported as skipped rather than omitted: a project that has a mirror and
  // forgets the flags would otherwise read a clean summary over a broken one.
  if (mirrorSrc && mirrorDir) {
    const mirrorIndex = opt('mirror-index');
    const mirrorOnly = opt('mirror-only');
    results.mirror = run('STEP 2  resync the mirror', 'node', [
      'sync-mirror.js',
      mirrorSrc,
      mirrorDir,
      ...(mirrorIndex ? [`--index=${mirrorIndex}`] : []),
      ...(mirrorOnly ? [`--mirror-only=${mirrorOnly}`] : []),
      ...(apply ? ['--apply'] : []),
    ]);
  } else {
    console.log(`\n${'='.repeat(70)}`);
    console.log('STEP 2  resync the mirror: SKIPPED, no --mirror-src/--mirror-dir given');
    console.log('='.repeat(70));
    results.mirror = { ok: true, skipped: true, out: '' };
  }

  // Step 3. Prove the whole pass changed punctuation and nothing else.
  results.integrity = run('STEP 3  verify only punctuation changed', 'node', [
    'fix/verify-edit-integrity.js',
    CORPUS,
    `--ref=${ref}`,
    '--budget=6',
  ]);

  // Step 4. No link may point at a heading that no longer exists.
  results.audit = run('STEP 4  audit every anchor link', 'node', [
    'fix/repair-anchors.js',
    '--audit',
    CORPUS,
  ]);

  // Step 5. What the rest of the standard still says about the corpus.
  results.sweep = run('STEP 5  full doc-standards sweep', 'node', [
    'sweep-docs.js',
    CORPUS,
  ]);

  console.log(`\n${'='.repeat(70)}`);
  console.log('WRAP-UP SUMMARY');
  console.log('='.repeat(70));
  console.log(`C3-05 remaining      ${flagged}`);
  console.log(`anchor repair        ${results.anchors.ok ? 'ok' : 'FAILED'}`);
  console.log(`mirror resync        ${results.mirror.skipped ? 'skipped' : results.mirror.ok ? 'ok' : 'FAILED'}`);
  console.log(`edit integrity       ${results.integrity.ok ? 'punctuation only' : 'ISSUES FOUND'}`);
  const dead = /dead\s+(\d+)/.exec(results.audit.out || '');
  console.log(`dead anchors         ${dead ? dead[1] : 'unknown'}`);
  if (!apply) {
    console.log('\nDry run. Pass --apply to write the anchor repair and any mirror resync.');
  }
  if (!results.integrity.ok) process.exitCode = 1;
}

main();
