'use strict';

const { makeFinding } = require('../lib/report');
const { compareOrder } = require('../lib/section-index');

/** Sections that are exclusive to Get Started Guides and never valid elsewhere. */
const GET_STARTED_ONLY = ['quick start', 'role-based routing table', 'documentation map', 'table of contents'];

/** Sections migration guides must not contain. */
const MIGRATION_FORBIDDEN = ['theory sections', 'theory'];

/** Sections Get Started Guides must not contain. */
const GET_STARTED_FORBIDDEN = ['theory sections', 'theory', 'troubleshooting'];

/**
 * No CLI doc carries a page-level Troubleshooting section at all, regardless of
 * which type it is checked against. `cli-module-reference` never had one (MOD3).
 * `cli-command-reference` and `cli-task-runbook` had one Required, then
 * Recommended, then removed outright: the corpus has a dedicated troubleshooting
 * hub (CLI-C14), and a page-level section duplicates content that goes stale
 * wherever it is copied.
 *
 * This has to key off `isCli`, not off `docType`, because four CLI docs are
 * deliberately typed under a product-wide template rather than one of the four
 * CLI types: `Install the CLI` reuses `setup-guide`, `CLI for CS Assets` and
 * `Asset Scanning in CLI` reuse `feature-doc`, and `Migrate from Contentstack CLI
 * V1 to V2` reuses `migration-guide`. Those templates still require
 * Troubleshooting for the non-CLI docs that use them, so the exemption is scoped
 * to a doc the platform actually renders as CLI content, not to a type name.
 */
const CLI_FORBIDDEN = ['troubleshooting'];

function forbiddenSectionsFor(docType, isCli) {
  if (docType === 'getting-started') return [];
  const forbidden = [...GET_STARTED_ONLY];
  if (docType === 'migration-guide') forbidden.push(...MIGRATION_FORBIDDEN);
  if (isCli) forbidden.push(...CLI_FORBIDDEN);
  return forbidden;
}

/** Tier 1: required section presence, order vs section-order.json, and forbidden sections for the doc type. */
function checkSectionStructure(doc, docType, isCli) {
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
      // A CLI doc typed under a product-wide template (setup-guide, feature-doc,
      // migration-guide) still has Troubleshooting Required in that template's
      // own section-order.json row. CLI-C14 overrides that for any CLI doc,
      // whatever type it is checked against, so this one section is skipped here
      // rather than reported as missing.
      if (isCli && row.section.toLowerCase() === 'troubleshooting') continue;
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

  const forbidden = forbiddenSectionsFor(docType, isCli);
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
        let ruleId = 'C1-01';
        let message = `"${section.text}" is a Get Started Guide-only or forbidden section for a ${docType}.`;
        if (MIGRATION_FORBIDDEN.includes(lower)) {
          ruleId = 'MIG-08';
        } else if (isCli && CLI_FORBIDDEN.includes(lower)) {
          ruleId = 'CLI-19';
          message = `"${section.text}" is not carried on a CLI doc. Link the troubleshooting hub instead, per CLI-C14.`;
        }
        findings.push(
          makeFinding({
            tier: 1,
            ruleId,
            checkId: 'section-structure',
            line: section.line,
            section: section.text,
            message,
          })
        );
      }
    }
  }

  return findings;
}

module.exports = { checkSectionStructure };
