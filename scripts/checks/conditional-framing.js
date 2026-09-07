'use strict';

const { makeFinding } = require('../lib/report');

const CONDITIONAL_FIX_RE = /\bif you (see|notice)\b.{0,120}?,\s*(enable|run|use|set|pass|add|remove|check)\b/i;

/** Tier 2: "if you see X, do Y" framing that hides a system fact behind a hypothetical instead of stating it directly. */
function checkConditionalFraming(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    if (CONDITIONAL_FIX_RE.test(raw)) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C3-29',
          checkId: 'conditional-framing',
          line: lineNo,
          message: 'Conditional "if you see X, do Y" framing found. Consider stating the cause directly, then the fix.',
          falsePositiveNote: 'May be genuinely conditional on the reader\'s own setup, not on system behavior, per C3-29\'s exception.',
        })
      );
    }
  }
  return findings;
}

module.exports = { checkConditionalFraming };
