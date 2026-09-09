#!/usr/bin/env node
'use strict';

/**
 * Keep anchor links working across a pass that rewrites headings.
 *
 * A heading's anchor is derived from its text, so any rule that edits heading
 * wording silently changes the anchor every link to it depends on. The C3-05
 * pass does exactly that: 794 headings in this corpus contain an em dash, en
 * dash or semicolon, and 59 anchor links point at those headings. Fixing the
 * punctuation without this step turns all 59 into dead links, and a dead
 * in-page anchor fails quietly, because the page still loads.
 *
 * The map is built by comparing real before and after states rather than by
 * predicting what a rule will do. That way it covers the model's rewrites,
 * whose new wording cannot be predicted, as well as the deterministic ones.
 *
 * Usage:
 *   node fix/repair-anchors.js --snapshot <dir>            # before the pass
 *   node fix/repair-anchors.js --repair <dir>              # after it, dry run
 *   node fix/repair-anchors.js --repair <dir> --apply
 *   node fix/repair-anchors.js --audit <dir>               # list dead anchors
 */

const fs = require('fs');
const path = require('path');

const { collectDocs } = require('../lint/sweep-docs');
const { slugify } = require('../lib/slugify');

const DEFAULT_SNAPSHOT = path.join(__dirname, '..', '..', '..', '.doc-review', 'heading-slugs.json');

/**
 * GitHub's heading-to-anchor rule, which is what both the repo on GitHub and
 * the docs site use: strip markdown emphasis and inline code, drop anything
 * that is not a word character, space or hyphen, then replace spaces with
 * hyphens. Note it does NOT collapse runs of hyphens, which is why a heading
 * containing " - " produces a double hyphen in its anchor.
 */

/** Every heading in a file, as slug to text, skipping fenced code. */
function headingsOf(file) {
  const out = {};
  let inFence = false;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) out[slugify(m[2])] = m[2].trim();
  }
  return out;
}

const ANCHOR_RE = /\]\(([^)\s]*)#([^)\s]+)\)/g;

function targetFileFor(sourceFile, target) {
  if (/^https?:/i.test(target)) return null;
  if (target === '') return sourceFile;
  return path.normalize(path.join(path.dirname(sourceFile), target));
}

function snapshot(dir, outPath) {
  const files = collectDocs(path.resolve(dir));
  const data = {};
  for (const f of files) data[f] = headingsOf(f);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ takenAt: new Date().toISOString(), headings: data }, null, 1));
  const count = Object.values(data).reduce((n, h) => n + Object.keys(h).length, 0);
  console.log(`snapshotted ${count} heading(s) across ${files.length} file(s)`);
  console.log(`wrote ${outPath}`);
}

/**
 * Old slug to new slug, per file.
 *
 * A heading is matched across the two states by its TEXT where the text did not
 * change, and otherwise by position among the file's headings. Position is the
 * reliable key here because a punctuation pass rewrites wording but neither
 * adds, removes, nor reorders headings.
 */
function buildSlugMap(before, after) {
  const map = new Map();

  for (const [file, oldHeadings] of Object.entries(before)) {
    if (!fs.existsSync(file)) continue;
    const newHeadings = after[file] || headingsOf(file);
    const oldSlugs = Object.keys(oldHeadings);
    const newSlugs = Object.keys(newHeadings);

    const perFile = new Map();

    // Anything whose slug is unchanged needs no entry.
    const stillPresent = new Set(newSlugs);
    const changedOld = oldSlugs.filter((s) => !stillPresent.has(s));
    if (!changedOld.length) continue;

    const takenNew = new Set(oldSlugs.filter((s) => stillPresent.has(s)));
    const freeNew = newSlugs.filter((s) => !takenNew.has(s));

    if (changedOld.length === freeNew.length) {
      // Same count, same order: pair them off positionally.
      changedOld.forEach((oldSlug, i) => perFile.set(oldSlug, freeNew[i]));
    } else {
      // Counts differ, so a heading was added or removed alongside the rewrite.
      // Guessing would point links at the wrong section, so only unambiguous
      // single-candidate cases are mapped and the rest are reported.
      if (changedOld.length === 1 && freeNew.length === 1) {
        perFile.set(changedOld[0], freeNew[0]);
      } else {
        console.warn(
          `  ambiguous in ${path.basename(file)}: ${changedOld.length} changed heading(s) ` +
            `but ${freeNew.length} new slug(s), skipped`
        );
      }
    }

    if (perFile.size) map.set(file, perFile);
  }

  return map;
}

