'use strict';

const acronymData = require('../data/acronyms.json');
const { makeFinding } = require('../lib/report');

const INLINE_CODE_RE = /`[^`]*`/g;
const PAREN_GROUP_RE = /\(([^()]+)\)/g;

/** Does any parenthetical on this line list the acronym as one of its slash/comma/and-separated tokens? */
function hasParenExpansion(strippedLine, acronym) {
  let match;
  PAREN_GROUP_RE.lastIndex = 0;
  while ((match = PAREN_GROUP_RE.exec(strippedLine)) !== null) {
    const tokens = match[1].split(/\s*(?:\/|,|\band\b)\s*/i);
    if (tokens.some((t) => t.trim() === acronym)) return true;
  }
  return false;
}

/** Tier 1: closed-list acronyms must be expanded (parenthetical or "full form (ABBR)") before or at their first bare use. */
function checkAcronymFirstUse(doc) {
  const findings = [];

  for (const { acronym, expansion } of acronymData.acronyms) {
    const boundaryRe = new RegExp(`\\b${acronym}\\b`, 'g');
    const fullFormRe = new RegExp(`${expansion}\\s*\\(`, 'i');

    let firstBareUseLine = null;
    let expansionFoundLine = null;

    for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
      if (doc.inFenceMask[lineNo]) continue;
      const raw = doc.lines[lineNo - 1];
      const stripped = raw.replace(INLINE_CODE_RE, ' ');

      if ((hasParenExpansion(stripped, acronym) || fullFormRe.test(stripped)) && expansionFoundLine === null) {
        expansionFoundLine = lineNo;
      }
      if (boundaryRe.test(stripped) && firstBareUseLine === null) {
        firstBareUseLine = lineNo;
      }
      boundaryRe.lastIndex = 0;

      if (firstBareUseLine !== null && expansionFoundLine !== null && expansionFoundLine <= firstBareUseLine) {
        break;
      }
    }

    if (firstBareUseLine !== null && (expansionFoundLine === null || expansionFoundLine > firstBareUseLine)) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C8-07',
          checkId: 'acronym-first-use',
          line: firstBareUseLine,
          message: `Acronym "${acronym}" used before its expansion "${expansion} (${acronym})" appears.`,
        })
      );
    }
  }

  return findings;
}

module.exports = { checkAcronymFirstUse };
