'use strict';

/**
 * Invariants every wordlist data file must hold, checked without the corpus,
 * without a DocModel, and without the claude CLI.
 *
 * The first test exists because of a real bug. data/banned-phrases/
 * product-defect.json carried:
 *
 *   { "phrase": "rather than looking for a toggle",
 *     "fix": "state the action (raise a support request) without the aside" }
 *
 * "raise a support request" is a dead-end instruction, the defect C5-06 exists
 * to catch, and it is also the object generalization C3-01's "raise the value"
 * entry was supposed to cover. So the wordlist was actively teaching a writer
 * to produce a violation of two other rules. A rule that recommends the defect
 * it should catch is worse than no rule, and nothing in the system could see
 * it, because no check ever reads another entry's `fix` text.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { loadEntryFile, entryRegex } = require('../lib/phrase-list');

const DATA_ROOT = path.join(__dirname, '..', 'data');

/** Every wordlist file in the data tree, at any depth, that has a `phrases` array. */
function allWordlistFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith('.json')) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(full, 'utf8'));
      } catch (err) {
        continue;
      }
      if (Array.isArray(data.phrases)) out.push(full);
    }
  };
  walk(DATA_ROOT);
  return out;
}

function allEntries() {
  const out = [];
  for (const file of allWordlistFiles()) {
    for (const entry of loadEntryFile(file)) out.push({ ...entry, file: path.relative(DATA_ROOT, file) });
  }
  return out;
}

test('the data tree has wordlist files to check', () => {
  assert.ok(allWordlistFiles().length >= 10, 'expected at least ten wordlist files');
});

/**
 * The spans of a `fix` that are recommended DOC PROSE rather than instruction
 * to the writer.
 *
 * This distinction is the whole test. "name the behavior" is an imperative
 * addressed to whoever is editing the doc, and it is fine even though C3-21
 * owns `names the ...` as doc prose. What is not fine is a fix that hands the
 * writer replacement text which itself violates another rule, and every
 * wordlist in this tree marks that text the same two ways: inside double
 * quotes, or inside parentheses.
 *
 * Checking the whole `fix` string instead flags 12 legitimate imperatives, so
 * the narrow read is not a convenience, it is the only correct one.
 */
function recommendedSpans(fix) {
  const spans = [];
  for (const m of String(fix).matchAll(/"([^"]+)"/g)) spans.push(m[1]);
  for (const m of String(fix).matchAll(/\(([^)]+)\)/g)) spans.push(m[1]);
  return spans;
}

test('no entry fix text recommends prose another rule forbids', () => {
  const entries = allEntries();

  const problems = [];
  for (const entry of entries) {
    if (!entry.fix) continue;
    for (const span of recommendedSpans(entry.fix)) {
      for (const other of entries) {
        // Same rule is fine: a fix may quote the phrase it replaces, and an
        // entry quoting its own family is how the fix stays readable.
        if (other.ruleId === entry.ruleId) continue;
        let re;
        try {
          re = entryRegex(other);
        } catch (err) {
          continue;
        }
        if (re.test(span)) {
          problems.push(
            `${entry.file} entry "${entry.label || entry.phrase}" (${entry.ruleId}) recommends the prose ` +
              `"${span}", which ${other.ruleId} forbids as "${other.label || other.phrase}"`
          );
        }
      }
    }
  }

  assert.deepEqual(problems, [], problems.join('\n'));
});

