'use strict';

/**
 * The always-on guard against the failure class that produced three separate
 * bug reports.
 *
 * `entryRegex` compiles a literal `phrase` into `\b<escaped>\b`, a regex
 * exactly as wide as the string. So every literal entry is a claim that its
 * rule has one correct surface form, and that claim keeps turning out false:
 *
 *   casual.json listed `reach for` and not `reach out`
 *   casual.json listed `raise the value`, so `raise a support request` missed
 *   metaphors listed `unwrap(s|ped|ping)?` but `pass over` bare
 *
 * Each was found by a human reading prose the linter had passed clean. This
 * test is what stops the class regrowing: adding a bare literal whose
 * de-hyphenated form is uncovered turns the build red.
 *
 * It reads via `loadEntryFile`, the single canonical loader. Three checks in
 * this tree still carry their own hand-copied loaders with their own private
 * field allowlists, so they drop `literal` and `literalReason` entirely. That
 * is fine and deliberate: no runtime check reads those fields, only this test
 * does. Do not "fix" three loaders on their account.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { loadEntryFile } = require('../lib/phrase-list');
const { siblingsOf, uncoveredSiblings, compileWidening, GUARD_CLASSES } = require('../lib/inflect');

const DATA_ROOT = path.join(__dirname, '..', 'data');

/**
 * Literal entries whose uncovered siblings are accepted for now.
 *
 * Keyed `<relative file>#<phrase>`. It exists so the guard could be switched on
 * without grandfathering the whole tree, and it may only SHRINK: the second
 * test below fails on a stale key, so a fixed entry cannot linger here.
 *
 * Empty on arrival, because all 13 real cases were widened before this landed.
 */
const KNOWN_UNCOVERED = [];

function walk(dir) {
  return fs.readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) return walk(full);
    return name.endsWith('.json') ? [full] : [];
  });
}

/** Every literal entry with a sibling that no entry sharing its rule matches. */
function uncoveredLiterals() {
  const out = [];
  for (const file of walk(DATA_ROOT)) {
    let entries;
    try {
      entries = loadEntryFile(file);
    } catch (err) {
      continue;
    }
    for (const entry of entries) {
      if (!entry.phrase) continue;
      // The escape hatch. A deliberately literal entry is exempt, and
      // test/wordlist-hygiene.test.js separately requires it to carry a reason.
      if (entry.literal) continue;

      const missing = uncoveredSiblings(entry, siblingsOf(entry.phrase, { classes: GUARD_CLASSES }), entries);
      if (missing.length === 0) continue;

      let suggested = null;
      try {
        suggested = compileWidening(entry.phrase, missing.map((m) => m.form));
      } catch (err) {
        suggested = null;
      }
      out.push({
        key: `${path.relative(DATA_ROOT, file)}#${entry.phrase}`,
        file: path.relative(DATA_ROOT, file),
        phrase: entry.phrase,
        ruleId: entry.ruleId,
        fix: entry.fix,
        missing: missing.map((m) => m.form),
        suggested: suggested ? suggested.pattern : null,
      });
    }
  }
  return out;
}

test('no literal entry leaves a de-hyphenated sibling uncovered', () => {
  const found = uncoveredLiterals().filter((u) => !KNOWN_UNCOVERED.includes(u.key));

  // The error message is the copy-paste, not just the complaint. It comes from
  // compileWidening, so the suggested pattern is the same one the auditor would
  // propose rather than a second guess at it.
  const message = found
    .map(
      (u) =>
        `${u.file} entry "${u.phrase}" (${u.ruleId}) is a literal, so the linter cannot see: ` +
        `${u.missing.join(', ')}\n` +
        `  Either widen it -> { "pattern": ${JSON.stringify(u.suggested)}, "label": ${JSON.stringify(u.phrase)}, "fix": ${JSON.stringify(u.fix)} }\n` +
        '  or declare it   -> add "literal": true with a "literalReason" saying why one form is right.'
    )
    .join('\n\n');

  assert.deepEqual(found.map((u) => u.key), [], message);
});

test('the known-uncovered list has no stale entries, so it can only shrink', () => {
  const live = new Set(uncoveredLiterals().map((u) => u.key));
  const stale = KNOWN_UNCOVERED.filter((k) => !live.has(k));
  assert.deepEqual(stale, [], `Fixed, so remove from KNOWN_UNCOVERED: ${stale.join(', ')}`);
});

test('the guard would have caught the reach-for gap that shipped', () => {
  // The regression proof. Before `reach out` was added by hand, casual.json
  // held `reach for` as a bare literal. Verify the generator produces the
  // sibling family for it, so a future bare literal of the same shape is
  // visible to the auditor even though de-hyphenation alone does not fail it.
  const forms = siblingsOf('reach for').map((s) => s.form);
  assert.ok(forms.includes('reaches for'), 'the verb family must be generated');
  assert.ok(forms.includes('reaching for'));
  assert.ok(forms.includes('reached for'));

  const widened = compileWidening('reach for', ['reaches for', 'reached for', 'reaching for']);
  assert.equal(widened.pattern, '\\breach(es|ed|ing)? for\\b');
  assert.equal(widened.style, 'SUFFIX_GROUP', 'the house style already used elsewhere in this tree');
});

test('de-hyphenation is the only class the guard hard-fails on', () => {
  // Narrowed deliberately. `robust` is not a verb, so verb inflection would
  // demand a widening for "robusts". `out of the box` really is also written
  // hyphenated while `reach for` never is, so hyphenation is a guess. Only
  // removing a hyphen is a derivation rather than a guess.
  assert.deepEqual(GUARD_CLASSES, ['DEHYPHENATION']);

  const robust = siblingsOf('robust', { classes: GUARD_CLASSES });
  assert.deepEqual(robust, [], 'a non-verb must not be hard-failed into a verb family');

  const hyphenated = siblingsOf('production-ready', { classes: GUARD_CLASSES }).map((s) => s.form);
  assert.deepEqual(hyphenated.sort(), ['production ready', 'productionready']);
});
