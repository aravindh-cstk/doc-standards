#!/usr/bin/env node
'use strict';

/**
 * The `claude`-backed tone judge for the wordlist checks' judgment-bearing
 * siblings, plus a discovery mode that hunts wording no wordlist covers.
 *
 * Why this is a separate script and not a check in lint-doc.js's CHECKS array:
 * checks/tier3-candidates.js states the principle, "a candidate is a question,
 * and a lint failure has to be an answer". Concretely, a `claude -p` call inside
 * a check would run once per line per file on every sweep, make probe-corpus.js
 * nondeterministic when its entire purpose is a reproducible diff of hit sets,
 * cost money on every editor save through the hook, and surface a network
 * timeout as a tier-1 LD-00 doc violation. So the deterministic half stays in
 * CHECKS (C3-18) and the judgment half lives here (C3-21).
 *
 * Why it is not simply `review-candidates.js --judge`: that function's one call
 * per candidate is a deliberate guarantee, documented at its own definition, and
 * batching would break it. This script keeps the same guarantee by different
 * means (a count-checked batch, a singleton retry, and the same reconcile gate),
 * and its unit of work is a sentence rather than a candidate.
 *
 * Two things it deliberately does NOT do:
 *
 * 1. No --apply. The judge writes verdicts. Prose rewriting stays in fix/, which
 *    preserves the one-direction discipline that makes regeneration safe.
 * 2. No auto-promotion of a discovered pattern into data/. A proposal has to
 *    pass probe-corpus.js's convergence test, by hand, first.
 *
 * Usage:
 *   node judge-tone.js [targets...] [--rules=C3-21] [--batch=12] [--max-calls=N]
 *                      [--emit-verdicts] [--refresh] [--discover] [--probe]
 *                      [--format=text|json]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { collectDocs } = require('../sweep-docs');
const { lintFile } = require('../lint-doc');
const { loadPhraseList, entryRegex, stripNonProse } = require('../lib/phrase-list');
const { byId } = require('../lib/rules-registry');
const { validateVerdictObject, VALID_VERDICTS } = require('./review-candidates');
const { checkBannedPhrases } = require('../checks/banned-phrases');
const { checkEmDashSemicolon } = require('../checks/em-dash-semicolon');
const { checkAnthropomorphism } = require('../checks/anthropomorphism');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const DEFAULT_CORPUS = path.join(REPO_ROOT, 'docs');
const DEFAULT_DIR = path.join(REPO_ROOT, '.doc-review');
const DEFAULT_BATCH = 12;

/**
 * In the cache key, so changing the rubric invalidates every stored verdict
 * rather than serving answers reached under a different question. Bump it when
 * the prompt changes in a way that could change an answer.
 */
// Bumped to @2 when the prompt gained the code-span and link-target
// preservation constraint. The first live run returned rewrites that deleted an
// identifier, so every verdict reached before it is not trustworthy.
// Bumped to @4 when C3-25 joined JUDGEABLE. The rule text travels in the
// prompt, so a cache keyed on @3 would serve answers reached without it.
// Bumped to @5 when C3-26 joined, for the same reason.
// Bumped to @6 when C2-09 joined and the prompt gained the fixKind field.
const PROMPT_VERSION = 'tone@6';
const DISCOVER_PROMPT_VERSION = 'discover@1';

/** A 12-row batch is a bigger reply than the 120 s default comfortably allows. */
const BATCH_TIMEOUT_MS = 240000;

/** Roughly the point past which a batch reply starts getting truncated. */
const MAX_BATCH_CHARS = 6000;

const DATA_DIRS = {
  'C3-21': path.join(__dirname, '..', 'data', 'house-verbs'),
  'C3-18': path.join(__dirname, '..', 'data', 'anthropomorphism'),
  // C5-06, C3-22, C3-26, C7-06 and C7-02 have no wordlist. Their candidates come from
  // a structural signal in tier3-candidates.js, so rowsFromCandidates finds no
  // entries for them and reports the matched verbs as unavailable, which is
  // correct: there is no phrase list to name.
};

/** Rules this script can judge. A rule absent from DATA_DIRS is judged on its evidence alone. */
const JUDGEABLE = ['C2-09', 'C3-18', 'C3-21', 'C3-22', 'C3-25', 'C3-26', 'C5-06', 'C7-06'];

/**
 * Rules whose unit of judgment is a passage rather than one sentence.
 *
 * C2-09 is about the relationship between consecutive paragraphs, so a judge
 * shown only the first opener has been shown the one thing the rule cannot be
 * decided from. Its rows carry every line of evidence instead.
 */
const PASSAGE_RULES = new Set(['C2-09']);

