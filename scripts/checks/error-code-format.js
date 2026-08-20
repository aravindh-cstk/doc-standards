'use strict';

const { makeFinding } = require('../lib/report');

const INLINE_CODE_RE = /`[^`]*`/g;
const HTTP_STATUS_RE = /\b[1-5][0-9]{2}\b/g;

/** Tier 2: HTTP status codes and other numeric error codes should be inline code, not bare prose. */
function checkErrorCodeFormat(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const bare = raw.replace(INLINE_CODE_RE, (m) => ' '.repeat(m.length));
    const codes = [...new Set(bare.match(HTTP_STATUS_RE) || [])];
    if (codes.length) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C3-11',
          checkId: 'error-code-format',
          line: lineNo,
          message: `Numeric error/status code(s) not in inline code: ${codes.join(', ')}. Wrap as ${codes
            .map((c) => `\`${c}\``)
            .join(', ')}.`,
        })
      );
    }
  }
  return findings;
}

module.exports = { checkErrorCodeFormat };
