#!/usr/bin/env node
'use strict';

/**
 * Regenerates REFERENCE-RULES.md and REFERENCE-CHECKS.md at the repo root from
 * data/rules-registry.json and data/check-sources.json. Re-run this manually
 * whenever a rule is added, retiered, renumbered, or given a check.
 *
 * The catalog in README.md's companion files is generated rather than written
 * by hand for one reason: a hand-maintained list of 181 rules drifts from the
 * registry the linter actually reads, and a reader cannot tell which of the two
 * is lying. Generating it means the only way to change the catalog is to change
 * the registry.
 *
 * Rule text, rationale and exception are quoted from the registry verbatim.
 * Only the surrounding prose is written here, and that prose obeys C3-05, so it
 * carries no em dash, no en dash and no semicolon.
 */

const fs = require('fs');
const path = require('path');
const {
  registry,
  checkSources,
  validateRegistry,
  unimplementedCheckIds,
  unemittedRuleClaims,
} = require('../lib/rules-registry');

const STANDARDS_DIR = path.join(__dirname, '..', '..');
const ID_RE = /^([A-Za-z]+\d*)-(\d+)$/;

const GROUP_TITLES = {
  AR: 'AR, API reference page anatomy',
  UG: 'UG, usage guide anatomy',
  B1: 'B1, the ordered audit checklist',
  B2: 'B2, the anti-pattern table',
  C1: 'C1, structure and flow',
  C2: 'C2, scannability',
  C3: 'C3, language and tone',
  C4: 'C4, code versus prose',
  C5: 'C5, cross-references',
  C6: 'C6, content accuracy and grouping',
  C7: 'C7, duplication',
  C8: 'C8, developer tone',
  C9: 'C9, CLI command documentation',
  FM: 'FM, front matter',
  MIG: 'MIG, migration guide specifics',
  RS1: 'RS1, role-based routing',
  RS2: 'RS2, quick start constraints',
  RS3: 'RS3, what a get started guide excludes',
  CLI: 'CLI, shared CLI rules',
  PLG: 'PLG, plugin guide specifics',
};

const KIND_NOTES = {
  structural: 'Parses the document model and reports on shape, order or completeness.',
  regex: 'Matches a named pattern against prose, outside code fences.',
  wordlist: 'Matches entries from a JSON data file, so the rule widens by data rather than by code.',
  unimplemented: 'Registered with no module behind it. The rule is stated and tiered, but nothing enforces it.',
  candidate: 'Emits a tier-3 candidate for human or judge adjudication rather than a finding.',
};

/** A table cell must not contain a raw pipe or a newline, either of which breaks the row. */
function cell(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n+/g, ' ').trim();
}

function prefixOf(id) {
  const m = ID_RE.exec(id);
  return m ? m[1] : 'other';
}

/** Group prefixes in the order they first appear in the registry, so output order tracks the source. */
function groupRegistry() {
  const groups = new Map();
  for (const rule of registry) {
    const prefix = prefixOf(rule.id);
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(rule);
  }
  return groups;
}

function banner(generatedFile) {
  return [
    `<!-- Generated file. Do not edit manually. -->`,
    `<!-- Source: scripts/data/rules-registry.json and scripts/data/check-sources.json -->`,
    `<!-- Regenerate: cd scripts && npm run build:readme -->`,
    '',
    `# ${generatedFile}`,
    '',
  ];
}

function buildRulesDoc() {
  const groups = groupRegistry();
  const tierCount = { 1: 0, 2: 0, 3: 0 };
  for (const rule of registry) tierCount[rule.tier] += 1;

  const out = banner('Rule catalog');

  out.push(
    'Every rule in `scripts/data/rules-registry.json`, grouped by prefix. This is the complete',
    'catalog. For what the groups mean and how tiers behave, read the Rule system section of',
    '[README.md](README.md). For which check enforces a rule, read [REFERENCE-CHECKS.md](REFERENCE-CHECKS.md).',
    '',
    `The registry holds **${registry.length} rules**: ${tierCount[1]} tier 1, ${tierCount[2]} tier 2, ${tierCount[3]} tier 3.`,
    '',
    'Linting this file reports tier-1 findings, and that is expected. A rule that bans a phrase has to',
    'print the phrase in order to state itself, so every finding here falls inside quoted registry',
    'text. The generated prose around the quotes carries none. The editor hook excludes this',
    'repository, so nothing blocks on it.',
    '',
    '## Counts by group',
    '',
    '| Group | Rules | Tier 1 | Tier 2 | Tier 3 | Stated in |',
    '| --- | --- | --- | --- | --- | --- |'
  );

  for (const [prefix, rules] of groups) {
    const t = { 1: 0, 2: 0, 3: 0 };
    for (const rule of rules) t[rule.tier] += 1;
    const sources = [...new Set(rules.map((r) => r.source))].map((s) => `\`${s}\``).join(', ');
    out.push(
      `| [${prefix}](#${anchorFor(prefix)}) | ${rules.length} | ${t[1]} | ${t[2]} | ${t[3]} | ${sources} |`
    );
  }
  out.push('');

  out.push(
    '## How to read a row',
    '',
    '| Column | Meaning |',
    '| --- | --- |',
    '| ID | The stable rule identifier. A finding reports this ID. |',
    '| Tier | 1 blocks, 2 is advisory, 3 needs adjudication. |',
    '| Doc types | `all`, or the specific types the rule is scoped to. |',
    '| Rule | What the rule requires, quoted from the registry. |',
    '| Why | The rationale, quoted from the registry. |',
    '| Exception | When the rule does not apply. |',
    '| Check | The `checkId` that enforces it, or `none` for tier 3. |',
    ''
  );

  for (const [prefix, rules] of groups) {
    out.push(`## ${GROUP_TITLES[prefix] || prefix}`, '');
    out.push(`Stated in: ${[...new Set(rules.map((r) => `\`${r.source}\``))].join(', ')}.`, '');
    for (const rule of rules) {
      out.push(`### ${rule.id}`, '');
      out.push(
        `| Field | Value |`,
        `| --- | --- |`,
        `| Tier | ${rule.tier} |`,
        `| Doc types | ${rule.docTypes.map((d) => `\`${d}\``).join(', ')} |`,
        `| Check | ${rule.checkId ? `\`${rule.checkId}\`` : 'none, tier 3 is adjudicated'} |`,
        `| Source | \`${rule.source}\` |`,
        ''
      );
      out.push(`**Rule.** ${cell(rule.rule)}`, '');
      if (rule.why) out.push(`**Why.** ${cell(rule.why)}`, '');
      if (rule.exception) out.push(`**Exception.** ${cell(rule.exception)}`, '');
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

