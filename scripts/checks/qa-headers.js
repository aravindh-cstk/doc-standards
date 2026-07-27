'use strict';

const { makeFinding } = require('../lib/report');

const FAQ_SECTION_NAMES = ['faq', 'frequently asked questions', 'common questions'];

function isInsideFaqSection(heading, allSections) {
  for (const section of allSections) {
    if (FAQ_SECTION_NAMES.includes(section.text.trim().toLowerCase())) {
      if (heading.line >= section.line && heading.line <= section.endLine) return true;
    }
  }
  return false;
}

/** Tier 1: no question-form headings outside a dedicated FAQ section. */
function checkQaHeaders(doc) {
  const findings = [];
  for (const heading of doc.headings) {
    if (!heading.text.trim().endsWith('?')) continue;
    if (isInsideFaqSection(heading, doc.sections)) continue;
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'C3-02',
        checkId: 'qa-headers',
        line: heading.line,
        section: heading.text,
        message: `Question-form heading "${heading.text}" found outside a dedicated FAQ section.`,
      })
    );
  }
  return findings;
}

module.exports = { checkQaHeaders };
