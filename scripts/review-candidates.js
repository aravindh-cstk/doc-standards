#!/usr/bin/env node
'use strict';

/**
 * The tier-3 review loop: generate candidates, then reconcile an agent's
 * verdicts against them.
 *
 * Two files, one direction each. This script only ever writes candidates, the
 * agent only ever writes verdicts. Regeneration is therefore idempotent and can
 * never clobber judgment already made.
 *
 * Reconcile exits 1 on any unjudged candidate. That is the point of the whole
 * file: the known failure mode of an agent working a long list is quietly
 * stopping partway, and a review that silently covers 60% of the page is worse
 * than no review, because it reads as a clean bill of health.
 *
 * Artifacts live in <repo>/.doc-review/ rather than under doc-standards/ or any
 * docs/ path, because the doc-writing hook treats those paths as prose and
 * would fire on every verdict that quotes a sentence containing a semicolon.
 */

const fs = require('fs');
const path = require('path');
const { DocModel } = require('./lib/doc-model');
const { collectTier3Candidates } = require('./checks/tier3-candidates');
const { collectDocs } = require('./sweep-docs');

// No project-specific corpus default: this repo is shared across projects, so
// the target and the artifact directory resolve against the caller's own
// working directory, not this repo's own install location.
const DEFAULT_DIR = path.join(process.cwd(), '.doc-review');
const VALID_VERDICTS = new Set(['VIOLATION', 'COMPLIANT', 'EXCEPTION_APPLIES', 'UNCLEAR']);

function generate(targets, { rules = null } = {}) {
  const files = targets.flatMap((t) => collectDocs(t));
  let candidates = [];
  for (const file of files) {
    candidates.push(...collectTier3Candidates(DocModel.fromFile(file)));
  }
  if (rules) candidates = candidates.filter((c) => rules.includes(c.ruleId));

  const byRule = {};
  for (const c of candidates) byRule[c.ruleId] = (byRule[c.ruleId] || 0) + 1;

  return {
    generatedAt: new Date().toISOString(),
    corpus: targets,
    generator: 'review-candidates.js@1',
    counts: { total: candidates.length, files: files.length, byRule },
    candidates,
  };
}

/**
 * Checks a verdicts file against its candidates file.
 *
 * Every rejection here is a way a review can look complete while being hollow:
 * a missing verdict, a verdict on a candidate that no longer exists, an
 * EXCEPTION_APPLIES that does not quote the exception it claims, a VIOLATION
 * with no fix. Returns problems plus tallies.
 */
function reconcile(candidatesDoc, verdictsDoc) {
  const problems = [];
  const byId = new Map(candidatesDoc.candidates.map((c) => [c.candidateId, c]));
  const judged = new Map();

  for (const v of verdictsDoc.verdicts || []) {
    if (!v.candidateId) {
      problems.push('A verdict has no candidateId.');
      continue;
    }
    if (judged.has(v.candidateId)) problems.push(`Duplicate verdict for ${v.candidateId}.`);
    judged.set(v.candidateId, v);

    const candidate = byId.get(v.candidateId);
    if (!candidate) {
      problems.push(`Verdict for unknown candidate ${v.candidateId}. Regenerate, the line may have moved.`);
      continue;
    }
    if (!VALID_VERDICTS.has(v.verdict)) {
      problems.push(`${v.candidateId}: verdict "${v.verdict}" is not one of ${[...VALID_VERDICTS].join(', ')}.`);
    }
    if (!v.reason || !String(v.reason).trim()) {
      problems.push(`${v.candidateId}: every verdict needs a reason.`);
    }
    if (v.verdict === 'VIOLATION' && !v.fix) {
      problems.push(`${v.candidateId}: a VIOLATION must carry a fix.`);
    }
    if (v.verdict === 'EXCEPTION_APPLIES') {
      const quoted = v.exceptionQuoted;
      if (!quoted || !String(candidate.exception || '').includes(quoted)) {
        problems.push(
          `${v.candidateId}: EXCEPTION_APPLIES must quote the rule's own exception verbatim. Rule exception is ${JSON.stringify(candidate.exception)}.`
        );
      }
    }
  }

  const unjudged = candidatesDoc.candidates.filter((c) => !judged.has(c.candidateId));
  for (const c of unjudged) problems.push(`Unjudged candidate ${c.candidateId} (${c.file}:${c.line}).`);

  const tallies = {};
  for (const v of judged.values()) tallies[v.verdict] = (tallies[v.verdict] || 0) + 1;

  return { problems, unjudged: unjudged.length, judged: judged.size, total: candidatesDoc.candidates.length, tallies };
}