/**
 * Rules whose "fix" is an instruction, not a rewritten sentence.
 *
 * The rewrite guards below compare a fix against the sentence it replaces: the
 * length must stay within a ratio, and every code span and link target must
 * survive. Both are right for a rewrite and wrong for an instruction such as
 * "give each paragraph a bolded lead-in", which replaces nothing and quotes
 * nothing. C7-06 arguably belongs here too, and is left out only because
 * changing how an existing rule validates is a separate decision.
 */
const INSTRUCTION_FIX_RULES = new Set(['C2-09']);

/** The repairs a passage rule can call for. "none" pairs with a clean verdict. */
const VALID_FIX_KINDS = new Set(['lead-ins', 'connective', 'none']);

// --- Sentence normalization and the cache key --------------------------------

/**
 * Reduces a sentence to what actually decides its tone.
 *
 * Keyed on content rather than on `file:line` because a paragraph reflow changes
 * every candidateId, which embeds a line number, while changing no sentence. A
 * content key survives reflow and re-bills nothing. Editing one word in one
 * sentence invalidates exactly that sentence, which is what we want.
 */
function normalizeSentence(text) {
  return stripNonProse(String(text || ''))
    .replace(/\[([^\]]*)\]\(\)?/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/\*\*|[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cacheKey(sentence, ruleId, promptVersion = PROMPT_VERSION) {
  return crypto
    .createHash('sha256')
    .update(`${normalizeSentence(sentence)}|${ruleId}|${promptVersion}`)
    .digest('hex')
    .slice(0, 16);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function loadCache(cachePath) {
  const doc = readJson(cachePath, null);
  if (!doc || doc.promptVersion !== PROMPT_VERSION) {
    return { version: 1, promptVersion: PROMPT_VERSION, entries: {} };
  }
  return { version: 1, promptVersion: PROMPT_VERSION, entries: doc.entries || {} };
}

function writeJson(filePath, doc) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`);
}

// --- Batching ----------------------------------------------------------------

/**
 * Splits rows into batches bounded by both a row count and a character budget.
 *
 * The character bound matters more than the row bound: twelve short table-ish
 * sentences and twelve 300-character paragraphs are very different replies, and
 * only the second gets truncated.
 */
function batchRows(rows, size = DEFAULT_BATCH, maxChars = MAX_BATCH_CHARS) {
  const batches = [];
  let current = [];
  let chars = 0;
  for (const row of rows) {
    const cost = String(row.sentence || '').length + 80;
    if (current.length > 0 && (current.length >= size || chars + cost > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(row);
    chars += cost;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

// --- The prompt --------------------------------------------------------------

function buildBatchPrompt(batch, rule, priorViolation) {
  const passage = PASSAGE_RULES.has(rule.id);
  const unit = passage ? 'passage' : 'sentence';

  const lines = [
    'You are judging candidate tone findings in a technical documentation set.',
    `A script selected each ${unit} by pattern match. You decide which are real violations.`,
    '',
    `Rule (${rule.id}): ${rule.rule}`,
    `Why the rule exists: ${rule.why}`,
    `Exception to the rule: ${rule.exception}`,
    '',
    `Judge each numbered ${unit} independently.`,
    '',
  ];

  if (passage) {
    lines.push(
      'Each numbered item is one section. The lines under it are the opening sentence of',
      'every body paragraph in that section, in document order, prefixed with its line number.',
      'Read them as a run and ask what the reader has to reconstruct to get from one to the next.',
      ''
    );
  }

  batch.forEach((row, i) => {
    lines.push(`${i + 1}. ${passage && row.section ? `Section: ${row.section}` : row.sentence}`);
    if (passage) lines.push(`   ${row.sentence}`);
    else lines.push(`   matched: ${row.verbs.join(', ')}`);
    if (row.suggestedFix) lines.push(`   the wordlist suggests: ${row.suggestedFix}`);
    else if (row.signal) lines.push(`   why the script selected it: ${row.signal}`);
    lines.push('');
  });

  if (passage) {
    lines.push(
      'This rule has two valid repairs, so decide which one applies before you decide the verdict.',
      'Report it in "fixKind":',
      '  "lead-ins"   the paragraphs cover separate sub-topics that a reader arrives at one at a',
      '               time. Each needs a bolded lead-in label naming the fact it carries.',
      '  "connective" the paragraphs build one argument. Each needs to open with the subordinating',
      '               connective that carries the logic, for example Because, When, Only, Since.',
      '               Labels here would freeze the break in the wrong place.',
      '  "none"       the section is already correct, for a COMPLIANT or EXCEPTION_APPLIES verdict.',
      '',
      'For this rule "fix" is an instruction, not a rewritten sentence. Name the line numbers and',
      'say what to do, for example "L91 and L102 are one comparison, open L102 with Because. L104',
      'is a different topic, move it to Add them to a profile".',
      ''
    );
  }

  lines.push(
    `Reply with ONLY one JSON array of exactly ${batch.length} objects, no prose around it, no markdown fence:`,
    passage
      ? '[{"n": 1, "verdict": "...", "fixKind": "...", "reason": "...", "fix": "...", "exceptionQuoted": "..."}, ...]'
      : '[{"n": 1, "verdict": "...", "reason": "...", "fix": "...", "exceptionQuoted": "..."}, ...]',
    '',
    `"n" is the ${unit} number. Every number from 1 to ${batch.length} must appear exactly once.`,
    `"verdict" is one of ${[...VALID_VERDICTS].join(', ')}.`,
    '"reason" is one sentence saying what in the sentence decided it.',
    '"fix" is required when the verdict is VIOLATION. Normally it is the rewritten sentence.',
    'For a duplication rule it is not a rewrite: say which occurrence stays canonical and what',
    'replaces the others, for example "keep L227, replace L238 with a link to it". For a rule about',
    'a missing destination, give the destination.',
    'A fix identical to the original sentence is not a fix and will be rejected.',
    '"exceptionQuoted" is required when the verdict is EXCEPTION_APPLIES, and must be a verbatim substring of the exception text above. Omit it otherwise.',
    '',
    'Hard constraints on any "fix" you write, this doc set enforces them separately:',
    '- No em dash, en dash, or semicolon. Use a period, a comma, parentheses, or a new sentence.',
    '- Do not introduce a casual, marketing, or hedging phrase.',
    '- Do not attribute intent, knowledge, or speech to a system component.',
    '- Reproduce every backtick-quoted identifier and every markdown link, target included,',
    '  character for character. Rewrite only the words the rule is about.',
    '',
    `Answer UNCLEAR only when the ${unit} genuinely cannot settle the question, not to avoid deciding.`
  );

  if (priorViolation) {
    lines.push('', `Your previous reply was rejected: ${priorViolation}`, 'Fix that specifically this time.');
  }
  return lines.join('\n');
}

// --- Validation --------------------------------------------------------------

/**
 * Any dash, banned phrase, or anthropomorphism violation in a proposed rewrite.
 *
 * Uses the one-line pseudo-doc that fix/fix-banned-phrases.js already runs its
 * rewrites through. A fix that trades one violation for another is not a fix.
 */
function findFixViolation(fixText, originalSentence) {
  const probeDoc = { bodyStartLine: 1, totalLines: 1, lines: [fixText], inFenceMask: { 1: false } };
  if (checkEmDashSemicolon(probeDoc).length > 0) {
    return 'a "fix" contains an em dash, en dash, or semicolon';
  }
  const banned = checkBannedPhrases(probeDoc);
  if (banned.length > 0) return `a "fix" contains a banned phrase (${banned[0].message})`;
  const anthro = checkAnthropomorphism(probeDoc);
  if (anthro.length > 0) return `a "fix" contains an anthropomorphic phrase (${anthro[0].message})`;

  if (fixText.trim() === String(originalSentence || '').trim()) {
    return 'a "fix" identical to the original sentence is not a fix';
  }

  const ratio = fixText.length / Math.max(String(originalSentence || '').length, 1);
  if (ratio < 0.5 || ratio > 1.6) {
    return 'a "fix" was far shorter or longer than the sentence it replaces, so it probably dropped or padded content';
  }
  return null;
}

/**
 * Every inline code span and markdown link target the original carried must
 * survive verbatim into the rewrite.
 *
 * This is not a style preference. The first live run produced fixes that
 * deleted `mcp-remote` from one sentence and emptied a markdown link in
 * another, because the model was handed text with those spans already masked.
 * The generator now hands over the raw sentence, and this is the guard that
 * catches the model dropping one anyway.
 *
 * Applied only to a rewrite, never to a discovery proposal's "fix", which is
 * prose advice about what to write rather than the replacement text.
 */
function findPreservationViolation(fixText, original) {
  const spans = String(original || '').match(/`[^`]+`/g) || [];
  for (const span of spans) {
    if (!fixText.includes(span)) return `a "fix" dropped the inline code span ${span}`;
  }
  const targets = String(original || '').match(/\]\(([^)]*)\)/g) || [];
  for (const target of targets) {
    if (!fixText.includes(target)) return `a "fix" changed or dropped the markdown link target ${target}`;
  }
  return null;
}

