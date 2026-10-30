#!/usr/bin/env node
'use strict';

/**
 * Runs every check on a file or folder, applies every fixer, sends what no
 * fixer can settle to the judges, and writes a ledger of what is still open.
 *
 * Before this script the pieces existed but nothing chained them. The fixers in
 * fix/ were run by hand, the judges by a separate command, and the revamp
 * commands gated on tier 1 alone, so a warning or an unjudged candidate could
 * sit in a "finished" page indefinitely. This script runs them in one order and
 * hands back a single list in which every item has to end resolved: fixed, or
 * judged a false alarm with a written reason, or escalated as a question with a
 * line link.
 *
 * About half the tier-1 and tier-2 rules have neither a fixer nor a judge, so
 * the only thing that can resolve them is a reader. That reader is the agent
 * running /fix-docs. This script does the mechanical part and keeps score; the
 * agent works the ledger and records what it decided in resolutions.json.
 *
 * Usage:
 *   node fix/fix-all.js <file|dir>... [--apply] [--no-llm] [--max-calls=N] [--run-dir=DIR]
 *   node fix/fix-all.js --reconcile --run-dir=DIR [--format=json]
 *
 * Without --apply the run lints and judges but leaves every file untouched.
 * --no-llm skips every step that calls the claude CLI. --reconcile repairs
 * anchors, re-checks everything without calling the model, applies
 * resolutions.json, and exits 1 while any item is open.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const { collectDocs } = require('../lint/sweep-docs');
const { lintFile } = require('../lint/lint-doc');
const apiRef = require('../lint/lint-api-ref');
const review = require('../judges/review-candidates');
const editorial = require('../judges/judge-editorial');
const reading = require('../judges/judge-reading');
const classifier = require('../judges/classify-doc-type');
const { byId } = require('../lib/rules-registry');
const checkSources = require('../data/check-sources.json');

const SCRIPTS = path.join(__dirname, '..');

/** The judges write file paths relative to the folder that holds this checkout. */
const JUDGE_ROOT = path.join(__dirname, '..', '..', '..');

/** A ceiling on claude CLI calls for one run, printed up front so the spend is never a surprise. */
const DEFAULT_MAX_CALLS = 200;

/** The filenames lint-api-ref.js owns. Linting them as prose reports the wrong rule family. */
const API_REF_NAMES = new Set(['usage_guide.md', 'class_reference.md']);

/**
 * Every fixer, in the order they run. Deterministic passes go first so the
 * fixers that call the model see fewer lines. `multi` fixers take every file
 * in one call; the others take one file per call and cost one model call per
 * finding, so they run only while the budget covers every finding in the file.
 */
const FIXERS = [
  { script: 'fix-dashes.js', rules: ['C3-05'], multi: true, llmFlag: true },
  { script: 'fix-emoji-italics.js', rules: ['C3-27', 'C3-28', 'C3-30'], multi: true, llmFlag: true },
  { script: 'fix-acronym-first-use.js', rules: ['C8-07'], multi: true, llmFlag: true },
  { script: 'fix-anthropomorphism.js', rules: ['C3-18'], multi: true, llmOnly: true },
  { script: 'fix-banned-phrases.js', rules: checkSources['banned-phrases'].rules, llmOnly: true },
  { script: 'fix-concision.js', rules: ['C3-07'], llmOnly: true, passType: true },
  { script: 'fix-tense.js', rules: ['C3-19'], llmOnly: true },
];

const RESOLUTION_STATUSES = new Set(['false-positive', 'compliant', 'exception', 'checked', 'needs-input']);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
}

function isApiRef(file) {
  return API_REF_NAMES.has(path.basename(file)) || path.resolve(file).split(path.sep).includes('methods');
}

function hasDocType(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return Boolean(m && /^doc_type\s*:/m.test(m[1]));
}

function lineText(file, line) {
  if (!line) return '';
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  return lines[line - 1] || '';
}

/** A judge records paths relative to JUDGE_ROOT. Everything here is absolute. */
function absFile(file) {
  return path.isAbsolute(file) ? file : path.resolve(JUDGE_ROOT, file);
}

