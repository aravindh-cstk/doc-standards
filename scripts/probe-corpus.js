#!/usr/bin/env node
'use strict';

/**
 * The gap probe: given a phrase or pattern a human just objected to, find every
 * instance across the corpus and classify why the linter did not already report
 * it.
 *
 * This is the search-and-triage half of the doc-standards gap loop. It is not a
 * check and must never run during a lint: it scans for something that is not a
 * rule yet, which is the whole point.
 *
 * The probe deliberately shares lib/phrase-list.js with the wordlist checks, so
 * the entry file drafted here is the same JSON that becomes a wordlist entry if
 * the gap is confirmed. No translation step, and the hits are provably the set
 * a real check would report.
 */

const fs = require('fs');
const path = require('path');
const { DocModel } = require('./lib/doc-model');
const { loadEntryFile, scanDoc } = require('./lib/phrase-list');
const { lintFile } = require('./lint-doc');
const { collectDocs } = require('./sweep-docs');
const { registry, byId, nextRuleId, checkSources } = require('./lib/rules-registry');

// No default corpus: this repo is shared across projects, each with its own
// docs tree in a different place, so the caller must always name a target.
// Below this overlap the registry match is noise, so the honest answer is that
// no rule owns the case rather than the least-bad rule.
const OWNER_SCORE_FLOOR = 0.12;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'for', 'from', 'in', 'is', 'it',
  'its', 'not', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'use', 'used', 'when', 'with',
]);

function tokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/**
 * Scores each registry rule against the human's description of the violation by
 * token overlap.
 *
 * Returns the top matches with their scores rather than one answer, because
 * picking between "this is the casual-language rule" and "this is a new rule"
 * is reading comprehension. The script narrows the field, the agent decides.
 */