/** Turns confirmed violations into the Finding shape, so tier 3 flows into the same report as everything else. */
function toFindings(candidatesDoc, verdictsDoc) {
  const byId = new Map(candidatesDoc.candidates.map((c) => [c.candidateId, c]));
  return (verdictsDoc.verdicts || [])
    .filter((v) => v.verdict === 'VIOLATION')
    .map((v) => {
      const c = byId.get(v.candidateId);
      return {
        tier: 3,
        ruleId: c ? c.ruleId : null,
        checkId: 'tier3-candidates',
        line: c ? c.line : null,
        section: c ? c.section : null,
        message: `${v.reason} Fix: ${v.fix}`,
        falsePositiveNote: null,
        file: c ? c.file : null,
      };
    });
}

function renderGenerate(result) {
  const lines = [];
  lines.push(`Tier-3 candidates: ${result.counts.total} across ${result.counts.files} files`);
  lines.push('');
  for (const [ruleId, count] of Object.entries(result.counts.byRule).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${ruleId}  x${count}`);
  }
  return lines.join('\n');
}

function renderReconcile(r) {
  const lines = [];
  lines.push(`Reconcile: ${r.judged}/${r.total} candidates judged`);
  lines.push(`Verdicts: ${Object.entries(r.tallies).map(([k, v]) => `${k}=${v}`).join('  ') || 'none'}`);
  lines.push('');
  if (r.problems.length === 0) {
    lines.push('No problems. VIOLATION rows are ready to apply, UNCLEAR rows escalate to NEEDS-YOUR-INPUT.md.');
  } else {
    lines.push(`Problems (${r.problems.length})`);
    lines.push('-'.repeat(60));
    r.problems.slice(0, 40).forEach((p) => lines.push(`  ${p}`));
    if (r.problems.length > 40) lines.push(`  ... and ${r.problems.length - 40} more`);
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = { targets: [], rules: null, out: null, reconcile: false, candidates: null, verdicts: null, format: 'text' };
  for (const arg of argv) {
    if (arg === '--reconcile') args.reconcile = true;
    else if (arg.startsWith('--rules=')) args.rules = arg.slice(8).split(',').map((s) => s.trim());
    else if (arg.startsWith('--out=')) args.out = arg.slice(6);
    else if (arg.startsWith('--candidates=')) args.candidates = arg.slice(13);
    else if (arg.startsWith('--verdicts=')) args.verdicts = arg.slice(11);
    else if (arg.startsWith('--format=')) args.format = arg.slice(9);
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.reconcile) {
    const candidatesPath = args.candidates || path.join(DEFAULT_DIR, 'candidates.json');
    const verdictsPath = args.verdicts || path.join(DEFAULT_DIR, 'verdicts.json');
    if (!fs.existsSync(candidatesPath) || !fs.existsSync(verdictsPath)) {
      console.error(`Need both files. candidates=${candidatesPath} verdicts=${verdictsPath}`);
      process.exit(2);
    }
    const candidatesDoc = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
    const verdictsDoc = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'));
    const result = reconcile(candidatesDoc, verdictsDoc);

    if (args.format === 'json') {
      console.log(JSON.stringify({ ...result, findings: toFindings(candidatesDoc, verdictsDoc) }, null, 2));
    } else {
      console.log(renderReconcile(result));
    }
    process.exitCode = result.problems.length > 0 ? 1 : 0;
    return;
  }

  if (args.targets.length === 0) {
    console.error('Usage: review-candidates.js <dir-or-file>... [--rules=C2-01,C6-01] [--out=path]');
    console.error('       review-candidates.js --reconcile [--candidates=path] [--verdicts=path]');
    process.exit(2);
  }
  const result = generate(args.targets, { rules: args.rules });
  const outPath = args.out || path.join(DEFAULT_DIR, 'candidates.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log(renderGenerate(result));
  console.log('');
  console.log(`Wrote ${outPath}`);
  console.log('Next: judge each candidate, write verdicts.json beside it, then rerun with --reconcile.');
}

if (require.main === module) main();

module.exports = { generate, reconcile, toFindings };
