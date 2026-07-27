'use strict';

const { makeFinding } = require('../lib/report');

const INLINE_CODE_RE = /`[^`]*`/g;
const DASH_SEMI_RE = /[—–;]/;

/** Tier 1: no em dash, en dash, or semicolon in prose outside code fences or inline code spans. */
function checkEmDashSemicolon(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const stripped = raw.replace(INLINE_CODE_RE, '');
    if (DASH_SEMI_RE.test(stripped)) {
      const chars = [...new Set(stripped.match(new RegExp(DASH_SEMI_RE, 'g')) || [])].join(', ');
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C3-05',
          checkId: 'em-dash-semicolon',
          line: lineNo,
          message: `Em dash, en dash, or semicolon (${chars}) found in prose: ${raw.trim().slice(0, 100)}`,
        })
      );
    }
  }
  return findings;
}

module.exports = { checkEmDashSemicolon };