function rankOwningRules(label, limit = 3) {
  const probeTokens = tokens(label);
  if (probeTokens.size === 0) return [];

  return registry
    .map((rule) => {
      const ruleTokens = tokens(`${rule.rule} ${rule.why}`);
      let shared = 0;
      for (const t of probeTokens) if (ruleTokens.has(t)) shared += 1;
      return { ruleId: rule.id, tier: rule.tier, checkId: rule.checkId, score: shared / probeTokens.size };
    })
    .filter((r) => r.score >= OWNER_SCORE_FLOOR)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Classifies one unreported hit into the gap taxonomy, so the fix lands in the
 * right file instead of wherever seemed plausible.
 */
function triageGap(hit, candidates) {
  if (hit.existingFindings.length > 0) {
    return {
      classification: 'NOT_A_GAP',
      detail: `Already reported on this line by ${hit.existingFindings.map((f) => f.ruleId).join(', ')}.`,
      candidates,
    };
  }

  const top = candidates[0];
  const source = top && top.checkId ? checkSources[top.checkId] : null;

  if (source && source.kind === 'wordlist') {
    return {
      classification: 'WORDLIST_GAP',
      detail: `${top.ruleId} already covers this concept and is wordlist-driven. Add an entry, no code change needed.`,
      changeFiles: source.dataFiles || [],
      candidates,
    };
  }

  if (source && (source.kind === 'regex' || source.kind === 'structural')) {
    return {
      classification: 'REGEX_TOO_NARROW',
      detail: `${top.ruleId} already covers this concept, but ${source.module} matches less than its own rule text says.`,
      changeFiles: [source.module],
      patterns: source.patterns || [],
      candidates,
    };
  }

  const prefixes = [...new Set(candidates.map((c) => c.ruleId.split('-')[0]))];
  return {
    classification: 'NO_RULE',
    detail: 'No registry rule scores above the floor. This needs a new check module and a new rule ID.',
    suggestedIds: (prefixes.length ? prefixes : ['C3']).map((p) => nextRuleId(p)),
    candidates,
  };
}

function probe(entries, label, { corpus } = {}) {
  if (!corpus) throw new Error('probe() requires a corpus target, there is no project-specific default.');
  const files = collectDocs(corpus);
  const hits = [];
  const errors = [];

  for (const file of files) {
    const doc = DocModel.fromFile(file);
    const report = lintFile(file, { label: file });
    const findings = [...report.automatedFindings, ...report.flagged];

    scanDoc(doc, entries, {
      onMatch: (m) => {
        if (m.error) {
          errors.push(m.error);
          return;
        }
        hits.push({
          file,
          line: m.line,
          matched: m.matched,
          text: m.raw.trim().slice(0, 140),
          // Plus or minus one line, because a finding often anchors to the
          // start of a wrapped sentence rather than the offending word.
          existingFindings: findings
            .filter((f) => f.line !== null && Math.abs(f.line - m.line) <= 1)
            .map((f) => ({ ruleId: f.ruleId, checkId: f.checkId, message: f.message })),
        });
      },
    });
  }

  const candidates = rankOwningRules(label);
  const unreported = hits.filter((h) => h.existingFindings.length === 0);
  const triage = triageGap(
    unreported[0] || { existingFindings: hits.length ? hits[0].existingFindings : [] },
    candidates
  );

  return {
    generatedAt: new Date().toISOString(),
    label,
    corpus,
    filesScanned: files.length,
    hitCount: hits.length,
    unreportedCount: unreported.length,
    hits,
    triage,
    errors,
  };
}

function renderText(result) {
  const lines = [];
  lines.push(`Probe: ${result.label}`);
  lines.push(`Corpus: ${result.corpus}  (${result.filesScanned} files)`);
  lines.push(`Hits: ${result.hitCount}   Unreported by any existing check: ${result.unreportedCount}`);
  lines.push('');

  if (result.errors.length) {
    lines.push('Pattern errors');
    lines.push('-'.repeat(60));
    result.errors.forEach((e) => lines.push(`  ${e}`));
    lines.push('');
  }

  lines.push('Hits');
  lines.push('-'.repeat(60));
  if (result.hits.length === 0) {
    lines.push('  none. A structural violation has no text to probe, so an empty result here');
    lines.push('  is expected for that shape and the triage below falls through to NO_RULE.');
  }
  for (const hit of result.hits) {
    const flag = hit.existingFindings.length ? `already reported by ${hit.existingFindings.map((f) => f.ruleId).join(',')}` : 'UNREPORTED';
    lines.push(`  ${path.basename(hit.file)}:${hit.line}  [${flag}]`);
    lines.push(`    "${hit.matched}"  in: ${hit.text}`);
  }
  lines.push('');

  lines.push(`Triage: ${result.triage.classification}`);
  lines.push('-'.repeat(60));
  lines.push(`  ${result.triage.detail}`);
  if (result.triage.changeFiles) lines.push(`  Change: ${result.triage.changeFiles.join(', ')}`);
  if (result.triage.patterns && result.triage.patterns.length) {
    lines.push(`  Widen: ${result.triage.patterns.join(', ')}`);
  }
  if (result.triage.suggestedIds) lines.push(`  Next free rule id: ${result.triage.suggestedIds.join(', ')}`);
  lines.push('');
  lines.push('  Candidate owning rules (top 3 by token overlap, you pick):');
  if (result.triage.candidates.length === 0) lines.push('    none above the score floor');
  for (const c of result.triage.candidates) {
    const rule = byId(c.ruleId);
    lines.push(`    ${c.ruleId}  score ${c.score.toFixed(2)}  checkId=${c.checkId}`);
    lines.push(`      ${rule ? rule.rule.slice(0, 110) : ''}`);
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = { entries: null, pattern: null, label: null, corpus: null, format: 'text', out: null, nextId: null };
  for (const arg of argv) {
    if (arg.startsWith('--entries=')) args.entries = arg.slice(10);
    else if (arg.startsWith('--pattern=')) args.pattern = arg.slice(10);
    else if (arg.startsWith('--label=')) args.label = arg.slice(8);
    else if (arg.startsWith('--corpus=')) args.corpus = arg.slice(9);
    else if (arg.startsWith('--format=')) args.format = arg.slice(9);
    else if (arg.startsWith('--out=')) args.out = arg.slice(6);
    else if (arg.startsWith('--next-id=')) args.nextId = arg.slice(10);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.nextId) {
    console.log(nextRuleId(args.nextId));
    process.exit(0);
  }

  if (!args.entries && !args.pattern) {
    console.error('Usage: probe-corpus.js --entries=<file.json> --corpus=<dir> [--label=<text>]');
    console.error('       probe-corpus.js --pattern=<re> --label=<text> --corpus=<dir>');
    console.error('       probe-corpus.js --next-id=C3');
    process.exit(2);
  }
  if (!args.corpus) {
    console.error('Usage: --corpus=<dir> is required, there is no project-specific default.');
    process.exit(2);
  }

  const entries = args.entries
    ? loadEntryFile(args.entries)
    : [{ pattern: args.pattern, label: args.label || args.pattern, fix: '(probe, not yet a rule)' }];
  const label = args.label || (args.entries ? path.basename(args.entries, '.json') : args.pattern);

  const result = probe(entries, label, { corpus: args.corpus });
  const rendered = args.format === 'json' ? JSON.stringify(result, null, 2) : renderText(result);

  if (args.out) {
    fs.writeFileSync(args.out, `${rendered}\n`);
    console.log(`Wrote ${args.out}`);
  } else {
    console.log(rendered);
  }
}

if (require.main === module) main();

module.exports = { probe, triageGap, rankOwningRules };
