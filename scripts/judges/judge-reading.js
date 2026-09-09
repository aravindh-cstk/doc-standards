#!/usr/bin/env node
'use strict';

/**
 * The `claude`-backed judge for the two rules that need a reader: C2-13
 * (a stated count that disagrees with what it counts) and C2-14 (a link label
 * that misdescribes where it goes).
 *
 * Why these two exist at all. PR #86's reading agents reported both classes and
 * the list lived only in the session, which is now gone. Neither repo could
 * regenerate it: sweep-docs.js counts nothing, and check-links.js answers
 * whether a target RESOLVES, never whether the label promised that target. A
 * finding recorded in a transcript is a finding that has to be found again by
 * hand every time. A finding a script can regenerate is a finding that stays
 * fixed.
 *
 * Why the judgment is separate from the check, restating what
 * checks/tier3-candidates.js established: a candidate is a question and a lint
 * failure has to be an answer. A `claude` call inside a CHECKS entry would run
 * per line per file on every sweep, make probe-corpus.js nondeterministic when
 * a reproducible hit set is its entire purpose, cost money on every editor save
 * through the doc-writing hook, and surface a network timeout as a tier-1
 * violation. So the deterministic half narrows WHERE to look, which is most of
 * the labour, and this script decides.
 *
 * The same three-file discipline review-candidates.js uses, and for the same
 * reason. Generation only ever writes candidates, judgment only ever writes
 * verdicts, and reconcile exits 1 on anything unjudged. The failure mode being
 * guarded against is an agent quietly stopping partway through a long list: a
 * review that silently covers 60 percent of the corpus is worse than no review,
 * because it reads as a clean bill of health.
 *
 * No --apply. Verdicts are written here and prose is rewritten in fix/, which
 * keeps the one-direction discipline that makes regeneration safe.
 *
 * Usage:
 *   node judge-reading.js <dir>...                        # generate candidates
 *   node judge-reading.js --judge [--max-calls=N] [--refresh]
 *   node judge-reading.js --reconcile
 *   node judge-reading.js --report                        # confirmed violations
 *   node judge-reading.js <dir>... --rules=C2-13
 */

const fs = require('fs');
const path = require('path');

const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { collectDocs } = require('../sweep-docs');
const { byId } = require('../lib/rules-registry');
const { collectNumericCandidates } = require('../checks/numeric-consistency');
const { collectLinkLabelCandidates } = require('../checks/link-label-fidelity');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const DEFAULT_DIR = path.join(REPO_ROOT, '.doc-review');
const CANDIDATES_PATH = path.join(DEFAULT_DIR, 'reading-candidates.json');
const VERDICTS_PATH = path.join(DEFAULT_DIR, 'reading-verdicts.json');

/**
 * In the cache key, so an edit to the rubric invalidates stored verdicts rather
 * than serving answers reached under a different question. Bump it whenever a
 * change to buildPrompt could change an answer.
 */
const PROMPT_VERSION = 'reading@1';

const VALID_VERDICTS = new Set(['VIOLATION', 'COMPLIANT', 'UNCLEAR']);
const RULES = ['C2-13', 'C2-14'];

