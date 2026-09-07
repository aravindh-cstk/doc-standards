'use strict';

const { makeFinding } = require('../lib/report');
const { proseMatches, maskProse } = require('../lib/prose-mask');

const DASH_SEMI_RE = /[—–;]/;

/**
 * Tier 1: no em dash, en dash, or semicolon in prose.
 *
 * "In prose" is decided by lib/prose-mask.js, which is the same definition the
 * fixer uses. They were separate once, and disagreed: this check reported 296
 * findings the fixer put at zero, because it only knew about inline code. The
 * other 296 were semicolons inside `style="max-width: 680px; width: 100%"` on
 * diagram images, inside indented code, and inside other HTML tags. All of them
 * are required syntax, so the rule could not ask anyone to remove them, and
 * clearing the list by hand would have meant breaking markup.
 */
function checkEmDashSemicolon(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const positions = proseMatches(raw, DASH_SEMI_RE);
    if (positions.length === 0) continue;

    const masked = maskProse(raw);
    const chars = [...new Set(positions.map((i) => masked[i]))].join(', ');
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
  return findings;
}

module.exports = { checkEmDashSemicolon };
