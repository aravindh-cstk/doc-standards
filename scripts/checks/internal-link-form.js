'use strict';

const { makeFinding } = require('../lib/report');

/**
 * Internal docs links must be root-relative.
 *
 * An absolute https://www.contentstack.com/docs/... link resolves to production
 * from every environment, so a reader reviewing on staging is thrown back to
 * production the moment they click one, and a link path cannot be reviewed
 * before it ships.
 *
 * The docs site is the only host this applies to. Links to the application
 * (contentstack.com/login) and to third parties stay absolute, because they are
 * not environment mirrored and have no relative form.
 */
const ABSOLUTE_DOCS = /https?:\/\/(?:www\.|stag-www\.|dev-www\.)?contentstack\.com\/docs\//i;

/** Tier 1: no absolute link to the docs site. */
function checkInternalLinkForm(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    if (!ABSOLUTE_DOCS.test(raw)) continue;
    const match = raw.match(
      /https?:\/\/(?:www\.|stag-www\.|dev-www\.)?contentstack\.com(\/docs\/[^)\s"'<>]*)/i
    );
    const relative = match ? match[1] : '/docs/...';
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'CLI-17',
        checkId: 'internal-link-form',
        line: lineNo,
        message:
          `Absolute link to the docs site. Use the root-relative form "${relative}" ` +
          `instead, so the link stays inside whichever environment the reader is on.`,
      })
    );
  }
  return findings;
}

module.exports = { checkInternalLinkForm };
