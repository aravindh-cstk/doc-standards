'use strict';

const fs = require('fs');
const path = require('path');
const { makeFinding } = require('../lib/report');

const DATA_DIR = path.join(__dirname, '..', 'data', 'metaphors');
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
 * Same literal-`phrase`-or-raw-`pattern` shape as checks/banned-phrases.js. `label`
 * is what gets reported for a pattern entry, since there is no single literal
 * phrase to quote (for example the "walk" pattern covers walk/walks).
 */
function entryRegex(entry) {
  if (entry.pattern) return new RegExp(entry.pattern, 'i');
  return new RegExp(`\\b${escapeRegExp(entry.phrase)}\\b`, 'i');
}

/**
 * Tier 2: figurative/spatial metaphor phrases standing in for a technical mechanism,
 * outside code fences and inline code. Tier 2 (flagged for review, non-blocking)
 * rather than tier 1, because unlike casual/marketing phrases, a metaphor hit can be
 * legitimate domain vocabulary elsewhere (see rule C3-08's exception in common-rules.md),
 * so it needs a human read, not an automatic gate.
 */
function checkMetaphors(doc) {
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
            checkId: 'metaphor-phrases',
            line: lineNo,
            message: `Figurative ${entry.category} phrase "${found}" found. Fix: ${entry.fix}`,
            falsePositiveNote: 'Domain-standard structural vocabulary (ancestor/descendant/parent/child naming a real data-model relationship) is exempt. Confirm this hit stands in for an operation before fixing it.',
          })
        );
      }
    }
  }
  return findings;
}

module.exports = { checkMetaphors };
