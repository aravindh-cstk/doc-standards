'use strict';

const { makeFinding } = require('../lib/report');
const { compareOrder } = require('../lib/section-index');

/** Sections that are exclusive to Get Started Guides and never valid elsewhere. */
const GET_STARTED_ONLY = ['quick start', 'role-based routing table', 'documentation map', 'table of contents'];

/** Sections migration guides must not contain. */
const MIGRATION_FORBIDDEN = ['theory sections', 'theory'];

/** Sections Get Started Guides must not contain. */
const GET_STARTED_FORBIDDEN = ['theory sections', 'theory', 'troubleshooting'];

function forbiddenSectionsFor(docType) {
  if (docType === 'getting-started') return [];
  const forbidden = [...GET_STARTED_ONLY];
  if (docType === 'migration-guide') forbidden.push(...MIGRATION_FORBIDDEN);
  return forbidden;
}

/** Tier 1: required section presence, order vs section-order.json, and forbidden sections for the doc type. */
function checkSectionStructure(doc, docType) {
  const findings = [];
  const topLevel = doc.topLevelSections();
  const topLevelText = topLevel.map((s) => s.text);

  if (!doc.headings.some((h) => h.level === 1)) {
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'C1-01',
        checkId: 'section-structure',
        message: 'No page title (H1 heading) found.',
      })
    );
  }

  const comparison = compareOrder(topLevelText, docType);
  if (comparison) {
    for (const row of comparison.missing) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C1-01',
          checkId: 'section-structure',
          message: `Required section "${row.section}" is missing.`,
        })
      );
    }
    for (const pair of comparison.outOfOrder) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C1-02',
          checkId: 'section-structure',
          message: `Section "${pair.before}" must come before "${pair.after}" per the ${docType} section order.`,
        })
      );
    }
  }

  const forbidden = forbiddenSectionsFor(docType);
  if (docType === 'getting-started') {
    for (const section of topLevel) {
      const lower = section.text.trim().toLowerCase();
      if (GET_STARTED_FORBIDDEN.includes(lower)) {
        const ruleId = lower === 'troubleshooting' ? 'RS3-02' : 'RS3-01';
        findings.push(
          makeFinding({
            tier: 1,
            ruleId,
            checkId: 'section-structure',
            line: section.line,
            section: section.text,
            message: `Get Started Guides must not include a "${section.text}" section. See ${ruleId}.`,
          })
        );
      }
    }
  } else {
    for (const section of topLevel) {
      const lower = section.text.trim().toLowerCase();
      if (forbidden.includes(lower)) {
        const ruleId = MIGRATION_FORBIDDEN.includes(lower) ? 'MIG-08' : 'C1-01';
        findings.push(
          makeFinding({
            tier: 1,
            ruleId,
            checkId: 'section-structure',
            line: section.line,
            section: section.text,
            message: `"${section.text}" is a Get Started Guide-only or forbidden section for a ${docType}.`,
          })
        );
      }
    }
  }

  return findings;
}

module.exports = { checkSectionStructure };
