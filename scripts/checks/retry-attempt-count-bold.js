'use strict';

const { makeFinding } = require('../lib/report');

const INLINE_CODE_RE = /`[^`]*`/g;
const ATTEMPT_COUNT_RE = /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+attempts?\b/gi;

/** Tier 2: a spelled-out retry/attempt count in prose should be bold, so a developer scanning the page for the number sees it. */
function checkRetryAttemptCountBold(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const codeMasked = raw.replace(INLINE_CODE_RE, (m) => ' '.repeat(m.length));

    let match;
    ATTEMPT_COUNT_RE.lastIndex = 0;
    while ((match = ATTEMPT_COUNT_RE.exec(codeMasked)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const alreadyBold = codeMasked.slice(start - 2, start) === '**' && codeMasked.slice(end, end + 2) === '**';
      if (!alreadyBold) {
        findings.push(
          makeFinding({
            tier: 2,
            ruleId: 'C3-13',
            checkId: 'retry-attempt-count-bold',
            line: lineNo,
            message: `Spelled-out attempt count "${match[0]}" is not bold. Wrap it as **${match[0]}**.`,
          })
        );
      }
    }
  }
  return findings;
}

module.exports = { checkRetryAttemptCountBold };
