#!/usr/bin/env node
'use strict';

/**
 * The tier-3 review loop: generate candidates, judge them, then reconcile the
 * verdicts against them.
 *
 * Two files, one direction each. Generation only ever writes candidates,
 * judgment only ever writes verdicts. Regeneration is therefore idempotent and
 * can never clobber judgment already made.
 *
 * --judge asks the claude CLI one candidate at a time and writes the verdicts
 * file the reconcile step expects. Judging by hand still works and produces the
 * same file, so the automated pass is a convenience, not a dependency.
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
const { askClaude } = require('./lib/claude-runner');
const { collectTier3Candidates } = require('./checks/tier3-candidates');
const { collectDocs } = require('./sweep-docs');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_CORPUS = path.join(REPO_ROOT, 'docs');
const DEFAULT_DIR = path.join(REPO_ROOT, '.doc-review');
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

/**
 * The prompt for one candidate.
 *
 * The candidate already carries the rule, its exception, the evidence and the
 * question, because reconcile refuses a verdict that could only have been
 * reached by reopening the file. So the prompt hands over exactly that and asks
 * for nothing the candidate does not contain.
 */
function buildJudgePrompt(candidate, priorViolation) {
  const lines = [
    'You are judging one candidate finding in a technical documentation review.',
    'The candidate was selected by a script that can only pattern match. You decide whether it is a real violation.',
    '',
    `Rule (${candidate.ruleId}): ${candidate.rule}`,
    `Why the rule exists: ${candidate.why}`,
    `Exception to the rule: ${candidate.exception}`,
    '',
    `File: ${candidate.file}, line ${candidate.line}`,
    `Section: ${candidate.section || '(none)'}`,
    `Why the script selected this line: ${candidate.signal}`,
    '',
    'Evidence:',
    ...(candidate.evidence || []).map((e) => `  ${e}`),
    '',
    `Question to answer: ${candidate.decide}`,
    '',
    'Reply with ONLY one JSON object, no prose around it, no markdown fence:',
    '{"verdict": "...", "reason": "...", "fix": "...", "exceptionQuoted": "..."}',
    '',
    `"verdict" is one of ${[...VALID_VERDICTS].join(', ')}.`,
    '"reason" is one or two sentences saying what in the evidence decided it.',
    '"fix" is required when the verdict is VIOLATION, and is the corrected text or the concrete edit to make. Omit it otherwise.',
    '"exceptionQuoted" is required when the verdict is EXCEPTION_APPLIES, and must be a verbatim substring of the exception text above. Omit it otherwise.',
    'Answer UNCLEAR only when the evidence genuinely cannot settle the question, not to avoid deciding.',
  ];
  if (priorViolation) {
    lines.push('', `Your previous reply was rejected: ${priorViolation}`, 'Fix that specifically this time.');
  }
  return lines.join('\n');
}

/**
 * The per-object verdict rules, on an already-parsed object.
 *
 * Split out of validateVerdictReply so judge-tone.js, which parses one array of
 * many objects rather than one object, applies exactly these rules rather than
 * its own copy. The two fix scripts each carrying their own copy of a shared
 * loop is how they drifted, which is why lib/claude-runner.js exists. Same
 * argument, same remedy.
 */
function validateVerdictObject(parsed, candidate) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'each verdict must be a JSON object';
  }
  if (!VALID_VERDICTS.has(parsed.verdict)) {
    return `"verdict" must be one of ${[...VALID_VERDICTS].join(', ')}`;
  }
  if (!parsed.reason || !String(parsed.reason).trim()) return 'every verdict needs a reason';
  if (parsed.verdict === 'VIOLATION' && !parsed.fix) return 'a VIOLATION must carry a fix';
  if (parsed.verdict === 'EXCEPTION_APPLIES') {
    const quoted = parsed.exceptionQuoted;
    if (!quoted || !String(candidate.exception || '').includes(quoted)) {
      return 'EXCEPTION_APPLIES must quote the rule exception verbatim in "exceptionQuoted"';
    }
  }
  return null;
}

/** The same checks reconcile applies, run against one reply so a bad one retries instead of landing in the file. */
function validateVerdictReply(reply, candidate) {
  let parsed;
  try {
    parsed = JSON.parse(reply);
  } catch (err) {
    return 'the reply must be one JSON object and nothing else';
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'the reply must be a single JSON object';
  }
  return validateVerdictObject(parsed, candidate);
}

/**
 * Judges every candidate by asking the claude CLI, one candidate at a time.
 *
 * One call per candidate rather than one call for the list, because the failure
 * mode this whole loop exists to prevent is an agent quietly stopping partway
 * through a long list. A candidate that cannot be judged is left out of the
 * verdicts, where reconcile reports it as unjudged instead of guessing.
 */
