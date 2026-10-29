#!/usr/bin/env node
'use strict';

/**
 * The editorial judge: the reading questions behind the MCP Profile Hub review.
 *
 * A reviewer corrected the same kinds of sentence more than once: an Overview
 * that narrated the page, casual phrasing, an over-promise, steps that quoted a
 * vendor's UI, and long sentences nobody could skim. Wordlists and regexes now
 * block the exact forms, but each of these has a fuzzy edge only a reader can
 * decide. This script collects that edge, hands each candidate to a judge with
 * the reviewer's own worked examples, and refuses to call the review done while
 * any candidate is unjudged.
 *
 *   node judges/judge-editorial.js <file-or-dir>...    generate candidates, no model call
 *   node judges/judge-editorial.js --reconcile         fail on any unjudged or malformed verdict
 *   node judges/judge-editorial.js --escalate[=FILE]   write UNCLEAR verdicts as a NEEDS-YOUR-INPUT file
 *   node judges/judge-editorial.js --judge [--apply]   opt-in: ask the claude CLI, one candidate at a time
 *
 * Judging without a model is the default path. Write
 * .doc-review/editorial-verdicts.json in the shape review-candidates.js uses,
 * { "verdicts": [ { "candidateId", "verdict", "reason", "fix" } ] }, then run
 * --reconcile. --escalate gives every open question a clickable file:line link,
 * because a question without one sends the reader hunting for the sentence.
 */

const fs = require('fs');
const path = require('path');
const { askClaude } = require('../lib/claude-runner');
const {
  generate,
  reconcile,
  buildJudgePrompt,
  validateVerdictReply,
  mergeVerdicts,
} = require('./review-candidates');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const DEFAULT_DIR = path.join(REPO_ROOT, '.doc-review');
const RUBRIC = require('../data/judge-rubrics/editorial.json');
const EDITORIAL_RULES = Object.keys(RUBRIC.rules);
const GENERATOR_ID = 'judge-editorial.js@1';

const DEFAULTS = {
  candidates: path.join(DEFAULT_DIR, 'editorial-candidates.json'),
  verdicts: path.join(DEFAULT_DIR, 'editorial-verdicts.json'),
  escalate: path.join(DEFAULT_DIR, 'NEEDS-YOUR-INPUT.md'),
};

/** Adds the reviewer's focus and worked examples for the candidate's rule. */
function withRubric(candidate) {
  const r = RUBRIC.rules[candidate.ruleId] || {};
  return { ...candidate, focus: r.focus || null, examples: r.examples || [], fixKinds: r.fixKinds || [] };
}

/** Candidates for the editorial rules only, each carrying its rubric. */
function generateEditorial(targets) {
  const base = generate(targets, { rules: EDITORIAL_RULES });
  return { ...base, generator: GENERATOR_ID, promptVersion: RUBRIC.promptVersion, candidates: base.candidates.map(withRubric) };
}

/** The shared judge prompt, with the rubric inserted before the reply instructions. */
function buildEditorialPrompt(candidate, priorViolation) {
  const lines = buildJudgePrompt(candidate, priorViolation).split('\n');
  const at = lines.findIndex((l) => l.startsWith('Reply with ONLY'));
  const rubric = ['How the reviewer applies this rule:', `  ${candidate.focus || '(no rubric for this rule)'}`];
  for (const [i, ex] of (candidate.examples || []).entries()) {
    rubric.push(`Worked example ${i + 1}:`, `  Rejected: ${ex.before}`, `  Accepted: ${ex.after}`, `  Why: ${ex.why}`);
  }
  if ((candidate.fixKinds || []).length) rubric.push(`Allowed kinds of fix: ${candidate.fixKinds.join(', ')}.`);
  rubric.push('');
  lines.splice(at === -1 ? lines.length : at, 0, ...rubric);
  return lines.join('\n');
}

/** One candidate at a time through the claude CLI. Only runs on --judge. */
function judgeEditorial(candidatesDoc, { onProgress = () => {} } = {}) {
  const verdicts = [];
  const skipped = [];
  for (const candidate of candidatesDoc.candidates) {
    onProgress(candidate);
    const reply = askClaude({
      buildPrompt: (prior) => buildEditorialPrompt(candidate, prior),
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
      promptVersion: RUBRIC.promptVersion,
    });
  }
  return { judgedAt: new Date().toISOString(), judge: `${GENERATOR_ID} --judge`, verdicts, skipped };
}

/** A link a reader can click from the hand-back file straight to the line. */
function lineLink(fromFile, candidate) {
  const rel = path.relative(path.dirname(path.resolve(fromFile)), path.resolve(candidate.file)).split(path.sep).join('/');
  const name = path.basename(candidate.file);
  // A path that climbs out past the shared parent reads worse than the absolute one.
  const target = rel.startsWith('../../../') ? path.resolve(candidate.file) : rel;
  return `[${name}:${candidate.line}](${target}#L${candidate.line})`;
}

/**
 * The hand-back for every UNCLEAR verdict. Each item names the file and line as
 * a link, quotes the sentence, and asks the question, so the reader can answer
 * it without searching. lint/check-handoff.js holds every hand-back to this.
 */
