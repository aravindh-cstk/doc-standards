#!/usr/bin/env node
'use strict';

/**
 * Declares each page's doc type in its own front matter, judged by `claude -p`.
 *
 * Why this exists, in one measurement. `detectDocType()` in lint-doc.js is a
 * title-and-heading heuristic, and on this corpus it answered
 * `conceptual-guide` for 327 of 355 files. Section structure (C1-01) then asked
 * every one of those for an Overview and a Next Steps section, producing 709
 * findings of which 651 were the same two messages.
 *
 * That is not a tuning problem. The heuristic is circular: its `setup-guide`
 * branch tests text taken from the document's own Overview section, so a page
 * with no Overview cannot be classified as a setup guide, and the fallback it
 * lands on is the type that requires an Overview. The rule manufactures its own
 * findings. No amount of extra keywords fixes a self-referential test.
 *
 * A doc's type is a judgment about what the page is FOR, which is what a reader
 * decides in the first paragraph and what no regex can read. So it is judged
 * once, per page, by a model, recorded in the file, and then read
 * deterministically forever after. Lint stays reproducible: the `claude` call
 * happens here, never inside a check.
 *
 * Three files, one direction each, exactly as review-candidates.js does it:
 *
 *   candidates  what needs classifying. Regenerating only ever adds or drops
 *               entries, and never touches a verdict.
 *   verdicts    one answer per candidate. Written by --judge, or by hand.
 *   reconcile   refuses to apply anything while a candidate is unjudged, so a
 *               run that stopped halfway cannot read as a completed pass.
 *
 * --apply is the only step that edits a doc, and it writes exactly one key.
 *
 * Usage:
 *   node classify-doc-type.js <dir>...                 # generate candidates
 *   node classify-doc-type.js --judge                  # ask claude, write verdicts
 *   node classify-doc-type.js --judge --max-calls=20   # judge a slice
 *   node classify-doc-type.js --reconcile              # verify, change nothing
 *   node classify-doc-type.js --apply                  # write doc_type: front matter
 */

const fs = require('fs');
const path = require('path');

const { DocModel } = require('./lib/doc-model');
const { askClaude } = require('./lib/claude-runner');
const { collectDocs } = require('./sweep-docs');
const { classify } = require('./lib/corpus-class');
const { VALID_TYPES } = require('./lint-doc');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_DIR = path.join(REPO_ROOT, '.doc-review');
const CANDIDATES_PATH = path.join(DEFAULT_DIR, 'doc-type-candidates.json');
const VERDICTS_PATH = path.join(DEFAULT_DIR, 'doc-type-verdicts.json');

/**
 * In the cache key, so changing the question invalidates stored answers rather
 * than serving answers reached under a different one. Bump it when an edit to
 * buildPrompt could change a verdict.
 */
const PROMPT_VERSION = 'doctype@2';

/**
 * What each type is for, in the words a reader would use.
 *
 * Taken from data/section-matrix.json's row set rather than restated, because
 * the matrix is what the classification actually feeds: naming a type here that
 * the matrix does not carry produces a verdict no check can use.
 */
const TYPE_DESCRIPTIONS = {
  'getting-started': 'The entry point for a whole product area. Routes different readers to different paths, and carries a Quick Start.',
  'conceptual-guide': 'Explains how something works and why, so the reader can make a decision. Not a procedure.',
  'feature-doc': 'Documents one feature or surface: what it does, its options, and its behavior.',
  'how-to-guide': 'One task, start to finish, in order. The reader arrives knowing what they want to do.',
  'setup-guide': 'Installation and configuration. The reader ends with a working environment.',
  'kickstarter': 'Clone a starter, run it, and see it work. Built around an existing repository.',
  'migration-guide': 'Move from one version or product to another. Carries a type mapping and an upgrade checklist.',
  'chapter-index': 'The landing page of one chapter. Lists the chapter\'s pages with a sentence each and hands the reader on. Teaches nothing itself.',
};

