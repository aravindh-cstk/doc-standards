'use strict';

const { makeFinding } = require('../lib/report');

const INLINE_CODE_RE = /`[^`]*`/g;
const PHRASE_RE = /\bhow (?:many|much)\b/g;

/**
 * Tier 2: a mid-sentence, lowercase "how many"/"how much" turns a declarative
 * sentence into an embedded indirect question ("depth limits how many levels
 * the response covers"). A capitalized "How many"/"How much" starting a
 * standalone phrase (a parameter table cell, for example "How many levels
 * above the term to traverse.") is a different, accepted convention and does
 * not match, since the regex is case sensitive.
 */
function checkEmbeddedQuestionPhrases(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const stripped = raw.replace(INLINE_CODE_RE, ' ');
    const matches = stripped.match(PHRASE_RE);
    if (matches) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C3-12',
          checkId: 'embedded-question-phrases',
          line: lineNo,
          message: `Embedded question phrase "${matches[0]}" reads as an indirect question mid-sentence: ${raw.trim().slice(0, 100)}`,
          falsePositiveNote:
            'Rewrite "how many/how much X the Y verbs" as "the number of X the Y verbs" or name the count directly. A capitalized "How many" starting a standalone table-cell phrase is a different, accepted convention and is not flagged.',
        })
      );
    }
  }
  return findings;
}

module.exports = { checkEmbeddedQuestionPhrases };
