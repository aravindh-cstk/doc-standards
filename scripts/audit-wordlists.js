#!/usr/bin/env node
'use strict';

/**
 * Finds under-inflected literal wordlist entries and proposes widenings, using
 * `claude -p` to judge which generated siblings the rule actually covers.
 *
 * The failure it attacks: `entryRegex` compiles a literal `phrase` into
 * `\b<escaped>\b`, a regex exactly as wide as the string, so every literal
 * entry claims its rule has one correct surface form. That claim has now been
 * false three times in a row, each time found by a human reading prose the
 * linter passed clean. `reach for` without `reach out`. `raise the value`
 * without `raise a support request`. Six bare verb stems in unlock-language.
 *
 * The division of labour, and it is the whole design:
 *
 *   lib/inflect.js       generates candidate siblings mechanically
 *   claude -p            decides which are violations of the SAME rule
 *   lib/inflect.js       compiles the accepted set into ONE regex
 *   probe-corpus.js      reports what the widening newly hits
 *   a human              promotes
 *
 * The model never writes a regex. It picks from a closed candidate set by
 * letter, which is the anti-hallucination device: a model cannot propose a
 * sibling the generator did not produce. That is why compileWidening lives in
 * Node rather than in the prompt.
 *
 * Nothing is promoted automatically, and no check ever reads the proposal file.
 * That one-direction asymmetry is the same discipline as candidates.json
 * against verdicts.json.
 *
 * Usage:
 *   node audit-wordlists.js [--file=data/x/y.json] [--batch=8] [--max-calls=N]
 *                           [--probe] [--refresh] [--format=text|json]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { askClaude } = require('./lib/claude-runner');
const { loadEntryFile, entryRegex } = require('./lib/phrase-list');
const { siblingsOf, uncoveredSiblings, compileWidening } = require('./lib/inflect');
const { byId } = require('./lib/rules-registry');
const { probe } = require('./probe-corpus');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DATA_ROOT = path.join(__dirname, 'data');
const DEFAULT_DIR = path.join(REPO_ROOT, '.doc-review');
const DEFAULT_CORPUS = path.join(REPO_ROOT, 'docs');

/** In the cache key, so changing the rubric re-bills rather than serving stale answers. */
const PROMPT_VERSION = 'widen@1';

const DEFAULT_BATCH = 8;
const BATCH_TIMEOUT_MS = 240000;
const MAX_BATCH_CHARS = 6000;

/**
 * A widening that fires more than this many NEW times on a corpus believed
 * clean needs a human read before promotion.
 *
 * doc-gap.md's closing rule, restated: a new tier-1 rule firing 40 times on a
 * clean corpus means the tier is wrong, not the corpus. A widening is the same
 * bet with less warning, because it inherits a tier that was justified by a
 * narrower matcher.
 */
const NEW_HIT_ALARM = 5;

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// --- Collecting the work -----------------------------------------------------

function walk(dir) {
  return fs.readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) return walk(full);
    return name.endsWith('.json') ? [full] : [];
  });
}

/**
 * Every literal entry with at least one sibling no entry sharing its rule
 * already matches.
 *
 * `uncoveredSiblings` is the pre-filter that keeps this affordable. casual.json
 * has 8 literals but 24 patterns, and those patterns already absorb most of its
 * candidate space, so the file is cheap to audit despite its size.
 */
function collectWork({ fileFilter = null } = {}) {
  const work = [];
  for (const file of walk(DATA_ROOT)) {
    const rel = path.relative(__dirname, file);
    if (fileFilter && !rel.includes(fileFilter)) continue;

    let entries;
    try {
      entries = loadEntryFile(file);
    } catch (err) {
      continue;
    }
    entries.forEach((entry, entryIndex) => {
      if (!entry.phrase || entry.literal) return;
      const candidates = uncoveredSiblings(entry, siblingsOf(entry.phrase), entries);
      if (candidates.length === 0) return;
      work.push({
        dataFile: rel,
        entryIndex,
        ruleId: entry.ruleId,
        phrase: entry.phrase,
        fix: entry.fix,
        candidates: candidates.slice(0, LETTERS.length),
      });
    });
  }
  return work;
}