function readJson(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`);
}

function relPath(file) {
  return path.relative(REPO_ROOT, path.resolve(file)).split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

function generate(targets, { rules = RULES } = {}) {
  const files = [...new Set(targets.flatMap((t) => collectDocs(path.resolve(t))))].sort();
  const corpus = new Set(files.map((f) => path.resolve(f)));

  const candidates = [];
  const direct = [];

  for (const file of files) {
    if (rules.includes('C2-13')) {
      for (const c of collectNumericCandidates(DocModel.fromFile(file))) {
        candidates.push({ ...c, file: relPath(c.file) });
      }
    }
    if (rules.includes('C2-14')) {
      const r = collectLinkLabelCandidates(file, { corpus });
      for (const c of r.candidates) candidates.push({ ...c, file: relPath(c.file) });
      // Settled by the script, so they carry no question and never reach the
      // model. They are recorded alongside so one artifact holds the whole
      // answer for this pass.
      for (const f of r.findings) direct.push({ ...f, file: relPath(f.file) });
    }
  }

  // Attach the registry text, so a reviewer judging by hand does not have to
  // look the rule up separately to decide whether a hit is real.
  for (const c of candidates) {
    const rule = byId(c.ruleId);
    c.rule = rule ? rule.rule : '(not in registry)';
    c.why = rule ? rule.why : '';
    c.exception = rule ? rule.exception : '';
    c.promptVersion = PROMPT_VERSION;
  }

  const byRule = {};
  for (const c of candidates) byRule[c.ruleId] = (byRule[c.ruleId] || 0) + 1;

  return {
    generatedAt: new Date().toISOString(),
    corpus: targets.map(relPath),
    generator: 'judge-reading.js@1',
    counts: { total: candidates.length, files: files.length, direct: direct.length, byRule },
    direct,
    candidates,
  };
}

// ---------------------------------------------------------------------------
// Judge
// ---------------------------------------------------------------------------

/**
 * The prompt for one candidate.
 *
 * The candidate already carries the rule, its exception, the evidence and the
 * question, so the prompt hands over exactly that and asks for nothing the
 * candidate does not contain. Reconcile refuses a verdict that could only have
 * been reached by reopening the file, which is what keeps a verdict auditable
 * against the candidate it answers.
 */
function buildPrompt(candidate, priorViolation) {
  const lines = [
    'You are judging one candidate finding in a technical documentation review.',
    'A script selected it by pattern matching. You decide whether it is a real violation.',
    '',
    `Rule (${candidate.ruleId}): ${candidate.rule}`,
    `Why the rule exists: ${candidate.why}`,
    `Exception: ${candidate.exception}`,
    '',
    `File: ${candidate.file}, line ${candidate.line}`,
    `Why the script selected this: ${candidate.signal}`,
    '',
    'Evidence:',
    ...(candidate.evidence || []).map((e) => `  ${e}`),
    '',
    `Question to answer: ${candidate.decide}`,
    '',
    'Reply with ONLY one JSON object, no prose around it, no markdown fence:',
    '{"verdict": "...", "reason": "...", "fix": "..."}',
    '',
    `"verdict" is one of ${[...VALID_VERDICTS].join(', ')}.`,
    '"reason" is one or two sentences saying what in the evidence decided it.',
    '"fix" is required when the verdict is VIOLATION, and names the concrete edit: the',
    '  corrected count, or the label that would describe the destination. Omit it otherwise.',
    'Answer UNCLEAR only when the evidence genuinely cannot settle the question, not to avoid deciding.',
  ];
  if (priorViolation) {
    lines.push('', `Your previous reply was rejected: ${priorViolation}`, 'Fix that specifically this time.');
  }
  return lines.join('\n');
}

function validateReply(reply) {
  let parsed;
  try {
    parsed = JSON.parse(reply);
  } catch (err) {
    return 'the reply must be one JSON object and nothing else';
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'the reply must be a single JSON object';
  }
  if (!VALID_VERDICTS.has(parsed.verdict)) {
    return `"verdict" must be one of ${[...VALID_VERDICTS].join(', ')}`;
  }
  if (!parsed.reason || !String(parsed.reason).trim()) return 'every verdict needs a reason';
  if (parsed.verdict === 'VIOLATION' && !parsed.fix) return 'a VIOLATION must carry a fix';
  return null;
}

/** One call per candidate, cached by candidate id and prompt version. */
/**
 * Checkpoint every this many new verdicts.
 *
 * A full pass over this corpus is 171 or 286 sequential `claude -p` calls, which
 * is hours. Writing only at the end means a Ctrl-C, a laptop sleep or a network
 * blip at call 160 throws away 160 answers that were already paid for. Ten is
 * small enough that a lost tail is cheap and large enough that the write is not
 * the bottleneck.
 */
const CHECKPOINT_EVERY = 10;

function judge(candidatesDoc, { maxCalls = Infinity, refresh = false } = {}) {
  const existing = readJson(VERDICTS_PATH);
  const cached = new Map();
  if (existing && !refresh) {
    for (const v of existing.verdicts || []) {
      if (v.promptVersion === PROMPT_VERSION) cached.set(v.candidateId, v);
    }
  }

  const verdicts = [];

  /** The verdicts document, so a checkpoint and the final write share one shape. */
  const wrap = (list) => ({
    generatedAt: new Date().toISOString(),
    judge: 'judge-reading.js@1',
    promptVersion: PROMPT_VERSION,
    verdicts: list,
  });

  let calls = 0;
  let reused = 0;

  for (const candidate of candidatesDoc.candidates) {
    const hit = cached.get(candidate.candidateId);
    if (hit) {
      verdicts.push(hit);
      reused += 1;
      continue;
    }
    if (calls >= maxCalls) continue;

    calls += 1;
    process.stdout.write(`  [${calls}] ${candidate.candidateId} ... `);
    const reply = askClaude({
      buildPrompt: (prior) => buildPrompt(candidate, prior),
      validate: validateReply,
    });
    if (!reply) {
      console.log('unjudged');
      continue;
    }
    const parsed = JSON.parse(reply);
    console.log(parsed.verdict);
    if (calls % CHECKPOINT_EVERY === 0) writeJson(VERDICTS_PATH, wrap(verdicts));
    verdicts.push({
      candidateId: candidate.candidateId,
      ruleId: candidate.ruleId,
      verdict: parsed.verdict,
      reason: parsed.reason,
      fix: parsed.fix || null,
      promptVersion: PROMPT_VERSION,
    });
  }

  console.log(`\n${verdicts.length} verdicts (${reused} reused, ${calls} calls).`);

  return wrap(verdicts);
}

// ---------------------------------------------------------------------------
// Reconcile
// ---------------------------------------------------------------------------

function reconcile(candidatesDoc, verdictsDoc) {
  const problems = [];
  const byCandidateId = new Map(candidatesDoc.candidates.map((c) => [c.candidateId, c]));
  const judged = new Map();

  for (const v of (verdictsDoc && verdictsDoc.verdicts) || []) {
    if (!v.candidateId) {
      problems.push('A verdict has no candidateId.');
      continue;
    }
    if (judged.has(v.candidateId)) problems.push(`Duplicate verdict for ${v.candidateId}.`);
    judged.set(v.candidateId, v);

    if (!byCandidateId.has(v.candidateId)) {
      problems.push(`Verdict for unknown candidate ${v.candidateId}. Regenerate, the line may have moved.`);
      continue;
    }
    if (!VALID_VERDICTS.has(v.verdict)) {
      problems.push(`${v.candidateId}: verdict "${v.verdict}" is not one of ${[...VALID_VERDICTS].join(', ')}.`);
    }
    if (!v.reason || !String(v.reason).trim()) problems.push(`${v.candidateId}: every verdict needs a reason.`);
    if (v.verdict === 'VIOLATION' && !v.fix) problems.push(`${v.candidateId}: a VIOLATION must carry a fix.`);
    if (v.promptVersion !== PROMPT_VERSION) {
      problems.push(`${v.candidateId}: judged under ${v.promptVersion}, current prompt is ${PROMPT_VERSION}.`);
    }
  }

  const unjudged = candidatesDoc.candidates.filter((c) => !judged.has(c.candidateId));
  for (const c of unjudged) problems.push(`Unjudged candidate ${c.candidateId} (${c.file}:${c.line}).`);

  const tallies = {};
  for (const v of judged.values()) {
    const key = `${v.ruleId} ${v.verdict}`;
    tallies[key] = (tallies[key] || 0) + 1;
  }

  return { problems, unjudged: unjudged.length, judged: judged.size, total: candidatesDoc.candidates.length, tallies };
}

/** The confirmed violations plus the script-settled findings, ready to work. */
function report(candidatesDoc, verdictsDoc) {
  const byCandidateId = new Map(candidatesDoc.candidates.map((c) => [c.candidateId, c]));
  const out = [...(candidatesDoc.direct || [])];

  for (const v of (verdictsDoc && verdictsDoc.verdicts) || []) {
    if (v.verdict !== 'VIOLATION') continue;
    const c = byCandidateId.get(v.candidateId);
    if (!c) continue;
    out.push({
      ruleId: c.ruleId,
      checkId: c.checkId,
      tier: 1,
      file: c.file,
      line: c.line,
      message: `${v.reason} Fix: ${v.fix}`,
    });
  }
  out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { targets: [], judge: false, reconcile: false, report: false, refresh: false, maxCalls: Infinity, rules: RULES };
  for (const arg of argv) {
    if (arg === '--judge') args.judge = true;
    else if (arg === '--reconcile') args.reconcile = true;
    else if (arg === '--report') args.report = true;
    else if (arg === '--refresh') args.refresh = true;
    else if (arg.startsWith('--max-calls=')) args.maxCalls = parseInt(arg.slice('--max-calls='.length), 10);
    else if (arg.startsWith('--rules=')) args.rules = arg.slice('--rules='.length).split(',');
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.targets.length && !args.judge && !args.reconcile && !args.report) {
    const doc = generate(args.targets, { rules: args.rules });
    writeJson(CANDIDATES_PATH, doc);
    console.log(
      `${doc.counts.total} candidates and ${doc.counts.direct} settled findings, ` +
        `from ${doc.counts.files} files.`
    );
    for (const [rule, n] of Object.entries(doc.counts.byRule)) console.log(`  ${String(n).padStart(4)}  ${rule}`);
    console.log(`Wrote ${CANDIDATES_PATH}`);
    return;
  }

  const candidatesDoc = readJson(CANDIDATES_PATH);
  if (!candidatesDoc) {
    console.error(`No candidates at ${CANDIDATES_PATH}. Generate them first.`);
    process.exit(2);
  }

  if (args.judge) {
    writeJson(VERDICTS_PATH, judge(candidatesDoc, { maxCalls: args.maxCalls, refresh: args.refresh }));
    console.log(`Wrote ${VERDICTS_PATH}`);
  }

  if (args.reconcile || args.report) {
    const verdictsDoc = readJson(VERDICTS_PATH);
    const result = reconcile(candidatesDoc, verdictsDoc);
    console.log(`\n${result.judged} of ${result.total} judged.`);
    for (const [k, n] of Object.entries(result.tallies).sort()) console.log(`  ${String(n).padStart(4)}  ${k}`);

    if (args.report) {
      const findings = report(candidatesDoc, verdictsDoc);
      console.log(`\n${findings.length} to fix:`);
      for (const f of findings) console.log(`  ${f.file}:${f.line}  [${f.ruleId}] ${f.message}`);
    }

    if (result.problems.length) {
      console.log(`\n${result.problems.length} problems:`);
      for (const p of result.problems.slice(0, 30)) console.log(`  ${p}`);
      if (result.problems.length > 30) console.log(`  ... and ${result.problems.length - 30} more`);
      process.exit(1);
    }
    console.log('\nReconciled clean.');
  }

  if (!args.judge && !args.reconcile && !args.report) {
    console.error('Usage: judge-reading.js <dir>... | --judge [--max-calls=N] | --reconcile | --report');
    process.exit(2);
  }
}

if (require.main === module) main();

module.exports = { generate, judge, reconcile, report, buildPrompt, validateReply, PROMPT_VERSION, VALID_VERDICTS };