function renderEscalation(candidatesDoc, verdictsDoc, outFile) {
  const byId = new Map(candidatesDoc.candidates.map((c) => [c.candidateId, c]));
  const unclear = (verdictsDoc.verdicts || []).filter((v) => v.verdict === 'UNCLEAR' && byId.has(v.candidateId));
  const lines = ['# Needs your input', ''];
  if (!unclear.length) {
    lines.push('No open questions. Every candidate has a decided verdict.', '');
    return { text: lines.join('\n'), count: 0 };
  }
  lines.push(`Each of the ${unclear.length} item(s) below links to the exact line. Open the link, read the sentence, and answer the question.`, '');
  unclear.forEach((v, i) => {
    const c = byId.get(v.candidateId);
    lines.push(`## ${i + 1}. ${c.ruleId}: ${path.basename(c.file)} line ${c.line}`, '');
    lines.push(`- **Where:** ${lineLink(outFile, c)}`);
    lines.push(`- **Sentence:** ${String((c.evidence || [])[0] || '').trim()}`);
    lines.push(`- **Question:** ${c.decide}`);
    lines.push(`- **Why it is open:** ${v.reason}`, '');
  });
  return { text: lines.join('\n'), count: unclear.length };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArgs(argv) {
  const args = { targets: [], reconcile: false, judge: false, apply: false, escalate: null, candidates: null, verdicts: null, out: null };
  for (const arg of argv) {
    if (arg === '--reconcile') args.reconcile = true;
    else if (arg === '--judge') args.judge = true;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--escalate') args.escalate = DEFAULTS.escalate;
    else if (arg.startsWith('--escalate=')) args.escalate = arg.slice(11);
    else if (arg.startsWith('--candidates=')) args.candidates = arg.slice(13);
    else if (arg.startsWith('--verdicts=')) args.verdicts = arg.slice(11);
    else if (arg.startsWith('--out=')) args.out = arg.slice(6);
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const candidatesPath = args.candidates || DEFAULTS.candidates;
  const verdictsPath = args.verdicts || DEFAULTS.verdicts;

  if (args.reconcile || args.escalate) {
    if (!fs.existsSync(candidatesPath) || !fs.existsSync(verdictsPath)) {
      console.error(`Need both files. candidates=${candidatesPath} verdicts=${verdictsPath}`);
      process.exit(2);
    }
    const candidatesDoc = readJson(candidatesPath);
    const verdictsDoc = readJson(verdictsPath);
    const result = reconcile(candidatesDoc, verdictsDoc);
    console.log(`Reconcile: ${result.judged}/${result.total} candidates judged. ${Object.entries(result.tallies).map(([k, v]) => `${k}=${v}`).join('  ')}`);
    result.problems.slice(0, 40).forEach((p) => console.log(`  ${p}`));
    if (args.escalate) {
      const { text, count } = renderEscalation(candidatesDoc, verdictsDoc, args.escalate);
      fs.mkdirSync(path.dirname(path.resolve(args.escalate)), { recursive: true });
      fs.writeFileSync(args.escalate, `${text}\n`);
      console.log(`Wrote ${count} open question(s) to ${args.escalate}`);
    }
    process.exitCode = result.problems.length ? 1 : 0;
    return;
  }

  if (args.judge) {
    if (!fs.existsSync(candidatesPath)) {
      console.error(`No candidates at ${candidatesPath}. Run without --judge first.`);
      process.exit(2);
    }
    const candidatesDoc = readJson(candidatesPath);
    console.log(`Judging ${candidatesDoc.candidates.length} candidate(s) with the claude CLI${args.apply ? '' : ' (dry run, pass --apply to write verdicts)'}.`);
    const result = judgeEditorial(candidatesDoc, { onProgress: (c) => console.log(`${c.candidateId}  ${path.basename(c.file)}:${c.line}`) });
    for (const v of result.verdicts) console.log(`  ${v.verdict.padEnd(18)} ${v.candidateId}  ${v.reason}`);
    if (result.skipped.length) console.log(`Unjudged after retries: ${result.skipped.length}. Reconcile reports each one.`);
    if (!args.apply) return;
    fs.mkdirSync(path.dirname(verdictsPath), { recursive: true });
    const merged = mergeVerdicts(fs.existsSync(verdictsPath) ? readJson(verdictsPath) : null, result);
    fs.writeFileSync(verdictsPath, `${JSON.stringify(merged, null, 2)}\n`);
    console.log(`Wrote ${verdictsPath}. Next: --reconcile.`);
    return;
  }

  if (!args.targets.length) {
    console.error('Name the files or folders to review, for example: node judges/judge-editorial.js ../docs/mcp');
    process.exit(2);
  }
  const result = generateEditorial(args.targets);
  const outPath = args.out || candidatesPath;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Editorial candidates: ${result.counts.total} across ${result.counts.files} file(s)`);
  for (const [ruleId, n] of Object.entries(result.counts.byRule)) console.log(`  ${ruleId}  x${n}`);
  console.log(`Wrote ${outPath}`);
  const flags = args.out ? ` --candidates=${outPath} --verdicts=<verdicts.json>` : '';
  console.log(`Next: record a verdict for each candidate in ${args.out ? 'a verdicts file' : verdictsPath}, then run --reconcile --escalate${flags}.`);
}

if (require.main === module) main();

module.exports = {
  generateEditorial,
  buildEditorialPrompt,
  judgeEditorial,
  renderEscalation,
  lineLink,
  withRubric,
  EDITORIAL_RULES,
};