/**
 * Rejects a batch reply that could not survive reconcile, in the order that
 * gives the retry the most specific message.
 *
 * Step 3 is the one that makes batching safe at all: a model that skips row 7 is
 * caught by arithmetic rather than landing a silently short verdict list. Step 4
 * exists because a count alone would let a duplicated "n" through.
 */
function validateBatchReply(reply, batch, rule) {
  let parsed;
  try {
    parsed = JSON.parse(reply);
  } catch (err) {
    return 'the reply must be one JSON array and nothing else';
  }
  if (!Array.isArray(parsed)) {
    return 'the reply must be a JSON array, one object per numbered sentence';
  }
  if (parsed.length !== batch.length) {
    return `expected exactly ${batch.length} objects, one per numbered sentence, got ${parsed.length}`;
  }

  const seen = new Set();
  for (const row of parsed) {
    const n = row && row.n;
    if (!Number.isInteger(n) || n < 1 || n > batch.length) {
      return `every object needs an integer "n" between 1 and ${batch.length}`;
    }
    if (seen.has(n)) return `sentence number ${n} appears more than once`;
    seen.add(n);
  }
  if (seen.size !== batch.length) {
    return `every sentence number from 1 to ${batch.length} must appear exactly once`;
  }

  const instructionFix = INSTRUCTION_FIX_RULES.has(rule.id);
  const passage = PASSAGE_RULES.has(rule.id);
  const unit = passage ? 'passage' : 'sentence';

  for (const row of parsed) {
    const violation = validateVerdictObject(row, { exception: rule.exception });
    if (violation) return `${unit} ${row.n}: ${violation}`;

    if (passage && !VALID_FIX_KINDS.has(row.fixKind)) {
      return `${unit} ${row.n}: "fixKind" must be one of ${[...VALID_FIX_KINDS].join(', ')}`;
    }
    if (passage && row.verdict === 'VIOLATION' && row.fixKind === 'none') {
      return `${unit} ${row.n}: a VIOLATION must name which repair applies, so "fixKind" cannot be none`;
    }

    // An instruction replaces nothing and quotes nothing, so the rewrite guards
    // would reject every correct answer. The dash and phrase guards still apply,
    // because an instruction is prose this doc set publishes in a verdict.
    if (row.fix && !instructionFix) {
      const original = batch[row.n - 1].sentence;
      const fixViolation =
        findFixViolation(String(row.fix), original) || findPreservationViolation(String(row.fix), original);
      if (fixViolation) return `${unit} ${row.n}: ${fixViolation}`;
    }
    if (row.fix && instructionFix) {
      const probeDoc = { bodyStartLine: 1, totalLines: 1, lines: [String(row.fix)], inFenceMask: { 1: false } };
      if (checkEmDashSemicolon(probeDoc).length > 0) {
        return `${unit} ${row.n}: a "fix" contains an em dash, en dash, or semicolon`;
      }
    }
  }
  return null;
}

