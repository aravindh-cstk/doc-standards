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
 * Scans a document for entry matches using the discipline every wordlist check
 * follows: body lines only, code fences skipped, inline code masked out. A
 * caller that scans differently would produce hits a real check could never
 * reproduce, which is the failure this function exists to prevent.
 */
function scanDoc(doc, entries, { onMatch }) {
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const stripped = raw.replace(INLINE_CODE_RE, ' ');

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
      if (match) onMatch({ entry, line: lineNo, matched: entry.phrase || match[0], raw });
    }
  }
}

module.exports = { escapeRegExp, entryRegex, loadEntryFile, loadPhraseList, scanDoc, INLINE_CODE_RE };
