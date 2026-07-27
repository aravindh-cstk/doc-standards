'use strict';

const { makeFinding } = require('../lib/report');

const BARE_LINK_SECTIONS = {
  'Next Steps': 'C1-06',
  'Role-Based Routing Table': 'RS1-04',
  'Documentation Map': 'RS1-04',
};

/** Tier 1: no bare links (a bullet that is only a link, no description) in Next Steps, Routing Table, or Documentation Map. */
function checkNextStepsLinks(doc) {
  const findings = [];

  for (const [sectionName, ruleId] of Object.entries(BARE_LINK_SECTIONS)) {
    const section = doc.findSection([sectionName]);
    if (!section) continue;

    const links = doc.linksInRange(section.line + 1, section.endLine);
    for (const link of links) {
      if (link.isBare) {
        findings.push(
          makeFinding({
            tier: 1,
            ruleId,
            checkId: 'bare-links',
            line: link.line,
            section: sectionName,
            message: `Bare link to "${link.url}" in ${sectionName} has no trailing description.`,
          })
        );
      }
    }
  }

  return findings;
}

module.exports = { checkNextStepsLinks };