// --- Candidate rows ----------------------------------------------------------

/**
 * Turns the tier-3 candidates for one rule into judge rows.
 *
 * Reads candidates.json rather than re-deriving them, so the judge and the
 * reconcile gate are looking at exactly the same list. A row carries the
 * candidateId so a verdict can be written back against it, and the sentence so
 * the cache can key on content.
 */
function rowsFromCandidates(candidatesDoc, ruleId) {
  const entries = DATA_DIRS[ruleId] ? loadPhraseList(DATA_DIRS[ruleId]) : [];
  const rows = [];

  for (const candidate of candidatesDoc.candidates || []) {
    if (candidate.ruleId !== ruleId) continue;
    const evidence = candidate.evidence || [];
    const sentence = PASSAGE_RULES.has(ruleId) ? evidence.join('\n   ') : evidence[0];
    if (!sentence) continue;

    const verbs = [];
    const fixes = [];
    for (const entry of entries) {
      let re;
      try {
        re = entryRegex(entry);
      } catch (err) {
        continue;
      }
      if (re.test(sentence)) {
        verbs.push(entry.label || entry.phrase);
        fixes.push(entry.fix);
      }
    }

    rows.push({
      candidateId: candidate.candidateId,
      ruleId,
      file: candidate.file,
      line: candidate.line,
      section: candidate.section || null,
      sentence,
      verbs: verbs.length > 0 ? verbs : [DATA_DIRS[ruleId] ? '(pattern no longer matches)' : '(structural signal, no wordlist)'],
      suggestedFix: fixes[0] || null,
      signal: candidate.signal || null,
      key: cacheKey(sentence, ruleId),
    });
  }
  return rows;
}

// --- The judge ---------------------------------------------------------------

/**
 * Judges rows in batches, serving anything already cached without a call.
 *
 * A batch that exhausts its retries is not dropped. It is re-run as singletons
 * once, and whatever still fails is left unjudged, where review-candidates.js
 * --reconcile reports it and exits 1. That is what preserves the guarantee the
 * one-call-per-candidate design was protecting.
 */