function judge(candidatesDoc, { onProgress = () => {} } = {}) {
  const verdicts = [];
  const skipped = [];

  for (const candidate of candidatesDoc.candidates) {
    onProgress(candidate);
    const reply = askClaude({
      buildPrompt: (priorViolation) => buildJudgePrompt(candidate, priorViolation),
      validate: (text) => validateVerdictReply(text, candidate),
    });
    if (!reply) {
      skipped.push(candidate.candidateId);
      continue;
    }
    const parsed = JSON.parse(reply);
    verdicts.push({
      candidateId: candidate.candidateId,
      verdict: parsed.verdict,
      reason: String(parsed.reason).trim(),
      ...(parsed.fix ? { fix: String(parsed.fix).trim() } : {}),
      ...(parsed.exceptionQuoted ? { exceptionQuoted: String(parsed.exceptionQuoted) } : {}),
    });
  }

  return {
    judgedAt: new Date().toISOString(),
    candidatesFile: '.doc-review/candidates.json',
    judge: 'review-candidates.js --judge@1',
    verdicts,
    skipped,
  };
}

/** Lays fresh verdicts over an existing file, keeping any verdict this run did not reach. */
function mergeVerdicts(existing, fresh) {
  if (!existing || !Array.isArray(existing.verdicts)) return fresh;
  const byId = new Map(existing.verdicts.map((v) => [v.candidateId, v]));
  for (const v of fresh.verdicts) byId.set(v.candidateId, v);
  return { ...fresh, verdicts: [...byId.values()] };
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
  const args = {
    targets: [],
    rules: null,
    out: null,
    reconcile: false,
    judge: false,
    apply: false,
    candidates: null,
    verdicts: null,
    format: 'text',
  };
  for (const arg of argv) {
    if (arg === '--reconcile') args.reconcile = true;
    else if (arg === '--judge') args.judge = true;
    else if (arg === '--apply') args.apply = true;
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

  if (args.judge) {
    const candidatesPath = args.candidates || path.join(DEFAULT_DIR, 'candidates.json');
    if (!fs.existsSync(candidatesPath)) {
      console.error(`No candidates at ${candidatesPath}. Run without --judge first.`);
      process.exit(2);
    }
    const candidatesDoc = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
    let candidates = candidatesDoc.candidates;
    if (args.rules) candidates = candidates.filter((c) => args.rules.includes(c.ruleId));

    console.log(
      `Judging ${candidates.length} candidate(s) with the claude CLI${args.apply ? '' : ' (dry run, pass --apply to write verdicts.json)'}.`
    );
    console.log('');

    const result = judge(
      { ...candidatesDoc, candidates },
      {
        onProgress: (c) => console.log(`${c.candidateId}  ${c.file.split('/').pop()}:${c.line}`),
      }
    );

    for (const v of result.verdicts) {
      console.log(`  ${v.verdict.padEnd(18)} ${v.candidateId}`);
      console.log(`    ${v.reason}`);
      if (v.fix) console.log(`    Fix: ${v.fix}`);
    }
    console.log('');
    const tallies = {};
    for (const v of result.verdicts) tallies[v.verdict] = (tallies[v.verdict] || 0) + 1;
    console.log(`Verdicts: ${Object.entries(tallies).map(([k, n]) => `${k}=${n}`).join('  ') || 'none'}`);
    if (result.skipped.length) {
      console.log(`Unjudged after retries: ${result.skipped.length}. Reconcile will report each one.`);
    }

    if (!args.apply) return;

    const verdictsPath = args.verdicts || path.join(DEFAULT_DIR, 'verdicts.json');
    fs.mkdirSync(path.dirname(verdictsPath), { recursive: true });
    // A --rules run judges part of the list, so the verdicts it did not produce
    // are kept rather than dropped. Judgment already made is never clobbered.
    const merged = mergeVerdicts(
      fs.existsSync(verdictsPath) ? JSON.parse(fs.readFileSync(verdictsPath, 'utf8')) : null,
      result
    );
    fs.writeFileSync(verdictsPath, `${JSON.stringify(merged, null, 2)}\n`);
    console.log(`Wrote ${verdictsPath}`);
    console.log('Next: rerun with --reconcile to confirm the review covers every candidate.');
    return;
  }

  const targets = args.targets.length ? args.targets : [DEFAULT_CORPUS];
  const result = generate(targets, { rules: args.rules });
  const outPath = args.out || path.join(DEFAULT_DIR, 'candidates.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log(renderGenerate(result));
  console.log('');
  console.log(`Wrote ${outPath}`);
  console.log('Next: judge each candidate, write verdicts.json beside it, then rerun with --reconcile.');
}

if (require.main === module) main();

module.exports = {
  generate,
  reconcile,
  toFindings,
  judge,
  buildJudgePrompt,
  validateVerdictReply,
  validateVerdictObject,
  mergeVerdicts,
  VALID_VERDICTS,
};
