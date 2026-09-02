'use strict';

const path = require('path');
const { makeFinding } = require('../lib/report');
const { loadPhraseList, entryRegex, INLINE_CODE_RE } = require('../lib/phrase-list');

const DATA_DIR = path.join(__dirname, '..', 'data', 'banned-phrases');

/** Tier 1: exact banned casual/marketing/superlative/buzzword phrase matches, outside code fences and inline code. */
function checkBannedPhrases(doc) {
  const findings = [];
  const phraseList = loadPhraseList(DATA_DIR);

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const stripped = raw.replace(INLINE_CODE_RE, ' ');

    for (const entry of phraseList) {
      const re = entryRegex(entry);
      const match = re.exec(stripped);
      if (match) {
        const found = entry.phrase || match[0];
        findings.push(
          makeFinding({
            tier: 1,
            ruleId: entry.ruleId,
            checkId: 'banned-phrases',
            line: lineNo,
            message: `Banned ${entry.category} phrase "${found}" found. Fix: ${entry.fix}`,
          })
        );
      }
    }
  }
  return findings;
}

module.exports = { checkBannedPhrases };
