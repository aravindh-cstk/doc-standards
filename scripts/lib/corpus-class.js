'use strict';

/**
 * Which corpus a file belongs to, and therefore which page-shape rules apply.
 *
 * The data and the reasoning live in data/corpus-classes.json. This module is
 * only the lookup: it normalises a path to one relative to its own project,
 * walks the pattern list in order, and answers whether a rule id is exempt.
 *
 * Project-relative, not workspace-relative. The patterns used to carry a
 * project directory name (`studio-docs/docs/prompts/`), which meant they
 * matched one corpus and classified every other project's files as the
 * default, so the exemptions silently stopped applying the moment this repo
 * was shared. A prefix now names a path inside whichever project holds the
 * file, so `docs/prompts/` means the same thing in every checkout.
 *
 * A project whose layout these conventions do not describe sets
 * DOC_STANDARDS_CORPUS_CLASSES to its own JSON file. Its patterns are tried
 * before these and its classes merge over them.
 */

const fs = require('fs');
const path = require('path');

const base = require('../data/corpus-classes.json');

/** The directory holding the projects, one level above this checkout. */
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');

/** This checkout's own directory name, so a file inside it is recognised whatever it is called. */
const STANDARDS_DIR = path.basename(path.resolve(__dirname, '..', '..'));

function loadOverride() {
  const file = process.env.DOC_STANDARDS_CORPUS_CLASSES;
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  } catch (err) {
    // A broken override must not stop a lint run, and must not be silent
    // either, or a project believes its exemptions are live when they are not.
    console.error(`corpus-class: ignoring DOC_STANDARDS_CORPUS_CLASSES (${file}): ${err.message}`);
    return null;
  }
}

const override = loadOverride();

const config = override
  ? {
      classes: { ...base.classes, ...(override.classes || {}) },
      patterns: [...(override.patterns || []), ...base.patterns],
      default: override.default || base.default,
    }
  : base;

/** The path as a project would write it: relative to the project root, forward slashes. */
function toProjectRelative(filePath) {
  const abs = path.resolve(filePath);
  const rel = path.relative(WORKSPACE_ROOT, abs).split(path.sep).join('/');
  if (rel.startsWith('../')) return null;
  const cut = rel.indexOf('/');
  return cut === -1 ? '' : rel.slice(cut + 1);
}

/** The project directory a file sits in, or null when it is outside the workspace. */
function projectOf(filePath) {
  const abs = path.resolve(filePath);
  const rel = path.relative(WORKSPACE_ROOT, abs).split(path.sep).join('/');
  if (rel.startsWith('../') || rel === '') return null;
  const cut = rel.indexOf('/');
  return cut === -1 ? rel : rel.slice(0, cut);
}

/**
 * The class name for a file.
 *
 * First matching prefix wins, which is why the pattern list is ordered from
 * specific to general. A path outside the workspace falls to the configured
 * default rather than to `published`: an unrecognised file is not evidence
 * that it ships.
 */
function classify(filePath) {
  // The standards tree is never a published page, whatever it is named.
  if (projectOf(filePath) === STANDARDS_DIR) return 'internal';

  const rel = toProjectRelative(filePath);
  if (rel === null) return config.default;

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

module.exports = {
  classify,
  exemptRulesFor,
  isExempt,
  toProjectRelative,
  projectOf,
  config,
  WORKSPACE_ROOT,
  STANDARDS_DIR,
  // Kept as the old name so callers outside this tree do not break.
  REPO_ROOT: WORKSPACE_ROOT,
};
