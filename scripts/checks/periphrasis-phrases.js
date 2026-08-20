'use strict';

const fs = require('fs');
const path = require('path');
const { makeFinding } = require('../lib/report');

const DATA_DIR = path.join(__dirname, '..', 'data', 'periphrasis');
const INLINE_CODE_RE = /`[^`]*`/g;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadPhraseList() {
  const entries = [];
  for (const file of fs.readdirSync(DATA_DIR)) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    for (const p of data.phrases) {
      entries.push({ phrase: p.phrase, pattern: p.pattern, label: p.label, fix: p.fix, category: data.category, ruleId: data.ruleId });
    }
  }
  return entries;
}

/**
 * Same literal-`phrase`-or-raw-`pattern` shape as checks/banned-phrases.js and
 * checks/metaphor-phrases.js. `label` is what gets reported for a pattern entry,
 * since there is no single literal phrase to quote.
 */
function entryRegex(entry) {
  if (entry.pattern) return new RegExp(entry.pattern, 'i');
  return new RegExp(`\\b${escapeRegExp(entry.phrase)}\\b`, 'i');
}

/**
 * Tier 2: a sentence that spells out what a concept does in roundabout language
 * instead of naming it directly, when a concise technical term for that concept is
 * already established elsewhere in this doc set (for example "pagination"/"paginate"
 * instead of "so a long list can be read in pages"). Tier 2, not tier 1, because
 * whether a shorter direct term already exists for the concept being described is a
 * judgment call a human (or LLM) reviewer has to make, the same reasoning that puts
 * checks/metaphor-phrases.js (C3-08) at tier 2.
 */
function checkPeriphrasis(doc) {
  const findings = [];
  const phraseList = loadPhraseList();

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const stripped = raw.replace(INLINE_CODE_RE, ' ');

    for (const entry of phraseList) {
      const re = entryRegex(entry);
      const match = re.exec(stripped);
      if (match) {
        const found = entry.phrase || entry.label || match[0];
        findings.push(
          makeFinding({
            tier: 2,
            ruleId: entry.ruleId,
            checkId: 'periphrasis-phrases',
            line: lineNo,
            message: `Roundabout ${entry.category} phrase "${found}" found. Fix: ${entry.fix}`,
            falsePositiveNote:
              'A hit is fine if this doc set has no shorter direct term for the concept yet. Confirm a concise established term exists (as class_reference.md establishes "pagination") before fixing it.',
          })
        );
      }
    }
  }
  return findings;
}

module.exports = { checkPeriphrasis };
