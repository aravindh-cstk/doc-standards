'use strict';

const fs = require('fs');
const path = require('path');
const { makeFinding } = require('../lib/report');

const DATA_DIR = path.join(__dirname, '..', 'data', 'banned-phrases');
const INLINE_CODE_RE = /`[^`]*`/g;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadPhraseList() {
  const entries = [];
  for (const file of fs.readdirSync(DATA_DIR)) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    for (const p of data.phrases) {
      entries.push({ phrase: p.phrase, fix: p.fix, category: data.category, ruleId: data.ruleId });
    }
  }
  return entries;
}

/** Tier 1: exact banned casual/marketing/superlative/buzzword phrase matches, outside code fences and inline code. */
function checkBannedPhrases(doc) {
  const findings = [];
  const phraseList = loadPhraseList();

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const stripped = raw.replace(INLINE_CODE_RE, ' ');

    for (const entry of phraseList) {
      const re = new RegExp(`\\b${escapeRegExp(entry.phrase)}\\b`, 'i');
      if (re.test(stripped)) {
        findings.push(
          makeFinding({
            tier: 1,
            ruleId: entry.ruleId,
            checkId: 'banned-phrases',
            line: lineNo,
            message: `Banned ${entry.category} phrase "${entry.phrase}" found. Fix: ${entry.fix}`,
          })
        );
      }
    }
  }
  return findings;
}

module.exports = { checkBannedPhrases };
