'use strict';

const { makeFinding } = require('../lib/report');

const ALLOWED_LABELS = new Set(['warning', 'note', 'tip', 'additional resource']);
const BLOCKQUOTE_LABEL_RE = /^>\s*\*\*([^*:]+):\*\*/;

/** Tier 1: every blockquote callout must use one of the four allowed labels (Warning, Note, Tip, Additional Resource). */
function checkCalloutTaxonomy(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const match = raw.match(BLOCKQUOTE_LABEL_RE);
    if (!match) continue;
    const label = match[1].trim().toLowerCase();
    if (!ALLOWED_LABELS.has(label)) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C2-11',
          checkId: 'callout-taxonomy',
          line: lineNo,
          message: `Callout uses label "${match[1].trim()}", which is not one of the four allowed labels (Warning, Note, Tip, Additional Resource).`,
        })
      );
    }
  }
  return findings;
}

module.exports = { checkCalloutTaxonomy };
