'use strict';

const { makeFinding } = require('../lib/report');

const INLINE_CODE_RE = /`[^`]*`/g;

/**
 * A lowercase "how" with prose before it on the line, so it is mid-sentence
 * rather than opening a heading or a table cell. This catches the counting
 * forms ("how many levels the response covers") and the plain indirect
 * question ("they differ in how you install them", "see X for how to read
 * one", "how catalogs group the tools").
 */
const PHRASE_RE = /(?<=\S[ \t])how\b(?:[ \t]+(?:many|much))?/g;

/**
 * Suggested replacement for each shape of the embedded question, keyed by the
 * word that follows "how".
 */
const REWRITES = [
  { after: /^(many|much)$/, fix: 'name the count directly, for example "the number of X"' },
  { after: /^to$/, fix: 'name the thing, for example "the steps to X" or "the procedure for X"' },
];

const DEFAULT_FIX =
  'name the thing directly, for example "the OAuth sign-in flow" instead of "how OAuth sign-in works", or "the rules for combining them" instead of "how they combine"';

function fixFor(nextWord) {
  const entry = REWRITES.find((r) => r.after.test(nextWord));
  return entry ? entry.fix : DEFAULT_FIX;
}

/**
 * Tier 2: a mid-sentence, lowercase "how" turns a declarative sentence into an
 * embedded indirect question. A capitalized "How" starting a standalone phrase
 * (a heading such as "How a tool call works", or a parameter table cell such
 * as "How many levels above the term to traverse.") is a different, accepted
 * convention and does not match, since the regex is case sensitive and
 * requires preceding text on the line.
 */
function checkEmbeddedQuestionPhrases(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const stripped = raw.replace(INLINE_CODE_RE, ' ');
    const matches = stripped.match(PHRASE_RE);
    if (matches) {
      const phrase = matches[0].replace(/\s+/g, ' ');
      const nextWord = (stripped.split(phrase)[1] || '').trim().split(/\s+/)[0] || '';
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C3-12',
          checkId: 'embedded-question-phrases',
          line: lineNo,
          message: `Embedded question word "${phrase}" reads as an indirect question mid-sentence: ${raw.trim().slice(0, 100)}. Fix: ${fixFor(phrase.split(' ')[1] || nextWord)}`,
          falsePositiveNote:
            'A capitalized "How" opening a heading or a standalone table-cell phrase is a different, accepted convention and is not flagged. Rewrite the flagged clause to name the thing: "how OAuth works" becomes "the OAuth sign-in flow", "how to read one" becomes "the steps to read one", "how many levels" becomes "the number of levels".',
        })
      );
    }
  }
  return findings;
}

module.exports = { checkEmbeddedQuestionPhrases };