/**
 * A reference page is not a listed type, and that is on purpose.
 *
 * The section matrix has seven rows and none of them is "reference". The corpus
 * holds nine reference pages under 90-reference/ plus the API surface under
 * api/, and forcing them into `conceptual-guide` is exactly the mistake this
 * script exists to stop. `feature-doc` is the closest row: it asks for an
 * Overview and lets the rest of the shape follow the page. The prompt says so
 * explicitly rather than leaving the model to guess.
 */
const REFERENCE_GUIDANCE =
  'A pure reference page (an exhaustive table of parameters, endpoints, flags or variables, ' +
  'meant for lookup rather than reading start to finish) has no row of its own. Classify it as ' +
  'feature-doc, which is the closest shape.';

/**
 * The distinction the first run could not make, and the reason chapter-index
 * exists at all.
 *
 * Judged against the original seven types, 24 pages came back
 * `getting-started`, and 15 of them were chapter `index.md` files. The model
 * was not wrong: routing a reader is what a Get Started Guide's Role-Based
 * Routing Table does, and no other type mentioned routing. The result was 72
 * findings asking a chapter index for a Quick Start it should never carry. The
 * separation is scope, so the prompt states it rather than leaving it to be
 * inferred.
 */
const SCOPE_GUIDANCE =
  'getting-started and chapter-index both route a reader, and scope separates them. ' +
  'A getting-started page is the single entry point to the whole product and routes to a CHAPTER. ' +
  'A chapter-index is the entry point to one chapter and routes to a PAGE in it. ' +
  'A page whose body is mostly a list of links to its sibling pages is a chapter-index, ' +
  'whatever its filename.';