function judgeRows(rows, rule, { batch = DEFAULT_BATCH, maxCalls = Infinity, cache, refresh = false, onProgress = () => {} } = {}) {
  const results = [];
  const skipped = [];
  let calls = 0;
  let served = 0;

  const pending = [];
  for (const row of rows) {
    const hit = !refresh && cache.entries[row.key];
    if (hit) {
      served += 1;
      results.push({ ...row, ...hit, fromCache: true });
    } else {
      pending.push(row);
    }
  }

  for (const group of batchRows(pending, batch)) {
    if (calls >= maxCalls) {
      for (const row of group) skipped.push(row.candidateId);
      continue;
    }
    onProgress({ size: group.length, calls: calls + 1 });
    calls += 1;

    let reply = askClaude({
      timeoutMs: BATCH_TIMEOUT_MS,
      buildPrompt: (priorViolation) => buildBatchPrompt(group, rule, priorViolation),
      validate: (text) => validateBatchReply(text, group, rule),
    });

    // The singleton retry. A single bad row poisons a whole batch reply, so ask
    // one at a time before giving up on eleven answerable questions.
    if (!reply && group.length > 1) {
      for (const row of group) {
        if (calls >= maxCalls) {
          skipped.push(row.candidateId);
          continue;
        }
        calls += 1;
        const single = askClaude({
          timeoutMs: BATCH_TIMEOUT_MS,
          buildPrompt: (priorViolation) => buildBatchPrompt([row], rule, priorViolation),
          validate: (text) => validateBatchReply(text, [row], rule),
        });
        if (!single) {
          skipped.push(row.candidateId);
          continue;
        }
        recordVerdicts(JSON.parse(single), [row], cache, results);
      }
      continue;
    }

    if (!reply) {
      for (const row of group) skipped.push(row.candidateId);
      continue;
    }
    recordVerdicts(JSON.parse(reply), group, cache, results);
  }

  return { results, skipped, calls, served };
}

function recordVerdicts(parsed, group, cache, results) {
  for (const answer of parsed) {
    const row = group[answer.n - 1];
    const record = {
      sentence: row.sentence,
      ruleId: row.ruleId || null,
      matched: row.verbs,
      verdict: answer.verdict,
      reason: String(answer.reason).trim(),
      ...(answer.fixKind ? { fixKind: String(answer.fixKind) } : {}),
      ...(answer.fix ? { fix: String(answer.fix).trim() } : {}),
      ...(answer.exceptionQuoted ? { exceptionQuoted: String(answer.exceptionQuoted) } : {}),
      judgedAt: new Date().toISOString(),
    };
    cache.entries[row.key] = record;
    results.push({ ...row, ...record, fromCache: false });
  }
}

/** Verdict rows in the shape review-candidates.js --reconcile already reads. */
function toVerdictRows(results) {
  return results.map((r) => ({
    candidateId: r.candidateId,
    verdict: r.verdict,
    reason: r.reason,
    ...(r.fixKind ? { fixKind: r.fixKind } : {}),
    ...(r.fix ? { fix: r.fix } : {}),
    ...(r.exceptionQuoted ? { exceptionQuoted: r.exceptionQuoted } : {}),
  }));
}

// --- Discovery ---------------------------------------------------------------

/**
 * Sentences no current rule can see.
 *
 * The input to discovery is the negative space, not the corpus: subtract every
 * sentence a check already reports, and every sentence any wordlist entry
 * already matches. What is left is where a new rule could exist. Without this
 * subtraction the model spends every batch rediscovering `advertises`.
 */
