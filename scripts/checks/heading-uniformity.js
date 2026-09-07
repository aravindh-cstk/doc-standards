'use strict';

const { makeFinding } = require('../lib/report');
const { directChildren } = require('../lib/parse-markdown');

const CHANGE_KEYWORD_RE = /removed|renamed|deprecated|hidden|short character|alias/i;

/** Tier 2: sibling sections with a single, differently-worded child heading documenting the same category of change (flag/alias removal) should share one canonical heading. */
function checkHeadingUniformity(doc) {
  const findings = [];
  const lonelyMatches = [];

  for (const section of doc.sections) {
    const children = directChildren(section, doc.sections);
    if (children.length !== 1) continue;
    const child = children[0];
    if (CHANGE_KEYWORD_RE.test(child.text)) {
      lonelyMatches.push(child);
    }
  }

  if (lonelyMatches.length < 2) return findings;

  const counts = new Map();
  for (const child of lonelyMatches) {
    const key = child.text.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let canonical = null;
  let canonicalCount = 0;
  for (const [key, count] of counts) {
    if (count > canonicalCount) {
      canonical = key;
      canonicalCount = count;
    }
  }
  if (canonicalCount < 2) return findings;

  for (const child of lonelyMatches) {
    if (child.text.toLowerCase() !== canonical) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C6-06',
          checkId: 'heading-uniformity',
          line: child.line,
          message: `Heading "${child.text}" documents the same category of change as ${canonicalCount} other sections using "${canonical}". Consider a shared heading name.`,
          falsePositiveNote: 'May be a genuinely unique behavior change, not a recurring structural category, per the exception in common-rules.md.',
        })
      );
    }
  }
  return findings;
}

module.exports = { checkHeadingUniformity };
