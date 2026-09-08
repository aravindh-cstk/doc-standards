'use strict';

/**
 * Which corpus a file belongs to, and therefore which page-shape rules apply.
 *
 * The data and the reasoning live in data/corpus-classes.json. This module is
 * only the lookup: it normalises a path to a repo-relative one, walks the
 * pattern list in order, and answers whether a given rule id is exempt.
 *
 * Repo-relative means relative to the directory that holds both `doc-standards`
 * and `studio-docs`, so the patterns read the same whether a caller passed an
 * absolute path, a path relative to scripts/, or one relative to the repo root.
 * Every caller in this tree does at least two of those.
 */

const path = require('path');
const config = require('../data/corpus-classes.json');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/** The path as the patterns are written: relative to the repo root, forward slashes. */
function toRepoRelative(filePath) {
  const abs = path.resolve(filePath);
  const rel = path.relative(REPO_ROOT, abs);
  return rel.split(path.sep).join('/');
}

/**
 * The class name for a file.
 *
 * First matching prefix wins, which is why the pattern list is ordered from
 * specific to general. A path outside the repo falls to the configured default
 * rather than to `published`: an unrecognised file is not evidence that it ships.
 */
function classify(filePath) {
  const rel = toRepoRelative(filePath);
  for (const { prefix, class: className } of config.patterns) {
    if (rel === prefix || rel.startsWith(prefix)) return className;
  }
  return config.default;
}

/**
 * The rule ids this file is exempt from, as a Set.
 *
 * Returns an empty Set for an unknown class rather than throwing, because a
 * typo in the data file should not stop a lint run. The audit test in
 * test/corpus-class.test.js is what catches the typo.
 */
function exemptRulesFor(filePath) {
  const className = classify(filePath);
  const entry = config.classes[className];
  return new Set(entry ? entry.exemptRules : []);
}

/** True when this rule does not apply to this file. */
function isExempt(filePath, ruleId) {
  return exemptRulesFor(filePath).has(ruleId);
}

module.exports = { classify, exemptRulesFor, isExempt, toRepoRelative, config, REPO_ROOT };
