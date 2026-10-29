'use strict';

const fs = require('fs');
const path = require('path');
const registry = require('../data/rules-registry.json');
const checkSources = require('../data/check-sources.json');

const CHECKS_DIR = path.join(__dirname, '..', 'checks');
const ID_RE = /^([A-Za-z]+\d*)-(\d+)$/;
// Rule IDs a check module states inline. The wordlist checks instead take the
// id from their data file, so they never appear here and are validated through
// their data files below.
const EMITTED_RULE_RE = /ruleId:\s*'([A-Z0-9-]+)'/g;

function byId(id) {
  return registry.find((r) => r.id === id) || null;
}

function byCheckId(checkId) {
  return registry.filter((r) => r.checkId === checkId);
}

/** Rules applicable to a doc type: entries tagged "all" plus entries tagged with this specific type. */
function forDocType(docType) {
  return registry.filter((r) => r.docTypes.includes('all') || r.docTypes.includes(docType));
}

function byTier(tier, docType) {
  const scoped = docType ? forDocType(docType) : registry;
  return scoped.filter((r) => r.tier === tier);
}

/**
 * Next free ID for a prefix, computed as the highest numeric suffix plus one.
 *
 * Always compute, never infer the next number by topic. IDs are dense but not
 * category-semantic: C3-13 is the retry-count rule and C3-14 the ordered-list
 * rule, neither of which is a sibling in meaning of the C3-12 question rule
 * they sit beside. Guessing "the next style rule is C3-13" is how a new check
 * ends up emitting an ID that already belongs to something else.
 */
function nextRuleId(prefix) {
  let max = 0;
  for (const rule of registry) {
    const m = ID_RE.exec(rule.id);
    if (m && m[1] === prefix) max = Math.max(max, parseInt(m[2], 10));
  }
  const width = String(max + 1).length < 2 ? 2 : String(max + 1).length;
  return `${prefix}-${String(max + 1).padStart(width, '0')}`;
}

/** The rule IDs each check module names inline, read from source. */
function emittedRuleIds() {
  const out = {};
  for (const file of fs.readdirSync(CHECKS_DIR)) {
    if (!file.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(CHECKS_DIR, file), 'utf8');
    const ids = new Set();
    let m;
    EMITTED_RULE_RE.lastIndex = 0;
    while ((m = EMITTED_RULE_RE.exec(src)) !== null) ids.add(m[1]);
    if (ids.size) out[`checks/${file}`] = ids;
  }
  return out;
}

/**
 * Structural invariants the test suite asserts, so a hand-edited registry
 * cannot silently break the loop.
 *
 * The load-bearing one is the last: a check that emits a rule ID owned by a
 * different check reports the wrong rule text to the reader while looking
 * perfectly healthy. That is exactly what happened when ordered-list-sequence
 * shipped emitting C3-13, which belongs to retry-attempt-count-bold.
 *
 * Returns an array of problem strings, empty when clean.
 */
function validateRegistry() {
  const problems = [];
  const seen = new Set();

  for (const rule of registry) {
    if (!ID_RE.test(rule.id)) problems.push(`Rule id "${rule.id}" is not in PREFIX-NN form.`);
    if (seen.has(rule.id)) problems.push(`Duplicate rule id "${rule.id}".`);
    seen.add(rule.id);

    if (![1, 2, 3].includes(rule.tier)) problems.push(`Rule ${rule.id} has tier ${rule.tier}, expected 1, 2 or 3.`);
    if (rule.tier === 3 && rule.checkId) {
      problems.push(`Rule ${rule.id} is tier 3 but names checkId "${rule.checkId}". Tier 3 means no automated check.`);
    }
    if (rule.tier !== 3 && !rule.checkId) {
      problems.push(`Rule ${rule.id} is tier ${rule.tier} but has no checkId.`);
    }
    if (rule.checkId && !checkSources[rule.checkId]) {
      problems.push(`Rule ${rule.id} names checkId "${rule.checkId}", which is absent from data/check-sources.json.`);
    }
    if (!Array.isArray(rule.docTypes) || rule.docTypes.length === 0) {
      problems.push(`Rule ${rule.id} has no docTypes.`);
    }
  }

  for (const [checkId, source] of Object.entries(checkSources)) {
    for (const ruleId of source.rules || []) {
      const rule = byId(ruleId);
      if (!rule) problems.push(`check-sources.json entry "${checkId}" lists unknown rule "${ruleId}".`);
      else if (rule.checkId !== checkId) {
        problems.push(`check-sources.json entry "${checkId}" claims ${ruleId}, but the registry pairs it with "${rule.checkId}".`);
      }
    }
  }

  for (const [module, ids] of Object.entries(emittedRuleIds())) {
    for (const ruleId of ids) {
      const rule = byId(ruleId);
      if (!rule) {
        problems.push(`${module} emits ruleId "${ruleId}", which is not in the registry.`);
        continue;
      }
      const owner = checkSources[rule.checkId];
      if (owner && owner.module && owner.module !== module) {
        problems.push(
          `${module} emits ruleId "${ruleId}", but the registry pairs it with checkId "${rule.checkId}", owned by ${owner.module}.`
        );
      }
    }
  }

  return problems;
}

/** checkIds registered in the registry that no module implements. Reported, not failed, since each is a known gap. */
function unimplementedCheckIds() {
  return Object.entries(checkSources)
    .filter(([, source]) => source.kind === 'unimplemented' || !source.module)
    .map(([checkId, source]) => ({ checkId, rules: source.rules || [] }));
}

/**
 * Tier-1 and tier-2 rules whose checkId names a module that never emits their
 * ID as a literal. Reported, not failed, and frozen by a baseline test.
 *
 * Built after C7-02 was found to have never fired once. It was tier 2 with
 * checkId "duplicate-links", check-sources.json listed it there, so every
 * pairing test in validateRegistry passed, while heuristic-flags.js emitted
 * only C5-04. The registry advertised coverage that did not exist.
 *
 * This cannot be a hard failure, and the reason is worth stating so nobody
 * promotes it to one. check-sources.json's `rules` array is a claim about what
 * a check ADDRESSES, not what it EMITS. Several registry rules legitimately map
 * to one emitted finding: B1-01, B2-01 and C1-03 are all the section-order rule
 * and all report as C1-01. Others are emitted from a computed variable rather
 * than a literal, so `emittedRuleIds`, which greps for `ruleId: '...'`, cannot
 * see them (section-structure.js:68 and :85, next-steps-links.js:15).
 *
 * So the list has legitimate members. What must never happen is the list
 * GROWING unnoticed, which is what test/gap-loop.test.js freezes.
 */
function unemittedRuleClaims() {
  const emitted = emittedRuleIds();
  const out = [];
  for (const [checkId, source] of Object.entries(checkSources)) {
    if (source.kind !== 'structural' && source.kind !== 'regex') continue;
    if (!source.module) continue;
    const emittedByModule = new Set(emitted[source.module] || []);
    for (const ruleId of source.rules || []) {
      const rule = byId(ruleId);
      if (!rule || rule.tier === 3) continue;
      if (!emittedByModule.has(ruleId)) out.push(`${checkId}:${ruleId}`);
    }
  }
  return out.sort();
}

module.exports = {
  registry,
  byId,
  byCheckId,
  forDocType,
  byTier,
  nextRuleId,
  validateRegistry,
  unimplementedCheckIds,
  unemittedRuleClaims,
  emittedRuleIds,
  checkSources,
};