test('every pattern entry carries a label', () => {
  // banned-phrases.js falls back to match[0] with no label, so the report
  // quotes whatever text happened to match rather than naming the rule. And
  // judge-tone.js builds its discover prompt from `label || phrase`, so a
  // label-less pattern puts a raw regex into a prompt.
  const problems = allEntries()
    .filter((e) => e.pattern && !e.label)
    .map((e) => `${e.file}: pattern ${JSON.stringify(e.pattern)} has no label`);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('every entry has exactly one of phrase or pattern, and a fix', () => {
  const problems = [];
  for (const e of allEntries()) {
    const which = [e.phrase, e.pattern].filter(Boolean).length;
    if (which !== 1) {
      problems.push(`${e.file}: entry needs exactly one of phrase or pattern, has ${which}`);
    }
    if (!e.fix || !String(e.fix).trim()) {
      problems.push(`${e.file}: entry "${e.label || e.phrase || e.pattern}" has no fix`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('every pattern compiles', () => {
  const problems = [];
  for (const e of allEntries()) {
    if (!e.pattern) continue;
    try {
      entryRegex(e);
    } catch (err) {
      problems.push(`${e.file}: pattern ${JSON.stringify(e.pattern)} does not compile: ${err.message}`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('a literal marked deliberate carries a reason, and a reason implies the marker', () => {
  // The escape hatch for the inflection guard. Half-applied, it is worse than
  // absent: `literal` with no reason is a shrug, and `literalReason` without
  // `literal` reads as an exemption that is not actually in force.
  const problems = [];
  for (const e of allEntries()) {
    if (e.literal && !String(e.literalReason || '').trim()) {
      problems.push(`${e.file}: entry "${e.phrase}" sets literal: true with no literalReason`);
    }
    if (!e.literal && e.literalReason) {
      problems.push(`${e.file}: entry "${e.phrase}" has a literalReason but does not set literal: true`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('no two rules claim the same literal phrase', () => {
  // Two rules reporting one line is what doc-gap.md Step 2 forbids, and it is
  // also a widening hazard: widening either copy makes it collide with the
  // other. Found "seamless" and "powerful" duplicated across C8-01 and C3-03.
  const byPhrase = new Map();
  for (const e of allEntries()) {
    if (!e.phrase) continue;
    const key = e.phrase.toLowerCase();
    if (!byPhrase.has(key)) byPhrase.set(key, new Set());
    byPhrase.get(key).add(e.ruleId);
  }
  const problems = [];
  for (const [phrase, ruleIds] of byPhrase) {
    if (ruleIds.size > 1) {
      problems.push(`"${phrase}" is claimed by ${[...ruleIds].sort().join(' and ')}. Pick one owner.`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

// ---------------------------------------------------------------------------
// Negated minimizers (added after three meaning inversions shipped)
// ---------------------------------------------------------------------------

const { checkBannedPhrases: checkBanned } = require('../checks/banned-phrases');

const oneLine = (line) => ({ bodyStartLine: 1, totalLines: 1, lines: [line], inFenceMask: { 1: false } });
const justHits = (line) => checkBanned(oneLine(line)).filter((f) => /"just"/.test(f.message)).length;

/**
 * "not just X" means "not only X", so dropping the word reverses the sentence.
 * Three lines shipped that way in a live pass before this was caught:
 *
 *   "so you see all iterations, not just one"  ->  "not one"
 *   "needs to differ per region (not just the content)"  ->  "(not the content)"
 *
 * The corpus holds 33 "not just", 1 "never just" and 1 "doesn't just", and
 * every one is correct English the rule must leave alone.
 */
test('"not just" is not a minimizer', () => {
  assert.equal(justHits('Toggle Preview Mode so you see all iterations, not just one.'), 0);
});

test('"never just" and "doesn\'t just" are not minimizers', () => {
  assert.equal(justHits('The binder never just flattens the value.'), 0);
  assert.equal(justHits("It doesn't just render the node, it resolves the binding first."), 0);
});

test('a bare minimizer is still a finding', () => {
  assert.equal(justHits('Expand the entry you just pinned.'), 1);
  assert.equal(justHits('This is just a placeholder value.'), 1);
});

/**
 * The lookbehind must not swallow a legitimate "just" that merely follows a
 * negation earlier in the sentence.
 */
test('a negation elsewhere in the line does not exempt the minimizer', () => {
  assert.equal(justHits('It is not a page, so just drop the entry there.'), 1);
});
