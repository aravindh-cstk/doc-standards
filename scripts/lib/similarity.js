'use strict';

/**
 * Word-shingle overlap, the shared basis for every duplication check.
 *
 * Lifted out of checks/heuristic-flags.js, which had the only copy, so that
 * C7-01 (near-identical sections) and C7-04 (a block restating a table row)
 * measure similarity the same way. Two duplication rules disagreeing about what
 * counts as similar is how one of them ends up quietly unenforceable.
 */

/** Overlapping n-word windows, punctuation and case stripped. */
function shingles(text, n = 5) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const result = new Set();
  for (let i = 0; i + n <= words.length; i++) result.add(words.slice(i, i + n).join(' '));
  return result;
}

/** Intersection over union. 0 when either side is empty. */
function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * How much of `block` is accounted for by `source`, rather than how alike the
 * two are overall.
 *
 * Jaccard punishes a length mismatch, which is wrong for the table case: a row
 * is short and the block echoing it is long, so a real restatement scores low.
 * Containment asks the question the rule actually asks, which is whether the
 * block adds anything the source did not already carry.
 */
function containment(block, source) {
  if (block.size === 0) return 0;
  let shared = 0;
  for (const item of block) if (source.has(item)) shared++;
  return shared / block.size;
}

module.exports = { shingles, jaccard, containment };