function unseenSentences(filePath) {
  const doc = DocModel.fromFile(filePath);
  const report = lintFile(filePath, { label: filePath });
  const reported = new Set(
    [...report.automatedFindings, ...report.flagged].map((f) => f.line).filter(Boolean)
  );

  const allEntries = [];
  for (const dir of [
    path.join(__dirname, '..', 'data', 'anthropomorphism'),
    path.join(__dirname, '..', 'data', 'house-verbs'),
    path.join(__dirname, '..', 'data', 'banned-phrases'),
    path.join(__dirname, '..', 'data', 'metaphors'),
  ]) {
    try {
      allEntries.push(...loadPhraseList(dir));
    } catch (err) {
      // A data directory that does not exist yet is not an error here.
    }
  }

  const out = [];
  for (let line = doc.bodyStartLine; line <= doc.totalLines; line++) {
    if (doc.inFenceMask[line] || reported.has(line)) continue;
    const trimmed = String(doc.lines[line - 1]).trim();
    if (!trimmed || trimmed.startsWith('|') || trimmed.startsWith('>') || /^#{1,6}\s/.test(trimmed)) continue;

    const stripped = stripNonProse(trimmed);
    const covered = allEntries.some((entry) => {
      try {
        return entryRegex(entry).test(stripped);
      } catch (err) {
        return false;
      }
    });
    if (covered) continue;
    if (stripped.split(/\s+/).length < 6) continue;
    out.push({ file: filePath, line, sentence: stripped });
  }
  return out;
}

function buildDiscoverPrompt(batch, knownLabels, priorViolation) {
  const lines = [
    'You are hunting casual, vague, or anthropomorphic wording in a technical documentation set.',
    'Every sentence below is already known to be clean by every automated rule the doc set has.',
    'Your job is to find wording that no rule covers yet.',
    '',
    'Target the following, applied to a system component rather than to the reader:',
    '- verbs attributing intent, knowledge, perception, or speech',
    '- general-purpose verbs standing in for an exact mechanism verb',
    '- casual or conversational register unsuited to reference documentation',
    '',
    'Legitimate and NOT targets: protocol and network vocabulary (a server exposes tools, a client',
    'discovers them, an OAuth handshake, a token that lacks a scope, a chain that falls back), an LLM',
    'that reads or interprets a schema, and any verb whose subject is the reader ("you").',
    '',
    'Already covered, do not propose these again:',
    `  ${knownLabels.join(', ')}`,
    '',
  ];

  batch.forEach((row, i) => {
    lines.push(`${i + 1}. ${row.sentence}`);
  });

  lines.push(
    '',
    'Reply with ONLY one JSON array, no prose around it, no markdown fence. An EMPTY ARRAY is a valid',
    'and expected answer when nothing in the batch qualifies. Do not invent findings to fill it.',
    '',
    '[{"sentence_n": 1, "quote": "...", "class": "ANTHROPOMORPHIC", "proposedPattern": "...", "label": "...", "fix": "...", "rationale": "..."}]',
    '',
    '"quote" must be a VERBATIM substring of the numbered sentence you took it from.',
    '"class" is ANTHROPOMORPHIC or CASUAL.',
    '"proposedPattern" is a JavaScript regular expression source string, matched case insensitively,',
    'that matches your quote and would match the same wording elsewhere. Prefer a word-bounded verb',
    'family, for example "\\\\bannounc(e|es|ed|ing)\\\\b".',
    '"label" is a short name for the wording. "fix" says what to write instead.',
    '"rationale" is one sentence on why the current wording leaves the mechanism unstated.'
  );

  if (priorViolation) {
    lines.push('', `Your previous reply was rejected: ${priorViolation}`, 'Fix that specifically this time.');
  }
  return lines.join('\n');
}

/**
 * Rejects a proposal that cannot be promoted.
 *
 * The verbatim-quote rule is the anti-hallucination device, borrowed from the
 * exceptionQuoted check: a model cannot report wording the corpus does not
 * contain. The self-match rule catches a pattern that does not match its own
 * example, which is the common way a hand-drafted regex is wrong.
 */
function validateDiscoverReply(reply, batch, knownEntries) {
  let parsed;
  try {
    parsed = JSON.parse(reply);
  } catch (err) {
    return 'the reply must be one JSON array and nothing else';
  }
  if (!Array.isArray(parsed)) return 'the reply must be a JSON array, empty if nothing qualifies';

  for (const p of parsed) {
    const n = p && p.sentence_n;
    if (!Number.isInteger(n) || n < 1 || n > batch.length) {
      return `every proposal needs an integer "sentence_n" between 1 and ${batch.length}`;
    }
    if (!p.quote || !batch[n - 1].sentence.includes(p.quote)) {
      return `the "quote" for sentence ${n} must be a verbatim substring of that sentence`;
    }
    if (!p.proposedPattern) return `the proposal for sentence ${n} needs a "proposedPattern"`;
    if (!p.label || !p.fix) return `the proposal for sentence ${n} needs a "label" and a "fix"`;

    let re;
    try {
      re = entryRegex({ pattern: p.proposedPattern });
    } catch (err) {
      return `the "proposedPattern" for sentence ${n} is not a valid regular expression: ${err.message}`;
    }
    if (!re.test(p.quote)) {
      return `the "proposedPattern" for sentence ${n} does not match its own "quote"`;
    }
    const already = knownEntries.find((entry) => {
      try {
        return entryRegex(entry).test(p.quote);
      } catch (err) {
        return false;
      }
    });
    if (already) {
      return `"${p.quote}" is already covered by the existing entry "${already.label || already.phrase}", propose something else`;
    }
    const fixViolation = findFixViolation(String(p.fix), p.fix);
    if (fixViolation) return `sentence ${n}: ${fixViolation}`;
  }
  return null;
}

function proposalId(pattern, label) {
  return crypto.createHash('sha256').update(`${pattern}|${label}|${DISCOVER_PROMPT_VERSION}`).digest('hex').slice(0, 8);
}

// --- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    targets: [],
    rules: JUDGEABLE,
    batch: DEFAULT_BATCH,
    maxCalls: Infinity,
    emitVerdicts: false,
    refresh: false,
    discover: false,
    probe: false,
    format: 'text',
    candidates: path.join(DEFAULT_DIR, 'candidates.json'),
    verdicts: path.join(DEFAULT_DIR, 'verdicts.json'),
    cache: path.join(DEFAULT_DIR, 'tone-cache.json'),
    proposals: path.join(DEFAULT_DIR, 'tone-proposals.json'),
  };
  for (const arg of argv) {
    if (arg.startsWith('--rules=')) args.rules = arg.slice('--rules='.length).split(',').map((s) => s.trim());
    else if (arg.startsWith('--batch=')) args.batch = parseInt(arg.slice('--batch='.length), 10);
    else if (arg.startsWith('--max-calls=')) args.maxCalls = parseInt(arg.slice('--max-calls='.length), 10);
    else if (arg.startsWith('--cache=')) args.cache = arg.slice('--cache='.length);
    else if (arg.startsWith('--candidates=')) args.candidates = arg.slice('--candidates='.length);
    else if (arg.startsWith('--verdicts=')) args.verdicts = arg.slice('--verdicts='.length);
    else if (arg.startsWith('--proposals=')) args.proposals = arg.slice('--proposals='.length);
    else if (arg.startsWith('--format=')) args.format = arg.slice('--format='.length);
    else if (arg === '--emit-verdicts') args.emitVerdicts = true;
    else if (arg === '--refresh') args.refresh = true;
    else if (arg === '--discover') args.discover = true;
    else if (arg === '--probe') args.probe = true;
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  if (args.targets.length === 0) args.targets = [DEFAULT_CORPUS];
  return args;
}