// --- Cache -------------------------------------------------------------------

/**
 * Keyed on the entry AND the exact candidate set it was asked about, so adding
 * a sibling class in lib/inflect.js re-bills that entry and only that entry.
 * Keying on the phrase alone would serve a verdict reached without the
 * candidate the new class produced.
 */
function entryCacheKey(item) {
  const material = [
    item.ruleId,
    item.phrase,
    item.fix || '',
    item.candidates.map((c) => `${c.class}:${c.form}`).sort().join(','),
    PROMPT_VERSION,
  ].join('|');
  return crypto.createHash('sha256').update(material).digest('hex').slice(0, 16);
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

function batchWork(items, size = DEFAULT_BATCH, maxChars = MAX_BATCH_CHARS) {
  const batches = [];
  let current = [];
  let chars = 0;
  for (const item of items) {
    const cost = item.phrase.length + item.candidates.length * 30 + 120;
    if (current.length > 0 && (current.length >= size || chars + cost > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += cost;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

// --- The prompt --------------------------------------------------------------

function buildAuditPrompt(batch, priorViolation) {
  const rules = [...new Set(batch.map((i) => i.ruleId))];
  const lines = [
    "You are auditing a documentation linter's wordlists.",
    '',
    'Each numbered entry below is a LITERAL phrase the linter matches as a whole-word string,',
    'case insensitively, and nothing else. A script mechanically generated candidate variants of',
    'each. For EACH candidate, decide whether a sentence containing it violates THE SAME RULE,',
    'with THE SAME remedy, as the literal it came from.',
    '',
  ];

  for (const ruleId of rules) {
    const rule = byId(ruleId);
    if (!rule) continue;
    lines.push(`Rule ${ruleId}: ${rule.rule}`, `  Why: ${rule.why}`, `  Exception: ${rule.exception}`, '');
  }

  batch.forEach((item, i) => {
    lines.push(`${i + 1}. entry "${item.phrase}"   rule ${item.ruleId}`);
    lines.push(`   the existing remedy: ${item.fix}`);
    lines.push('   candidates:');
    item.candidates.forEach((c, j) => {
      lines.push(`     ${LETTERS[j]}) ${c.form}   (${c.class})`);
    });
    lines.push('');
  });

  lines.push(
    `Reply with ONLY one JSON array of exactly ${batch.length} objects, no prose, no markdown fence:`,
    '[{"n": 1, "accept": ["a","b"], "reject": [{"id":"c","why":"..."}], "note": "..."}]',
    '',
    `"n" is the entry number. Every number from 1 to ${batch.length} must appear exactly once.`,
    'Every candidate letter for an entry must appear exactly once, in "accept" or in "reject".',
    'No letter in both, none omitted, none invented.',
    '',
    'Accept a candidate ONLY when the rule text above, read literally, condemns it AND the',
    'existing remedy still reads as the right advice for it.',
    'Reject a candidate that is not an English word, that shifts the part of speech into a',
    'legitimate technical term, or that the exception covers.',
    '"why" is required on every rejection, one short clause.',
    '"note" is required when you accept nothing: one sentence on why the entry is genuinely',
    'single-form. Accepting nothing is a valid and expected answer for some entries, but it',
    'must be argued rather than assumed.'
  );

  if (priorViolation) {
    lines.push('', `Your previous reply was rejected: ${priorViolation}`, 'Fix that specifically this time.');
  }
  return lines.join('\n');
}

// --- Validation --------------------------------------------------------------

/**
 * Rejects a reply that cannot become a proposal, ordered so the retry gets the
 * most specific message.
 *
 * Step 3 is the arithmetic guard that makes batching safe at all: a model that
 * skips entry 7 is caught by counting, not by a silently short proposal list.
 * Step 5 is the strongest constraint here and has no analogue in judge-tone.js:
 * accept and reject must PARTITION the candidate letters. A per-object count
 * would miss a skipped candidate entirely.
 */
function validateAuditReply(reply, batch) {
  let parsed;
  try {
    parsed = JSON.parse(reply);
  } catch (err) {
    return 'the reply must be one JSON array and nothing else';
  }
  if (!Array.isArray(parsed)) return 'the reply must be a JSON array, one object per numbered entry';
  if (parsed.length !== batch.length) {
    return `expected exactly ${batch.length} objects, one per numbered entry, got ${parsed.length}`;
  }

  const seen = new Set();
  for (const row of parsed) {
    const n = row && row.n;
    if (!Number.isInteger(n) || n < 1 || n > batch.length) {
      return `every object needs an integer "n" between 1 and ${batch.length}`;
    }
    if (seen.has(n)) return `entry number ${n} appears more than once`;
    seen.add(n);
  }
  if (seen.size !== batch.length) {
    return `every entry number from 1 to ${batch.length} must appear exactly once`;
  }

  for (const row of parsed) {
    const item = batch[row.n - 1];
    const letters = item.candidates.map((_, j) => LETTERS[j]);
    const accept = Array.isArray(row.accept) ? row.accept : [];
    const reject = Array.isArray(row.reject) ? row.reject : [];

    for (const id of accept) {
      if (!letters.includes(id)) return `entry ${row.n}: candidate ${id} is not one of ${letters.join(', ')}`;
    }
    for (const r of reject) {
      if (!r || !letters.includes(r.id)) {
        return `entry ${row.n}: candidate ${r && r.id} is not one of ${letters.join(', ')}`;
      }
      if (!r.why || !String(r.why).trim()) return `entry ${row.n}: rejection of ${r.id} needs a "why"`;
    }

    const rejectIds = reject.map((r) => r.id);
    for (const id of accept) {
      if (rejectIds.includes(id)) return `entry ${row.n}: candidate ${id} appears in both accept and reject`;
    }
    for (const id of letters) {
      if (!accept.includes(id) && !rejectIds.includes(id)) {
        return `entry ${row.n}: candidate ${id} was neither accepted nor rejected; every candidate must be decided`;
      }
    }

    if (accept.length === 0 && !String(row.note || '').trim()) {
      return `entry ${row.n}: accepting nothing needs a "note" saying why the entry is genuinely single-form`;
    }
  }
  return null;
}

// --- Gates -------------------------------------------------------------------

/**
 * The four mechanical objections to a widening, cheapest first.
 *
 * `READY` never means "promote it". It means the four objections are answered
 * and a human should now read the new corpus hits.
 */
function runGates(item, widened, { corpus, allEntries, withProbe }) {
  const gates = {
    compiles: false,
    superset: false,
    lostFromOldPattern: [],
    newHits: [],
    newHitCount: 0,
    crossRuleOverlap: [],
    verdict: 'BLOCKED_UNCOMPILABLE',
  };

  // Gate A: it compiles.
  let re;
  try {
    re = entryRegex({ pattern: widened.pattern });
    gates.compiles = true;
  } catch (err) {
    gates.verdict = 'BLOCKED_UNCOMPILABLE';
    return gates;
  }

  // Gate B: strict superset over the strings we actually care about. This is a
  // total check on the phrase and every accepted form, unlike the corpus
  // comparison, which is only a superset over THIS corpus.
  const mustMatch = [item.phrase.toLowerCase(), ...widened.covers];
  const missed = mustMatch.filter((f) => !re.test(f));
  if (missed.length > 0) {
    gates.lostFromOldPattern = missed;
    gates.verdict = 'BLOCKED_NOT_SUPERSET';
    return gates;
  }
  gates.superset = true;

  // Gate D: no cross-rule overlap. A widened pattern matching a line another
  // rule owns makes two rules report one line, which doc-gap.md Step 2 forbids.
  // validateRegistry already blocks the code version of this mistake; this is
  // the data version, which validateRegistry cannot see.
  for (const other of allEntries) {
    if (other.ruleId === item.ruleId) continue;
    let otherRe;
    try {
      otherRe = entryRegex(other);
    } catch (err) {
      continue;
    }
    for (const form of widened.covers) {
      if (otherRe.test(form)) {
        gates.crossRuleOverlap.push(`${form} is already owned by ${other.ruleId} as "${other.label || other.phrase}"`);
      }
    }
  }
  if (gates.crossRuleOverlap.length > 0) {
    gates.verdict = 'BLOCKED_CROSS_RULE';
    return gates;
  }

  // Gate C: every new corpus hit, listed for a human to read.
  if (withProbe) {
    const oldEntry = { phrase: item.phrase, fix: item.fix, ruleId: item.ruleId };
    const newEntry = { pattern: widened.pattern, label: item.phrase, fix: item.fix, ruleId: item.ruleId };
    const key = (h) => `${path.basename(h.file)}:${h.line}`;
    const oldHits = new Set(probe([oldEntry], item.phrase, { corpus }).hits.map(key));
    const after = probe([newEntry], item.phrase, { corpus });

    gates.newHits = after.hits
      .filter((h) => !oldHits.has(key(h)))
      .map((h) => ({ at: key(h), matched: h.matched, text: String(h.raw || '').trim().slice(0, 160) }));
    gates.newHitCount = gates.newHits.length;

    const lost = [...oldHits].filter((k) => !after.hits.map(key).includes(k));
    if (lost.length > 0) {
      gates.lostFromOldPattern = lost;
      gates.verdict = 'BLOCKED_NOT_SUPERSET';
      return gates;
    }
  }

  gates.verdict = gates.newHitCount > NEW_HIT_ALARM ? 'NEEDS_READ' : 'READY';
  return gates;
}

function proposalId(dataFile, phrase, pattern) {
  return crypto.createHash('sha256').update(`${dataFile}|${phrase}|${pattern}|${PROMPT_VERSION}`).digest('hex').slice(0, 8);
}

// --- Building proposals ------------------------------------------------------

function buildProposal(item, answer, opts) {
  const letters = item.candidates.map((_, j) => LETTERS[j]);
  const accepted = (answer.accept || []).map((id) => item.candidates[letters.indexOf(id)]).filter(Boolean);
  const rejected = (answer.reject || []).map((r) => {
    const c = item.candidates[letters.indexOf(r.id)];
    return { form: c ? c.form : r.id, class: c ? c.class : null, why: r.why };
  });

  if (accepted.length === 0) {
    return {
      proposalId: proposalId(item.dataFile, item.phrase, 'none'),
      dataFile: item.dataFile,
      ruleId: item.ruleId,
      entryIndex: item.entryIndex,
      replace: { phrase: item.phrase, fix: item.fix },
      with: null,
      covers: [],
      rejected,
      note: answer.note || null,
      gates: { verdict: 'SINGLE_FORM' },
      promoted: false,
    };
  }

  let widened;
  try {
    widened = compileWidening(item.phrase, accepted.map((c) => c.form));
  } catch (err) {
    return {
      proposalId: proposalId(item.dataFile, item.phrase, 'uncompilable'),
      dataFile: item.dataFile,
      ruleId: item.ruleId,
      entryIndex: item.entryIndex,
      replace: { phrase: item.phrase, fix: item.fix },
      with: null,
      covers: accepted.map((c) => c.form),
      rejected,
      note: `compileWidening failed: ${err.message}`,
      gates: { verdict: 'BLOCKED_UNCOMPILABLE' },
      promoted: false,
    };
  }

  const gates = runGates(item, widened, opts);
  return {
    proposalId: proposalId(item.dataFile, item.phrase, widened.pattern),
    dataFile: item.dataFile,
    ruleId: item.ruleId,
    entryIndex: item.entryIndex,
    // `replace`, never `add`. Two entries, a literal and a pattern that
    // subsumes it, would double-report one line.
    replace: { phrase: item.phrase, fix: item.fix },
    // A complete, valid wordlist object, so promotion is a copy with no
    // translation. `label` is mandatory whenever `pattern` is: without it
    // banned-phrases.js falls back to match[0] and the report quotes whatever
    // text happened to match instead of naming the construct.
    with: { pattern: widened.pattern, label: item.phrase, fix: item.fix },
    style: widened.style,
    covers: accepted.map((c) => ({ form: c.form, class: c.class })),
    rejected,
    note: answer.note || null,
    gates,
    promoted: false,
  };
}

// --- The run -----------------------------------------------------------------

function audit(work, { batch = DEFAULT_BATCH, maxCalls = Infinity, cache, refresh = false, onProgress = () => {}, ...opts }) {
  const proposals = [];
  const skipped = [];
  let calls = 0;
  let served = 0;

  const pending = [];
  for (const item of work) {
    const key = entryCacheKey(item);
    const hit = !refresh && cache.entries[key];
    if (hit) {
      served += 1;
      proposals.push(buildProposal(item, hit, opts));
    } else {
      pending.push({ ...item, key });
    }
  }

  for (const group of batchWork(pending, batch)) {
    if (calls >= maxCalls) {
      for (const item of group) skipped.push(`${item.dataFile}#${item.phrase}`);
      continue;
    }
    onProgress({ size: group.length, calls: calls + 1 });
    calls += 1;

    let reply = askClaude({
      timeoutMs: BATCH_TIMEOUT_MS,
      buildPrompt: (priorViolation) => buildAuditPrompt(group, priorViolation),
      validate: (text) => validateAuditReply(text, group),
    });

    // The singleton retry. One unanswerable entry must not cost the other
    // seven their verdicts.
    if (!reply && group.length > 1) {
      for (const item of group) {
        if (calls >= maxCalls) {
          skipped.push(`${item.dataFile}#${item.phrase}`);
          continue;
        }
        calls += 1;
        const single = askClaude({
          timeoutMs: BATCH_TIMEOUT_MS,
          buildPrompt: (priorViolation) => buildAuditPrompt([item], priorViolation),
          validate: (text) => validateAuditReply(text, [item]),
        });
        if (!single) {
          skipped.push(`${item.dataFile}#${item.phrase}`);
          continue;
        }
        const answer = JSON.parse(single)[0];
        cache.entries[item.key] = answer;
        proposals.push(buildProposal(item, answer, opts));
      }
      continue;
    }

    if (!reply) {
      for (const item of group) skipped.push(`${item.dataFile}#${item.phrase}`);
      continue;
    }
    for (const answer of JSON.parse(reply)) {
      const item = group[answer.n - 1];
      cache.entries[item.key] = answer;
      proposals.push(buildProposal(item, answer, opts));
    }
  }

  return { proposals, skipped, calls, served };
}

// --- CLI ---------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    file: null,
    batch: DEFAULT_BATCH,
    maxCalls: Infinity,
    probe: false,
    refresh: false,
    format: 'text',
    corpus: DEFAULT_CORPUS,
    out: path.join(DEFAULT_DIR, 'wordlist-widenings.json'),
    cache: path.join(DEFAULT_DIR, 'widen-cache.json'),
  };
  for (const arg of argv) {
    if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length);
    else if (arg.startsWith('--batch=')) args.batch = parseInt(arg.slice('--batch='.length), 10);
    else if (arg.startsWith('--max-calls=')) args.maxCalls = parseInt(arg.slice('--max-calls='.length), 10);
    else if (arg.startsWith('--corpus=')) args.corpus = arg.slice('--corpus='.length);
    else if (arg.startsWith('--out=')) args.out = arg.slice('--out='.length);
    else if (arg.startsWith('--cache=')) args.cache = arg.slice('--cache='.length);
    else if (arg.startsWith('--format=')) args.format = arg.slice('--format='.length);
    else if (arg === '--probe') args.probe = true;
    else if (arg === '--refresh') args.refresh = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const work = collectWork({ fileFilter: args.file });
  if (work.length === 0) {
    console.log('No literal entry has an uncovered sibling. Nothing to audit.');
    return;
  }

  const allEntries = [];
  for (const file of walk(DATA_ROOT)) {
    try {
      allEntries.push(...loadEntryFile(file));
    } catch (err) {
      // A malformed data file is reported by test/wordlist-hygiene.test.js.
    }
  }

  console.log(`${work.length} literal entr${work.length === 1 ? 'y' : 'ies'} with uncovered siblings.`);
  console.log(`${work.reduce((n, i) => n + i.candidates.length, 0)} candidate sibling(s) to judge.`);
  if (!args.probe) console.log('Corpus impact not measured. Pass --probe to fill the newHits gate.');

  const cache = loadCache(args.cache);
  const { proposals, skipped, calls, served } = audit(work, {
    batch: args.batch,
    maxCalls: args.maxCalls,
    cache,
    refresh: args.refresh,
    corpus: args.corpus,
    allEntries,
    withProbe: args.probe,
    onProgress: ({ size, calls: n }) => console.log(`  call ${n}: judging ${size} entr${size === 1 ? 'y' : 'ies'}`),
  });

  writeJson(args.cache, cache);
  writeJson(args.out, {
    generatedAt: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    corpus: [args.corpus],
    entriesAudited: proposals.length,
    calls,
    proposals,
  });

  if (args.format === 'json') {
    console.log(JSON.stringify({ proposals, skipped, calls, served }, null, 2));
    return;
  }

  const byVerdict = {};
  for (const p of proposals) byVerdict[p.gates.verdict] = (byVerdict[p.gates.verdict] || 0) + 1;

  console.log('');
  console.log(`${proposals.length} audited, ${served} from cache, ${calls} claude call(s), ${skipped.length} skipped.`);
  for (const [v, n] of Object.entries(byVerdict)) console.log(`  ${v}  x${n}`);
  console.log('');

  // Print the ones needing a read first, then ready, then blocked.
  const order = ['NEEDS_READ', 'READY', 'BLOCKED_CROSS_RULE', 'BLOCKED_NOT_SUPERSET', 'BLOCKED_UNCOMPILABLE', 'SINGLE_FORM'];
  for (const verdict of order) {
    for (const p of proposals.filter((x) => x.gates.verdict === verdict)) {
      if (verdict === 'SINGLE_FORM') {
        console.log(`SINGLE_FORM  ${p.dataFile} "${p.replace.phrase}"  ${p.note || ''}`);
        continue;
      }
      console.log(`${verdict}  ${p.dataFile} (${p.ruleId})`);
      console.log(`  - { "phrase": ${JSON.stringify(p.replace.phrase)} }`);
      if (p.with) console.log(`  + { "pattern": ${JSON.stringify(p.with.pattern)}, "label": ${JSON.stringify(p.with.label)} }`);
      if (p.covers.length) console.log(`    covers: ${p.covers.map((c) => c.form).join(', ')}`);
      if (p.gates.crossRuleOverlap && p.gates.crossRuleOverlap.length) {
        console.log(`    ${p.gates.crossRuleOverlap.join('; ')}`);
      }
      if (p.gates.newHitCount) {
        console.log(`    ${p.gates.newHitCount} new corpus hit(s) to read:`);
        for (const h of p.gates.newHits.slice(0, 5)) console.log(`      ${h.at}  ${h.text}`);
      }
      console.log('');
    }
  }

  console.log(`Wrote ${args.out}.`);
  console.log('Nothing is promoted. For each proposal, read its new corpus hits, then edit data/ by hand.');
}

if (require.main === module) main();

module.exports = {
  collectWork,
  batchWork,
  buildAuditPrompt,
  validateAuditReply,
  runGates,
  buildProposal,
  entryCacheKey,
  audit,
  PROMPT_VERSION,
  NEW_HIT_ALARM,
  LETTERS,
};
