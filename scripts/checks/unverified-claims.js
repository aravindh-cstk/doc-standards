'use strict';

const { makeFinding } = require('../lib/report');

const CLAIM_RE = /\bfull support\b|\bmost effort of any\b|\btakes the most\b|\bfully support(s|ed)?\b/i;

/** Tier 3: capability or comparative-superlative claims that read as verified facts but were not necessarily checked against source. */
function checkUnverifiedClaims(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    if (CLAIM_RE.test(raw)) {
      findings.push(
        makeFinding({
          tier: 3,
          ruleId: 'C6-08',
          checkId: 'unverified-claims',
          line: lineNo,
          message: 'Capability or comparative claim found. Verify against the current source of truth before publishing, and state the concrete fact instead.',
        })
      );
    }
  }
  return findings;
}

module.exports = { checkUnverifiedClaims };