/**
 * An item's identity is its file, its rule and the text of its line, never the
 * line number. Fixing one line shifts every line below it, and a key that moved
 * with it would orphan every resolution already recorded.
 */
function keyOf(kind, file, ruleId, text) {
  const norm = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return `${kind}:${crypto.createHash('sha1').update([path.resolve(file), ruleId, norm].join('|')).digest('hex').slice(0, 16)}`;
}

/** Two identical lines can carry the same finding, so the second gets its own key. */
function uniqueKeys(items) {
  const seen = new Map();
  for (const item of items) {
    const n = seen.get(item.key) || 0;
    seen.set(item.key, n + 1);
    if (n) item.key = `${item.key}.${n}`;
  }
  return items;
}

function gitRoot(dir) {
  const r = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** The folder anchor repair works over: the target itself, or a file's own folder. */
function anchorDir(target) {
  return fs.statSync(target).isDirectory() ? target : path.dirname(target);
}

function runPaths(runDir) {
  return {
    runDir,
    state: path.join(runDir, 'state.json'),
    log: path.join(runDir, 'run.log'),
    slugs: path.join(runDir, 'heading-slugs.json'),
    candidates: path.join(runDir, 'candidates.json'),
    verdicts: path.join(runDir, 'verdicts.json'),
    toneCache: path.join(runDir, 'tone-cache.json'),
    verdictsByKey: path.join(runDir, 'verdicts-by-key.json'),
    resolutions: path.join(runDir, 'resolutions.json'),
    ledger: path.join(runDir, 'ledger.json'),
    needsInput: path.join(runDir, 'NEEDS-YOUR-INPUT.md'),
  };
}

function runScript(paths, rel, args) {
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, rel), ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.appendFileSync(paths.log, `\n$ node ${rel} ${args.join(' ')}\n${r.stdout || ''}${r.stderr || ''}exit ${r.status}\n`);
  return r;
}