function ensureDir() {
  fs.mkdirSync(DEFAULT_DIR, { recursive: true });
}

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  ensureDir();
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`);
}

/** The path as the candidates file records it: relative to the repo root. */
function relPath(file) {
  return path.relative(REPO_ROOT, path.resolve(file)).split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

/**
 * The evidence one classification is allowed to rest on.
 *
 * Deliberately not the whole file. A 900-line page costs more than the answer is
 * worth and buries the signal, and the signal is at the top: what the H1 claims
 * the page is, what the opening paragraphs promise, and what the section names
 * reveal about the shape. A page whose type is not settled by those three is a
 * page whose type its reader cannot settle either.
 */
function evidenceFor(doc) {
  const title = (doc.headings.find((h) => h.level === 1) || {}).text || '(no H1)';
  const sections = doc.topLevelSections().map((s) => s.text);
  const bodyStart = doc.frontMatter && doc.frontMatter.present ? doc.frontMatter.endLine + 1 : 1;
  const opening = doc
    .proseLineNumbers(bodyStart, Math.min(bodyStart + 60, doc.lines.length))
    .map((l) => doc.lines[l - 1])
    .filter((l) => l.trim() && !l.startsWith('#'))
    .slice(0, 12)
    .join('\n');

  return { title, sections, opening };
}

function generate(targets) {
  const files = targets.flatMap((t) => collectDocs(t));
  const candidates = [];

  for (const file of files) {
    // Only pages whose shape the section matrix governs. An agent prompt or an
    // internal note is exempt from C1-01 already, so classifying it would spend
    // a call to change nothing.
    if (classify(file) !== 'published') continue;

    const doc = DocModel.fromFile(file);
    const ev = evidenceFor(doc);
    candidates.push({
      candidateId: relPath(file),
      file: relPath(file),
      title: ev.title,
      sections: ev.sections,
      opening: ev.opening,
      promptVersion: PROMPT_VERSION,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    corpus: targets.map(relPath),
    generator: 'classify-doc-type.js@1',
    validTypes: VALID_TYPES,
    counts: { total: candidates.length, files: files.length },
    candidates,
  };
}

// ---------------------------------------------------------------------------
// Judge
// ---------------------------------------------------------------------------

function buildPrompt(candidate, priorViolation) {
  const lines = [
    'You are classifying one page of technical documentation by its type.',
    'The type decides which sections the page is required to carry, so answer by what the page is FOR, not by its subject matter.',
    '',
    'The seven types, all of the ones available:',
    ...VALID_TYPES.map((t) => `  ${t}: ${TYPE_DESCRIPTIONS[t]}`),
    '',
    REFERENCE_GUIDANCE,
    '',
    SCOPE_GUIDANCE,
    '',
    `File: ${candidate.file}`,
    `Title (H1): ${candidate.title}`,
    `Top-level sections, in order: ${candidate.sections.length ? candidate.sections.join(' | ') : '(none)'}`,
    '',
    'Opening prose:',
    candidate.opening || '(none)',
    '',
    'Reply with ONLY one JSON object, no prose around it, no markdown fence:',
    '{"type": "...", "reason": "..."}',
    '',
    `"type" is exactly one of: ${VALID_TYPES.join(', ')}.`,
    '"reason" is one sentence naming what in the evidence decided it.',
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
  if (!VALID_TYPES.includes(parsed.type)) {
    return `"type" must be exactly one of ${VALID_TYPES.join(', ')}`;
  }
  if (!parsed.reason || !String(parsed.reason).trim()) {
    return 'every classification needs a reason';
  }
  return null;
}

/**
 * One call per page, and a cache so a re-run costs nothing for pages already
 * answered under the same prompt version.
 *
 * One call per page rather than one call for a batch, for the reason
 * review-candidates.js documents at its own judge loop: the failure mode is a
 * model quietly answering for the first eight of twenty. A page that cannot be
 * judged is simply left out of the verdicts, where reconcile reports it.
 */
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
    judge: 'classify-doc-type.js@1',
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
    process.stdout.write(`  [${calls}] ${candidate.file} ... `);
    const reply = askClaude({
      buildPrompt: (prior) => buildPrompt(candidate, prior),
      validate: validateReply,
    });
    if (!reply) {
      console.log('unjudged');
      continue;
    }
    const parsed = JSON.parse(reply);
    console.log(parsed.type);
    if (calls % CHECKPOINT_EVERY === 0) writeJson(VERDICTS_PATH, wrap(verdicts));
    verdicts.push({
      candidateId: candidate.candidateId,
      type: parsed.type,
      reason: parsed.reason,
      promptVersion: PROMPT_VERSION,
    });
  }

  console.log(`\n${verdicts.length} verdicts (${reused} reused, ${calls} calls).`);

  return wrap(verdicts);
}

// ---------------------------------------------------------------------------
// Reconcile
// ---------------------------------------------------------------------------

/**
 * Every rejection here is a way the pass could look complete while being hollow:
 * a page nobody judged, a verdict for a page that no longer exists, a type
 * outside the seven, a verdict reached under an older prompt.
 */
function reconcile(candidatesDoc, verdictsDoc) {
  const problems = [];
  const byId = new Map(candidatesDoc.candidates.map((c) => [c.candidateId, c]));
  const judged = new Map();

  for (const v of (verdictsDoc && verdictsDoc.verdicts) || []) {
    if (!v.candidateId) {
      problems.push('A verdict has no candidateId.');
      continue;
    }
    if (judged.has(v.candidateId)) problems.push(`Duplicate verdict for ${v.candidateId}.`);
    judged.set(v.candidateId, v);

    if (!byId.has(v.candidateId)) {
      problems.push(`Verdict for unknown page ${v.candidateId}. Regenerate, the file may have moved.`);
      continue;
    }
    if (!VALID_TYPES.includes(v.type)) {
      problems.push(`${v.candidateId}: type "${v.type}" is not one of ${VALID_TYPES.join(', ')}.`);
    }
    if (!v.reason || !String(v.reason).trim()) {
      problems.push(`${v.candidateId}: every classification needs a reason.`);
    }
    if (v.promptVersion !== PROMPT_VERSION) {
      problems.push(`${v.candidateId}: judged under ${v.promptVersion}, current prompt is ${PROMPT_VERSION}.`);
    }
  }

  const unjudged = candidatesDoc.candidates.filter((c) => !judged.has(c.candidateId));
  for (const c of unjudged) problems.push(`Unjudged page ${c.candidateId}.`);

  const tallies = {};
  for (const v of judged.values()) tallies[v.type] = (tallies[v.type] || 0) + 1;

  return { problems, unjudged: unjudged.length, judged: judged.size, total: candidatesDoc.candidates.length, tallies };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * Writes `doc_type:` into the front matter, and nothing else.
 *
 * The key goes last in the block so the diff is one added line per file. A file
 * that already declares the same type is left byte-identical, which is what
 * makes a re-run safe to include in a larger pass.
 */
function applyOne(file, type) {
  const abs = path.join(REPO_ROOT, file);
  const source = fs.readFileSync(abs, 'utf8');
  const lines = source.split('\n');

  if (lines[0] !== '---') {
    return { file, status: 'skipped', why: 'no front matter block to write into' };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return { file, status: 'skipped', why: 'front matter never closes' };

  const existing = lines.slice(1, end).findIndex((l) => /^doc_type\s*:/.test(l));
  if (existing !== -1) {
    const current = lines[1 + existing].split(':').slice(1).join(':').trim();
    if (current === type) return { file, status: 'unchanged' };
    lines[1 + existing] = `doc_type: ${type}`;
    fs.writeFileSync(abs, lines.join('\n'));
    return { file, status: 'updated', from: current, to: type };
  }

  lines.splice(end, 0, `doc_type: ${type}`);
  fs.writeFileSync(abs, lines.join('\n'));
  return { file, status: 'written', to: type };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { targets: [], judge: false, reconcile: false, apply: false, refresh: false, maxCalls: Infinity };
  for (const arg of argv) {
    if (arg === '--judge') args.judge = true;
    else if (arg === '--reconcile') args.reconcile = true;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--refresh') args.refresh = true;
    else if (arg.startsWith('--max-calls=')) args.maxCalls = parseInt(arg.slice('--max-calls='.length), 10);
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.judge || args.reconcile || args.apply) {
    const candidatesDoc = readJson(CANDIDATES_PATH);
    if (!candidatesDoc) {
      console.error(`No candidates at ${CANDIDATES_PATH}. Generate them first.`);
      process.exit(2);
    }

    if (args.judge) {
      const verdictsDoc = judge(candidatesDoc, { maxCalls: args.maxCalls, refresh: args.refresh });
      writeJson(VERDICTS_PATH, verdictsDoc);
      console.log(`Wrote ${VERDICTS_PATH}`);
    }

    if (args.reconcile || args.apply) {
      const verdictsDoc = readJson(VERDICTS_PATH);
      const result = reconcile(candidatesDoc, verdictsDoc);
      console.log(`\n${result.judged} of ${result.total} judged.`);
      for (const [type, n] of Object.entries(result.tallies).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(n).padStart(4)}  ${type}`);
      }
      if (result.problems.length) {
        console.log(`\n${result.problems.length} problems:`);
        for (const p of result.problems.slice(0, 40)) console.log(`  ${p}`);
        if (result.problems.length > 40) console.log(`  ... and ${result.problems.length - 40} more`);
        process.exit(1);
      }
      console.log('\nReconciled clean.');

      if (args.apply) {
        const byId = new Map(verdictsDoc.verdicts.map((v) => [v.candidateId, v]));
        const tally = {};
        for (const c of candidatesDoc.candidates) {
          const r = applyOne(c.file, byId.get(c.candidateId).type);
          tally[r.status] = (tally[r.status] || 0) + 1;
          if (r.status === 'skipped') console.log(`  skipped ${r.file}: ${r.why}`);
        }
        console.log(`\nApplied: ${JSON.stringify(tally)}`);
      }
    }
    return;
  }

  if (!args.targets.length) {
    console.error(
      'Usage: classify-doc-type.js <dir>... | --judge [--max-calls=N] [--refresh] | --reconcile | --apply'
    );
    process.exit(2);
  }

  const doc = generate(args.targets);
  writeJson(CANDIDATES_PATH, doc);
  console.log(`${doc.counts.total} pages to classify, from ${doc.counts.files} files scanned.`);
  console.log(`Wrote ${CANDIDATES_PATH}`);
}

if (require.main === module) main();

module.exports = { generate, judge, reconcile, applyOne, buildPrompt, validateReply, evidenceFor, PROMPT_VERSION };
