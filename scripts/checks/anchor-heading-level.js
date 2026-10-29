'use strict';

/**
 * C5-08, tier 1: an anchor link whose target heading is H4 or deeper.
 *
 * The docs site renders an anchor id only for H2 and H3 headings, on the
 * heading's wrapper element. An H4 gets no id, so a link to it loads the page
 * and stays at the top. Markdown previews and every link checker that resolves
 * anchors by slug report the link as working, which is how one shipped in the
 * MCP Profile Hub docs and was found only by a rendered staging check.
 *
 * This module covers links within the page. lint/check-links.js covers links
 * from one page to a heading in another.
 */

const { makeFinding } = require('../lib/report');

const MAX_ANCHOR_LEVEL = 3;

function checkAnchorHeadingLevel(doc) {
  const findings = [];
  const byAnchor = new Map(doc.headings.map((h) => [h.anchor, h]));
  for (const link of doc.links) {
    const url = String(link.url || '');
    if (!url.startsWith('#') || url.startsWith('#:~:')) continue;
    const heading = byAnchor.get(decodeURIComponent(url.slice(1)));
    if (!heading || heading.level <= MAX_ANCHOR_LEVEL) continue;
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'C5-08',
        checkId: 'anchor-heading-level',
        line: link.line,
        message: `Link "${link.linkText}" targets an H${heading.level} heading ("${heading.text}", line ${heading.line}). The docs site renders anchors only for H2 and H3, so the link lands at the top of the page. Fix: link the nearest H2 or H3 section that contains it, or raise the heading to H3.`,
      })
    );
  }
  return findings;
}

module.exports = { checkAnchorHeadingLevel, MAX_ANCHOR_LEVEL };