function anchorFor(prefix) {
  const title = GROUP_TITLES[prefix] || prefix;
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-');
}

function buildChecksDoc() {
  const entries = Object.entries(checkSources)
    .filter(([key]) => !key.startsWith('_'))
    .sort(([a], [b]) => a.localeCompare(b));

  const byKind = {};
  for (const [, source] of entries) {
    const kind = source.kind || 'unknown';
    byKind[kind] = (byKind[kind] || 0) + 1;
  }

  const implemented = entries.filter(([, s]) => s.kind !== 'unimplemented');
  const missing = entries.filter(([, s]) => s.kind === 'unimplemented');

  const out = banner('Check catalog');

  out.push(
    'Every entry in `scripts/data/check-sources.json`, which maps a `checkId` to the module that',
    'implements it and the rules it addresses. For the architecture these modules sit in, read the',
    'Toolchain section of [README.md](README.md). For rule text, read [REFERENCE-RULES.md](REFERENCE-RULES.md).',
    '',
    `The map holds **${entries.length} entries**, of which ${missing.length} have no module behind them.`,
    '',
    '## Counts by kind',
    '',
    '| Kind | Entries | What it means |',
    '| --- | --- | --- |'
  );
  for (const [kind, count] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    out.push(`| \`${kind}\` | ${count} | ${KIND_NOTES[kind] || ''} |`);
  }
  out.push('');

  out.push(
    'A `rules` array is a claim about what a check **addresses**, not what it emits. Several rules',
    'legitimately share one emitted finding, so the two lists do not have to match one for one.',
    '',
    '## Implemented checks',
    '',
    '| Check ID | Kind | Module | Rules | Data files | Patterns |',
    '| --- | --- | --- | --- | --- | --- |'
  );
  for (const [checkId, source] of implemented) {
    out.push(
      `| \`${checkId}\` | ${source.kind || ''} | ${source.module ? `\`${source.module}\`` : ''} | ` +
        `${(source.rules || []).join(', ') || 'none'} | ` +
        `${(source.dataFiles || []).map((f) => `\`${f}\``).join(', ') || 'none'} | ` +
        `${(source.patterns || []).map((p) => `\`${p}\``).join(', ') || 'none'} |`
    );
  }
  out.push('');

  out.push(
    '## Registered with no check',
    '',
    'These entries carry `kind: unimplemented`. Each names rules that are stated and tiered but that',
    'nothing enforces, so a page can break them and still lint clean. Closing one is the job the',
    '`/doc-gap` workflow exists for.',
    '',
    '| Check ID | Rules with no enforcement |',
    '| --- | --- |'
  );
  for (const [checkId, source] of missing) {
    out.push(`| \`${checkId}\` | ${(source.rules || []).join(', ') || 'none'} |`);
  }
  out.push('');

  const unemitted = unemittedRuleClaims();
  out.push(
    '## Claimed but never emitted',
    '',
    'Pairs where a module owns the rule but never names its ID as a literal. Some are legitimate,',
    'because one finding can cover several rules or the ID is built from a variable. The list is',
    'frozen by `test/gap-loop.test.js` so it can shrink but not grow unnoticed.',
    '',
    `Current count: ${unemitted.length}.`,
    ''
  );
  for (const pair of unemitted) out.push(`- \`${pair}\``);
  out.push('');

  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

function main() {
  const problems = validateRegistry();
  if (problems.length) {
    console.error('Registry is invalid, refusing to generate:');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  const rulesPath = path.join(STANDARDS_DIR, 'REFERENCE-RULES.md');
  const checksPath = path.join(STANDARDS_DIR, 'REFERENCE-CHECKS.md');

  fs.writeFileSync(rulesPath, buildRulesDoc());
  fs.writeFileSync(checksPath, buildChecksDoc());

  const groups = groupRegistry();
  console.log(`REFERENCE-RULES.md: ${registry.length} rules in ${groups.size} groups`);
  console.log(
    `REFERENCE-CHECKS.md: ${Object.keys(checkSources).filter((k) => !k.startsWith('_')).length} checks, ` +
      `${unimplementedCheckIds().length} unimplemented, ${unemittedRuleClaims().length} unemitted claims`
  );
}

if (require.main === module) main();

module.exports = { buildRulesDoc, buildChecksDoc, cell, groupRegistry };
