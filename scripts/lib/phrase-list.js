'use strict';

/**
 * The phrase-matching primitives shared by the wordlist checks and by the gap
 * probe.
 *
 * Extracted from checks/banned-phrases.js so a probe drafted while hunting a
 * newly reported violation is byte-identical to the wordlist entry it becomes
 * if confirmed. There is no probe syntax to translate, and a probe hit and a
 * future check hit are provably the same set, because both run this matcher
 * over the same fence-masked, inline-code-stripped text.
 */

const fs = require('fs');
const path = require('path');

const INLINE_CODE_RE = /`[^`]*`/g;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Each entry is either a literal `phrase` (matched as a whole-word phrase, case
 * insensitive) or a `pattern` (a raw regex string, for catching a family of
 * related constructs with one entry). `label` is what gets reported for a
 * pattern entry, since there is no single literal phrase to quote.
 */
function entryRegex(entry) {
  if (entry.pattern) return new RegExp(entry.pattern, 'i');
  return new RegExp(`\\b${escapeRegExp(entry.phrase)}\\b`, 'i');
}

/** Reads one wordlist file into entries, carrying its ruleId and category down onto each. */
function loadEntryFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return (data.phrases || []).map((p) => ({
    phrase: p.phrase,
    pattern: p.pattern,
    label: p.label,
    fix: p.fix,
    category: data.category,
    ruleId: data.ruleId,
    // A provenance claim, never a matcher flag: `literal` says a human decided
    // this entry has exactly one correct surface form, so the inflection guard
    // in test/wordlist-inflection.test.js must not demand siblings for it. No
    // check reads it, and nothing about matching changes.
    //
    // Normalized to a strict boolean so a truthy string cannot become an
    // accidental exemption. This object is a FIXED field allowlist: a field
    // added to a data file and not named here is silently dropped, which is
    // why these two are added here rather than only in the JSON.
    literal: p.literal === true,
    literalReason: p.literalReason,
  }));
}

/** Reads every wordlist file in a directory. Adding a file registers new phrases with no code change. */
function loadPhraseList(dir) {
  const entries = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    entries.push(...loadEntryFile(path.join(dir, file)));
  }
  return entries;
}

/**
 * A markdown link target is machinery, not prose.
 *
 * `#the-url-decides-which-profile-a-client-can-use` is a slug derived from a
 * heading, so a wordlist hit inside it double-reports the heading it points at
 * and, worse, reports it in every file that links there. Masking the target
 * while keeping the link text means the visible words still get scanned.
 *
 * Applied in scanDoc, so every wordlist check gets it. The alternative, each
 * check masking on its own, is how the three pre-lib checks already drifted.
 */
const LINK_TARGET_RE = /\]\([^)\s]*/g;

/** Strips what is not prose from a line: inline code first, then link targets. */
function stripNonProse(raw) {
  return String(raw).replace(INLINE_CODE_RE, ' ').replace(LINK_TARGET_RE, '](');
}

/**
 * Scans a document for entry matches using the discipline every wordlist check
 * follows: body lines only, code fences skipped, inline code and link targets
 * masked out. A caller that scans differently would produce hits a real check
 * could never reproduce, which is the failure this function exists to prevent.
 *
 * `onMatch` receives `index` and `stripped` alongside the match so a check can
 * ask where on the line the hit sits. C3-18 needs it: a bare verb opening a
 * heading or a numbered step is an imperative addressed to the reader, not a
 * component being given a mind.
 */
function scanDoc(doc, entries, { onMatch }) {
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const stripped = stripNonProse(raw);

    for (const entry of entries) {
      let re;
      // An entry can carry a hand-written pattern, including one an agent just
      // drafted. A bad pattern must name itself rather than crash the sweep.
      try {
        re = entryRegex(entry);
      } catch (err) {
        onMatch({ error: `Invalid pattern ${JSON.stringify(entry.pattern)}: ${err.message}`, entry, line: lineNo });
        continue;
      }
      const match = re.exec(stripped);
      if (match) {
        onMatch({
          entry,
          line: lineNo,
          matched: entry.phrase || match[0],
          raw,
          stripped,
          index: match.index,
        });
      }
    }
  }
}

module.exports = {
  escapeRegExp,
  entryRegex,
  loadEntryFile,
  loadPhraseList,
  scanDoc,
  stripNonProse,
  INLINE_CODE_RE,
  LINK_TARGET_RE,
};
