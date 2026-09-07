'use strict';

const { makeFinding } = require('../lib/report');

// The callout label, in both the blockquote form and the indented list form.
const CALLOUT_RE = /^\s*>?\s*\*\*Additional Resources?:\*\*\s*(.*)$/;

const OPENER_RE = /^For (?:more information|detailed steps)\b/;
// "refer to the [Doc Name](url) documentation" or, for a same-page anchor, "... section".
const REFER_RE = /refer to the \[[^\]]+\]\([^)]+\)\s+(documentation|section)\b/;

/** Tier 2: an Additional Resource callout follows the fixed referral phrasing. */
function checkAdditionalResourcePhrasing(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const m = CALLOUT_RE.exec(doc.lines[lineNo - 1]);
    if (!m) continue;

    const body = m[1].trim();
    const problems = [];
    if (!OPENER_RE.test(body)) {
      problems.push('open with "For more information on <topic>," or "For detailed steps on <task>,"');
    }
    if (!REFER_RE.test(body)) {
      problems.push(
        'close the referral with "refer to the [Doc Name](url) documentation", or "... section" when the target is an anchor on this page'
      );
    }
    if (!problems.length) continue;

    findings.push(
      makeFinding({
        tier: 2,
        ruleId: 'C5-05',
        checkId: 'additional-resource-phrasing',
        line: lineNo,
        message: `Additional Resource callout does not follow the required phrasing. Rewrite it to ${problems.join(
          ', and '
        )}. Do not phrase it as a statement about what the target contains.`,
      })
    );
  }
  return findings;
}

module.exports = { checkAdditionalResourcePhrasing };