function runJudge(args) {
  const candidatesDoc = readJson(args.candidates, null);
  if (!candidatesDoc) {
    console.error(`No candidates at ${args.candidates}. Run: node review-candidates.js ${args.targets.join(' ')}`);
    process.exitCode = 2;
    return;
  }

  const cache = loadCache(args.cache);
  const allResults = [];
  const allSkipped = [];
  let totalCalls = 0;
  let totalServed = 0;

  for (const ruleId of args.rules) {
    const rule = byId(ruleId);
    if (!rule) {
      console.error(`Unknown rule ${ruleId}`);
      process.exitCode = 2;
      return;
    }
    const rows = rowsFromCandidates(candidatesDoc, ruleId).map((r) => ({ ...r, ruleId }));
    if (rows.length === 0) {
      console.log(`${ruleId}: no candidates.`);
      continue;
    }
    console.log(`${ruleId}: ${rows.length} candidate sentence(s).`);

    const { results, skipped, calls, served } = judgeRows(rows, rule, {
      batch: args.batch,
      maxCalls: args.maxCalls - totalCalls,
      cache,
      refresh: args.refresh,
      onProgress: ({ size, calls: n }) => console.log(`  call ${n}: judging ${size} sentence(s)`),
    });
    allResults.push(...results);
    allSkipped.push(...skipped);
    totalCalls += calls;
    totalServed += served;
  }

  writeJson(args.cache, cache);

  const byVerdict = {};
  for (const r of allResults) byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;

  if (args.format === 'json') {
    console.log(JSON.stringify({ results: allResults, skipped: allSkipped, calls: totalCalls, served: totalServed }, null, 2));
  } else {
    console.log('');
    console.log(`Judged ${allResults.length}, ${totalServed} from cache, ${totalCalls} claude call(s), ${allSkipped.length} skipped.`);
    for (const [verdict, count] of Object.entries(byVerdict)) console.log(`  ${verdict}  x${count}`);
    console.log('');
    for (const r of allResults.filter((x) => x.verdict === 'VIOLATION')) {
      console.log(`${r.file.replace(/^.*docs\//, '')}:${r.line}`);
      console.log(`  - ${r.sentence}`);
      console.log(`  + ${r.fix}`);
      console.log(`  ${r.reason}`);
      console.log('');
    }
  }

  if (args.emitVerdicts) {
    const existing = readJson(args.verdicts, null);
    const fresh = {
      judgedAt: new Date().toISOString(),
      candidatesFile: path.relative(REPO_ROOT, args.candidates),
      judge: 'judge-tone.js@1',
      verdicts: toVerdictRows(allResults),
      skipped: allSkipped,
    };
    const merged =
      existing && Array.isArray(existing.verdicts)
        ? (() => {
            const map = new Map(existing.verdicts.map((v) => [v.candidateId, v]));
            for (const v of fresh.verdicts) map.set(v.candidateId, v);
            return { ...fresh, verdicts: [...map.values()] };
          })()
        : fresh;
    writeJson(args.verdicts, merged);
    console.log(`Wrote ${merged.verdicts.length} verdict(s) to ${args.verdicts}.`);
    console.log('Next: node review-candidates.js --reconcile');
  } else {
    console.log('Dry run. Pass --emit-verdicts to write verdicts.json.');
  }
}