function makeBudget(max) {
  return {
    left: max,
    used: 0,
    spend(n) {
      const take = Math.max(0, Math.min(this.left, n));
      this.left -= take;
      this.used += take;
      return take;
    },
  };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Tier-1 and tier-2 rules that check-sources.json marks unimplemented. No check
 * reports them, so a page that passes lint has not passed them. Each one goes on
 * the page's checklist, where a reader has to confirm it.
 */
const UNENFORCED = Object.values(checkSources)
  .filter((s) => s.kind === 'unimplemented')
  .flatMap((s) => s.rules)
  .map((id) => byId(id))
  .filter(Boolean);

function unenforcedFor(type) {
  return UNENFORCED.filter((r) => r.docTypes.includes(type) || (type !== 'api-ref' && r.docTypes.includes('all'))).map((r) => r.id);
}

/** Lints one file with the linter its family belongs to. */
function lintOne(file) {
  if (isApiRef(file)) {
    return { family: 'api-ref', type: 'api-ref', findings: apiRef.lintFile(file, [1, 2]), manual: unenforcedFor('api-ref') };
  }
  const report = lintFile(file, { tiers: [1, 2] });
  return {
    family: String(report.type).startsWith('cli-') ? 'cli' : 'prose',
    type: report.type,
    findings: [...report.automatedFindings, ...report.flagged],
    manual: [...new Set([...report.manualReviewQueue.map((r) => r.id), ...unenforcedFor(report.type)])],
  };
}

/** Every tier-3 candidate, split the way the judges split them. Never calls the model. */
function collectCandidates(files) {
  const general = review.generate(files);
  general.candidates = general.candidates.filter((c) => !editorial.EDITORIAL_RULES.includes(c.ruleId));
  return {
    general,
    editorial: editorial.generateEditorial(files),
    reading: reading.generate(files),
  };
}

function candidateKey(c) {
  const file = absFile(c.file);
  return keyOf('J', file, c.ruleId, lineText(file, c.line));
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

function classifyMissingTypes(files, budget, log) {
  const untyped = files.filter((f) => !isApiRef(f) && !hasDocType(f));
  if (!untyped.length) return;
  const candidatesDoc = classifier.generate(untyped);
  // generate() keeps only published pages. An agent prompt or an internal note
  // carries no doc type, and classifying it would spend a call to change nothing.
  if (!candidatesDoc.candidates.length) return;
  const take = budget.spend(candidatesDoc.candidates.length);
  if (!take) return log(`classify: ${candidatesDoc.candidates.length} page(s) without doc_type, no budget left`);
  const verdictsDoc = classifier.judge(candidatesDoc, { maxCalls: take });
  let written = 0;
  for (const v of verdictsDoc.verdicts || []) {
    if (!v.type) continue;
    const r = classifier.applyOne(v.candidateId, v.type);
    if (r.status === 'written' || r.status === 'updated') written += 1;
  }
  log(`classify: wrote doc_type on ${written} of ${untyped.length} page(s)`);
}

function runFixers(files, baseline, paths, opts, budget, log) {
  for (const fixer of FIXERS) {
    const counts = new Map();
    for (const f of files) {
      const n = baseline.get(f).findings.filter((x) => fixer.rules.includes(x.ruleId)).length;
      if (n) counts.set(f, n);
    }
    if (!counts.size) continue;
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (fixer.llmOnly && !opts.llm) {
      log(`${fixer.script}: ${total} finding(s) left for the ledger (--no-llm)`);
      continue;
    }

    if (fixer.multi) {
      const args = [...counts.keys(), '--apply'];
      if (opts.llm) {
        const take = budget.spend(total);
        if (take && fixer.llmFlag) args.push('--llm');
        if (take) args.push(`--max-calls=${take}`);
        else if (fixer.llmOnly) {
          log(`${fixer.script}: ${total} finding(s) left for the ledger, no budget left`);
          continue;
        }
      }
      const r = runScript(paths, `fix/${fixer.script}`, args);
      log(`${fixer.script}: ${total} finding(s) across ${counts.size} file(s), exit ${r.status}`);
      continue;
    }

    for (const [file, n] of counts) {
      if (budget.left < n) {
        log(`${fixer.script}: ${path.basename(file)} has ${n} finding(s), over the remaining budget`);
        continue;
      }
      budget.spend(n);
      const args = [file, '--apply', '--yes'];
      const info = baseline.get(file);
      if (fixer.passType && info.family === 'prose') args.push(`--type=${info.type}`);
      const r = runScript(paths, `fix/${fixer.script}`, args);
      log(`${fixer.script}: ${path.basename(file)}, ${n} finding(s), exit ${r.status}`);
    }
  }
}

/** Asks every judge about every candidate the budget covers, and stores the answers by key. */
function runJudges(files, paths, budget, log) {
  const sets = collectCandidates(files);
  const byKey = readJson(paths.verdictsByKey, {});
  const record = (candidates, verdicts, source) => {
    const byId = new Map(candidates.map((c) => [c.candidateId, c]));
    for (const v of verdicts || []) {
      const c = byId.get(v.candidateId);
      if (!c) continue;
      byKey[candidateKey(c)] = { verdict: v.verdict, reason: v.reason, fix: v.fix || null, exceptionQuoted: v.exceptionQuoted || null, source };
    }
  };

  // The tone judge batches many sentences per call, so it goes first and
  // leaves the one-call-per-candidate judge fewer candidates to pay for.
  writeJson(paths.candidates, sets.general);
  if (budget.left) {
    const r = runScript(paths, 'judges/judge-tone.js', [
      `--candidates=${paths.candidates}`,
      `--verdicts=${paths.verdicts}`,
      `--cache=${paths.toneCache}`,
      `--max-calls=${budget.left}`,
      '--emit-verdicts',
    ]);
    const m = /(\d+) claude call/.exec(r.stdout || '');
    budget.spend(m ? Number(m[1]) : 0);
  }
  const toneDoc = readJson(paths.verdicts, { verdicts: [] });
  const judged = new Set(toneDoc.verdicts.map((v) => v.candidateId));
  const rest = sets.general.candidates.filter((c) => !judged.has(c.candidateId));
  const restTake = rest.slice(0, budget.spend(rest.length));
  const fresh = review.judge({ ...sets.general, candidates: restTake });
  const merged = review.mergeVerdicts(toneDoc.verdicts.length ? toneDoc : null, fresh);
  writeJson(paths.verdicts, merged);
  record(sets.general.candidates, merged.verdicts, 'review-candidates');

  const edTake = sets.editorial.candidates.slice(0, budget.spend(sets.editorial.candidates.length));
  record(sets.editorial.candidates, editorial.judgeEditorial({ ...sets.editorial, candidates: edTake }).verdicts, 'judge-editorial');

  const rdTake = budget.spend(sets.reading.candidates.length);
  if (rdTake) record(sets.reading.candidates, reading.judge(sets.reading, { maxCalls: rdTake }).verdicts, 'judge-reading');

  writeJson(paths.verdictsByKey, byKey);
  const total = sets.general.candidates.length + sets.editorial.candidates.length + sets.reading.candidates.length;
  log(`judges: ${Object.keys(byKey).length} verdict(s) on hand for ${total} candidate(s)`);
}

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

/**
 * Checks one resolution against the item it claims to settle. Returns a
 * problem string, or null. The rules mirror review-candidates.js reconcile: a
 * reason is always required, and a claimed exception has to quote the rule's
 * own exception, because "exception applies" with no quote cannot be audited.
 */
function validateResolution(item, res) {
  if (!RESOLUTION_STATUSES.has(res.status)) return `status "${res.status}" is not one of ${[...RESOLUTION_STATUSES].join(', ')}`;
  if (!res.reason || !String(res.reason).trim()) return 'every resolution needs a reason';
  if (res.status === 'needs-input' && !res.question) return 'a needs-input resolution needs a question';

  if (item.kind === 'manual') {
    if (res.status !== 'checked' && res.status !== 'needs-input') return 'a manual checklist resolves as "checked"';
    const missing = item.rules.filter((r) => !(res.checked || []).includes(r));
    if (res.status === 'checked' && missing.length) return `the checklist still lacks ${missing.join(', ')}`;
    return null;
  }

  const exception = (byId(item.ruleId) || {}).exception || item.exception || '';
  const needsQuote = res.status === 'exception' || (item.kind === 'lint' && item.tier === 1 && res.status === 'false-positive');
  if (needsQuote && (!res.exceptionQuoted || !String(exception).includes(res.exceptionQuoted))) {
    return `quote the rule's exception verbatim in "exceptionQuoted". ${item.ruleId} exception: ${JSON.stringify(exception)}`;
  }
  return null;
}

/** Rebuilds every item from the files as they stand now, then settles each one. Never calls the model. */
function buildLedger(paths) {
  const state = readJson(paths.state);
  if (!state) throw new Error(`No run at ${paths.runDir}. Start one with: node fix/fix-all.js <target> --apply`);
  const files = [...new Set(state.targets.flatMap((t) => collectDocs(t)))].sort();

  const items = [];
  for (const file of files) {
    const info = lintOne(file);
    const lint = info.findings.map((f) => ({
      key: keyOf('L', file, f.ruleId, lineText(file, f.line)),
      kind: 'lint',
      tier: f.tier,
      ruleId: f.ruleId,
      family: info.family,
      file,
      line: f.line,
      message: f.message,
      falsePositiveNote: f.falsePositiveNote || null,
    }));
    items.push(...uniqueKeys(lint));
    if (info.manual.length) {
      items.push({ key: keyOf('M', file, 'manual', ''), kind: 'manual', family: info.family, file, line: 1, rules: info.manual });
    }
  }

  const sets = collectCandidates(files);
  const direct = (sets.reading.direct || []).map((f) => {
    const file = absFile(f.file);
    return { key: keyOf('L', file, f.ruleId, lineText(file, f.line)), kind: 'lint', tier: 1, ruleId: f.ruleId, file, line: f.line, message: f.message };
  });
  items.push(...uniqueKeys(direct));

  const byKey = readJson(paths.verdictsByKey, {});
  const judgeItems = [...sets.general.candidates, ...sets.editorial.candidates, ...sets.reading.candidates].map((c) => {
    const key = candidateKey(c);
    return {
      key,
      kind: 'judge',
      ruleId: c.ruleId,
      file: absFile(c.file),
      line: c.line,
      question: c.decide || c.rule,
      exception: c.exception || '',
      evidence: (c.evidence || [])[0] || lineText(absFile(c.file), c.line).trim(),
      verdict: byKey[key] || null,
    };
  });
  items.push(...uniqueKeys(judgeItems));

  // Parallel agents each write their own resolutions-<n>.json, so no two of
  // them race on one file. Every file matching the pattern counts.
  const resolutionFiles = fs.readdirSync(paths.runDir).filter((f) => /^resolutions(-[\w.]+)?\.json$/.test(f)).sort();
  const resolutions = new Map(
    resolutionFiles.flatMap((f) => readJson(path.join(paths.runDir, f), { resolutions: [] }).resolutions || []).map((r) => [r.key, r])
  );
  const problems = [];
  for (const item of items) {
    const res = resolutions.get(item.key);
    if (res) {
      const problem = validateResolution(item, res);
      if (problem) {
        problems.push(`${item.key} (${path.basename(item.file)}:${item.line} ${item.ruleId || 'checklist'}): ${problem}`);
        item.status = 'open';
      } else {
        item.status = res.status === 'needs-input' ? 'needs-input' : 'resolved';
        item.resolution = res;
      }
      continue;
    }
    if (item.kind === 'judge' && item.verdict) {
      const v = item.verdict.verdict;
      if (v === 'COMPLIANT' || v === 'EXCEPTION_APPLIES') item.status = 'resolved';
      else if (v === 'UNCLEAR') item.status = 'needs-input';
      else item.status = 'open';
      continue;
    }
    if (item.kind === 'manual') {
      item.status = 'open';
      continue;
    }
    item.status = 'open';
  }

  const counts = { files: files.length, open: 0, resolved: 0, needsInput: 0, byKind: {} };
  for (const item of items) {
    if (item.status === 'open') counts.open += 1;
    else if (item.status === 'resolved') counts.resolved += 1;
    else counts.needsInput += 1;
    const k = `${item.kind} ${item.status}`;
    counts.byKind[k] = (counts.byKind[k] || 0) + 1;
  }
  return { generatedAt: new Date().toISOString(), runDir: paths.runDir, counts, problems, items };
}

/** The questions only the user can answer, each linked to its line so the reader can find it. */
function renderNeedsInput(ledger, outFile) {
  const open = ledger.items.filter((i) => i.status === 'needs-input');
  const lines = ['# Needs your input', ''];
  if (!open.length) {
    lines.push('No open questions.', '');
    return lines.join('\n');
  }
  lines.push(`Each of the ${open.length} item(s) below links to the exact line. Open the link, read the line, and answer the question.`, '');
  open.forEach((item, i) => {
    const question = (item.resolution && item.resolution.question) || (item.verdict && item.verdict.reason) || item.question;
    lines.push(`## ${i + 1}. ${item.ruleId || 'Checklist'}: ${path.basename(item.file)} line ${item.line}`, '');
    lines.push(`- **Where:** ${editorial.lineLink(outFile, { file: item.file, line: item.line })}`);
    lines.push(`- **Line:** ${lineText(item.file, item.line).trim()}`);
    lines.push(`- **Question:** ${question}`, '');
  });
  return lines.join('\n');
}

function writeLedger(paths, ledger) {
  writeJson(paths.ledger, ledger);
  fs.writeFileSync(paths.needsInput, `${renderNeedsInput(ledger, paths.needsInput)}\n`);
}

function printLedger(ledger) {
  const c = ledger.counts;
  console.log(`Ledger: ${c.files} file(s), ${c.open} open, ${c.resolved} resolved, ${c.needsInput} need your input.`);
  for (const [k, n] of Object.entries(c.byKind).sort()) console.log(`  ${String(n).padStart(5)}  ${k}`);
  if (ledger.problems.length) {
    console.log(`Rejected resolutions: ${ledger.problems.length}`);
    ledger.problems.slice(0, 30).forEach((p) => console.log(`  ${p}`));
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { targets: [], apply: false, llm: true, reconcile: false, maxCalls: DEFAULT_MAX_CALLS, runDir: null, format: 'text' };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--no-llm') args.llm = false;
    else if (arg === '--reconcile') args.reconcile = true;
    else if (arg.startsWith('--max-calls=')) args.maxCalls = parseInt(arg.slice(12), 10) || 0;
    else if (arg.startsWith('--run-dir=')) args.runDir = path.resolve(arg.slice(10));
    else if (arg.startsWith('--format=')) args.format = arg.slice(9);
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else args.targets.push(path.resolve(arg));
  }
  return args;
}

function reconcileRun(args) {
  const paths = runPaths(args.runDir);
  const state = readJson(paths.state);
  if (!state) {
    console.error(`No run at ${args.runDir}.`);
    process.exit(2);
  }
  // Heading edits made while working the ledger break anchors that point at
  // them. The snapshot from the start of the run maps each old anchor to its
  // heading, so the repair is mechanical.
  for (const t of state.targets) runScript(paths, 'fix/repair-anchors.js', ['--repair', anchorDir(t), '--apply', `--snapshot-file=${paths.slugs}`]);
  const ledger = buildLedger(paths);
  writeLedger(paths, ledger);
  if (args.format === 'json') console.log(JSON.stringify(ledger.counts, null, 2));
  else printLedger(ledger);
  console.log(`Wrote ${paths.ledger}`);
  process.exitCode = ledger.counts.open || ledger.problems.length ? 1 : 0;
}

function run(args) {
  const missing = args.targets.filter((t) => !fs.existsSync(t));
  if (missing.length) {
    console.error(`Not found: ${missing.join(', ')}`);
    process.exit(2);
  }
  const first = args.targets[0];
  const root = gitRoot(anchorDir(first)) || anchorDir(first);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const paths = runPaths(args.runDir || path.join(root, '.doc-review', `fix-${stamp}`));
  fs.mkdirSync(paths.runDir, { recursive: true });
  fs.writeFileSync(paths.log, '');

  const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(paths.log, `${msg}\n`);
  };
  const budget = makeBudget(args.llm ? args.maxCalls : 0);
  writeJson(paths.state, { targets: args.targets, startedAt: new Date().toISOString(), apply: args.apply, llm: args.llm, maxCalls: args.maxCalls });
  log(`Run folder: ${paths.runDir}`);
  log(args.llm ? `Model budget: up to ${args.maxCalls} claude call(s).` : 'Model calls: off (--no-llm).');

  let files = [...new Set(args.targets.flatMap((t) => collectDocs(t)))].sort();
  log(`Files: ${files.length} (${files.filter(isApiRef).length} api-ref)`);

  if (args.apply && args.llm) classifyMissingTypes(files, budget, log);

  const baseline = new Map(files.map((f) => [f, lintOne(f)]));
  const before = [...baseline.values()].reduce((n, b) => n + b.findings.length, 0);
  log(`Baseline: ${before} tier-1 and tier-2 finding(s)`);

  if (args.apply) {
    for (const t of args.targets) runScript(paths, 'fix/repair-anchors.js', ['--snapshot', anchorDir(t), `--snapshot-file=${paths.slugs}`]);
    runFixers(files, baseline, paths, args, budget, log);
    for (const t of args.targets) runScript(paths, 'fix/repair-anchors.js', ['--repair', anchorDir(t), '--apply', `--snapshot-file=${paths.slugs}`]);
    files = [...new Set(args.targets.flatMap((t) => collectDocs(t)))].sort();
  }

  if (args.llm && budget.left) runJudges(files, paths, budget, log);
  log(`Model calls used: ${budget.used}`);

  const ledger = buildLedger(paths);
  writeLedger(paths, ledger);
  printLedger(ledger);
  console.log(`Wrote ${paths.ledger}`);
  console.log(`Next: resolve each open item, record decisions in ${paths.resolutions}, then run --reconcile --run-dir=${paths.runDir}`);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  if (args.reconcile) {
    if (!args.runDir) {
      console.error('--reconcile needs --run-dir=<the run folder the first pass printed>');
      process.exit(2);
    }
    return reconcileRun(args);
  }
  if (!args.targets.length) {
    console.error('Usage: fix-all.js <file|dir>... [--apply] [--no-llm] [--max-calls=N] [--run-dir=DIR] | --reconcile --run-dir=DIR');
    process.exit(2);
  }
  return run(args);
}

if (require.main === module) main();

module.exports = { buildLedger, validateResolution, renderNeedsInput, keyOf, isApiRef, lintOne, runPaths, FIXERS };