function repair(dir, snapshotPath, apply) {
  if (!fs.existsSync(snapshotPath)) {
    console.error(`No snapshot at ${snapshotPath}. Run --snapshot before the pass.`);
    process.exitCode = 2;
    return;
  }
  const before = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')).headings;
  const files = collectDocs(path.resolve(dir));
  const after = {};
  for (const f of files) after[f] = headingsOf(f);

  const slugMap = buildSlugMap(before, after);
  const renamed = [...slugMap.values()].reduce((n, m) => n + m.size, 0);
  console.log(`${renamed} heading anchor(s) changed across ${slugMap.size} file(s)`);

  // Every file in the corpus can link to a renamed heading, not just the files
  // whose own headings changed.
  let rewritten = 0;
  let touchedFiles = 0;
  const unresolved = [];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let changed = false;

    const updated = text.replace(ANCHOR_RE, (whole, target, anchor) => {
      const tf = targetFileFor(file, target);
      if (!tf) return whole;
      const perFile = slugMap.get(tf);
      if (perFile && perFile.has(anchor)) {
        changed = true;
        rewritten += 1;
        return `](${target}#${perFile.get(anchor)})`;
      }
      // Report an anchor that resolves to a known file but no known heading.
      if (after[tf] && !after[tf][anchor]) {
        unresolved.push({ file, target, anchor });
      }
      return whole;
    });

    if (changed) {
      touchedFiles += 1;
      if (apply) fs.writeFileSync(file, updated);
    }
  }

  console.log(`${rewritten} anchor link(s) repointed across ${touchedFiles} file(s)`);
  if (unresolved.length) {
    console.log(`\n${unresolved.length} anchor(s) point at no heading. These were already ` +
      'broken, or need a look by hand:');
    for (const u of unresolved.slice(0, 15)) {
      console.log(`  ${path.relative(process.cwd(), u.file)}  ->  ${u.target}#${u.anchor}`);
    }
    if (unresolved.length > 15) console.log(`  ... and ${unresolved.length - 15} more`);
  }
  if (!apply) console.log('\nPass --apply to write.');
}

function audit(dir) {
  const files = collectDocs(path.resolve(dir));
  const headings = {};
  for (const f of files) headings[f] = headingsOf(f);

  let total = 0;
  let external = 0;
  const dead = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(ANCHOR_RE)) {
      total += 1;
      const tf = targetFileFor(file, m[1]);
      if (!tf) {
        external += 1;
        continue;
      }
      if (!headings[tf]) {
        dead.push({ file, ref: `${m[1]}#${m[2]}`, why: 'target file not in corpus' });
      } else if (!headings[tf][m[2]]) {
        dead.push({ file, ref: `${m[1]}#${m[2]}`, why: 'no heading with that anchor' });
      }
    }
  }

  console.log(`anchor links      ${total}`);
  console.log(`external          ${external}`);
  console.log(`dead              ${dead.length}`);
  for (const d of dead) {
    console.log(`  ${path.relative(process.cwd(), d.file)}  ->  ${d.ref}   (${d.why})`);
  }
  if (dead.length) process.exitCode = 1;
}

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const snapArg = argv.find((a) => a.startsWith('--snapshot-file='));
  const snapshotPath = snapArg ? path.resolve(snapArg.split('=')[1]) : DEFAULT_SNAPSHOT;

  const idx = (flag) => argv.indexOf(flag);
  const valueAfter = (flag) => {
    const i = idx(flag);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };

  if (idx('--snapshot') >= 0) {
    const dir = valueAfter('--snapshot');
    if (!dir) return usage();
    return snapshot(dir, snapshotPath);
  }
  if (idx('--repair') >= 0) {
    const dir = valueAfter('--repair');
    if (!dir) return usage();
    return repair(dir, snapshotPath, apply);
  }
  if (idx('--audit') >= 0) {
    const dir = valueAfter('--audit');
    if (!dir) return usage();
    return audit(dir);
  }
  return usage();
}

function usage() {
  console.error('Usage:');
  console.error('  repair-anchors.js --snapshot <dir> [--snapshot-file=<path>]');
  console.error('  repair-anchors.js --repair <dir> [--apply] [--snapshot-file=<path>]');
  console.error('  repair-anchors.js --audit <dir>');
  process.exitCode = 2;
}

if (require.main === module) main();

module.exports = { slugify, headingsOf, buildSlugMap };