function runDiscover(args) {
  const knownEntries = [];
  for (const dir of [
    path.join(__dirname, '..', 'data', 'anthropomorphism'),
    path.join(__dirname, '..', 'data', 'house-verbs'),
    path.join(__dirname, '..', 'data', 'banned-phrases'),
    path.join(__dirname, '..', 'data', 'metaphors'),
  ]) {
    try {
      knownEntries.push(...loadPhraseList(dir));
    } catch (err) {
      // Optional directory.
    }
  }
  const knownLabels = [...new Set(knownEntries.map((e) => e.label || e.phrase))];

  const rows = [];
  for (const target of args.targets) {
    for (const file of collectDocs(target)) rows.push(...unseenSentences(file));
  }
  console.log(`${rows.length} sentence(s) no current rule can see.`);

  const proposals = [];
  let calls = 0;
  for (const group of batchRows(rows, args.batch)) {
    if (calls >= args.maxCalls) break;
    calls += 1;
    console.log(`  call ${calls}: scanning ${group.length} sentence(s)`);
    const reply = askClaude({
      timeoutMs: BATCH_TIMEOUT_MS,
      buildPrompt: (priorViolation) => buildDiscoverPrompt(group, knownLabels, priorViolation),
      validate: (text) => validateDiscoverReply(text, group, knownEntries),
    });
    if (!reply) continue;
    for (const p of JSON.parse(reply)) {
      const row = group[p.sentence_n - 1];
      proposals.push({
        proposalId: proposalId(p.proposedPattern, p.label),
        class: p.class,
        ruleIdTarget: p.class === 'ANTHROPOMORPHIC' ? 'C3-18' : 'C3-01',
        entry: { pattern: p.proposedPattern, label: p.label, fix: p.fix },
        quotes: [p.quote],
        sources: [`${path.basename(row.file)}:${row.line}`],
        rationale: p.rationale,
        probe: null,
        promoted: false,
      });
    }
  }

  // Merge duplicates: the same verb proposed from three sentences is one entry
  // with three sources, which is also the ranking signal for what to promote.
  const merged = new Map();
  for (const p of proposals) {
    if (!merged.has(p.proposalId)) merged.set(p.proposalId, p);
    else {
      const existing = merged.get(p.proposalId);
      existing.quotes.push(...p.quotes);
      existing.sources.push(...p.sources);
    }
  }
  const out = [...merged.values()].sort((a, b) => b.sources.length - a.sources.length);

  if (args.probe) {
    // probe() takes one corpus path, not a list, so run it per target and merge.
    const { probe } = require('../tools/probe-corpus');
    for (const p of out) {
      const hits = [];
      let unreportedCount = 0;
      let triage = null;
      for (const target of args.targets) {
        const result = probe([p.entry], p.entry.label, { corpus: target });
        hits.push(...result.hits);
        unreportedCount += result.unreportedCount;
        triage = triage || (result.triage || {}).classification || null;
      }
      const hitKeys = hits.map((h) => `${path.basename(h.file)}:${h.line}`);
      p.probe = {
        hitCount: hits.length,
        unreportedCount,
        triage,
        supersetOfQuotes: p.sources.every((s) => hitKeys.includes(s)),
        extraHits: hitKeys.filter((k) => !p.sources.includes(k)),
      };
    }
  }

  writeJson(args.proposals, {
    generatedAt: new Date().toISOString(),
    promptVersion: DISCOVER_PROMPT_VERSION,
    corpus: args.targets,
    sentencesScanned: rows.length,
    calls,
    proposals: out,
  });

  console.log('');
  console.log(`${out.length} proposal(s) after merging, from ${calls} claude call(s).`);
  for (const p of out) {
    console.log(`  ${p.entry.label}  x${p.sources.length}  ${p.entry.pattern}`);
    console.log(`    fix: ${p.entry.fix}`);
    if (p.probe) {
      console.log(
        `    probe: ${p.probe.hitCount} hits, ${p.probe.unreportedCount} unreported, ${p.probe.triage}, superset ${p.probe.supersetOfQuotes}`
      );
    }
  }
  console.log('');
  console.log(`Wrote ${args.proposals}.`);
  console.log('Nothing is promoted. For each proposal you want, run the convergence test:');
  console.log("  node probe-corpus.js --pattern='<pattern>' --label='<label>' --corpus=../../docs");
  console.log('Promote only when the probe hits are a superset of the quotes and it triages as WORDLIST_GAP.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.discover) runDiscover(args);
  else runJudge(args);
}

if (require.main === module) main();

module.exports = {
  normalizeSentence,
  cacheKey,
  batchRows,
  buildBatchPrompt,
  validateBatchReply,
  validateDiscoverReply,
  findFixViolation,
  findPreservationViolation,
  rowsFromCandidates,
  unseenSentences,
  toVerdictRows,
  judgeRows,
  PROMPT_VERSION,
};
