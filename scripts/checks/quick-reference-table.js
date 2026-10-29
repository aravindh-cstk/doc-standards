'use strict';

const { makeFinding } = require('../lib/report');

/**
 * The three-column shape the Section Definitions in doc-templates/feature-docs/common-rules.md
 * describe: Use Case, Section, Key Call.
 */
const QUICK_REFERENCE_COLUMNS = ['use case', 'section', 'key call'];

/**
 * Per-type overrides, because a type file overrides common-rules.md for its own
 * type. cli-module-reference is the one type whose Quick Reference has a
 * different job: MOD2 asks for an index mapping each module or command to its
 * section anchor, not a task-to-call map. Applying the generic triple to it
 * reported a tier-1 C2-04 on a table built exactly to its own template, which
 * is the one shape that cannot be wrong.
 *
 * The Section column stays required here, because the anchor requirement is
 * what C2-04 actually states and MOD2 asks for the same thing.
 */
const QUICK_REFERENCE_COLUMNS_BY_TYPE = {
  'cli-module-reference': ['section'],
};

const QUICK_DECISION_COLUMNS = ['approach', 'key configuration value', 'reason'];

function quickReferenceColumnsFor(docType) {
  return QUICK_REFERENCE_COLUMNS_BY_TYPE[docType] || QUICK_REFERENCE_COLUMNS;
}

function normalizeHeader(cell) {
  return cell.trim().toLowerCase();
}

function checkColumns(doc, sectionName, expectedColumns, ruleId, requireSectionAnchor) {
  const findings = [];
  const section = doc.findSection([sectionName]);
  if (!section) return findings;

  const tables = doc.tablesInRange(section.line + 1, section.endLine);
  if (tables.length === 0) {
    findings.push(
      makeFinding({
        tier: 1,
        ruleId,
        checkId: 'quick-reference-table',
        line: section.line,
        section: sectionName,
        message: `${sectionName} section has no table.`,
      })
    );
    return findings;
  }

  const table = tables[0];
  const headers = table.headerCells.map(normalizeHeader);
  const missingColumns = expectedColumns.filter((col) => !headers.includes(col));
  if (missingColumns.length > 0) {
    findings.push(
      makeFinding({
        tier: 1,
        ruleId,
        checkId: 'quick-reference-table',
        line: table.startLine,
        section: sectionName,
        message: `${sectionName} table is missing required column(s): ${missingColumns.join(', ')}.`,
      })
    );
  }

  if (requireSectionAnchor) {
    const sectionColIdx = headers.indexOf('section');
    if (sectionColIdx !== -1) {
      table.rows.forEach((row, rowIdx) => {
        const cell = row[sectionColIdx] || '';
        if (!/\]\(#[^)]+\)/.test(cell)) {
          findings.push(
            makeFinding({
              tier: 1,
              ruleId: 'C2-04',
              checkId: 'quick-reference-table',
              line: table.startLine + rowIdx + 2,
              section: sectionName,
              message: `Quick Reference row ${rowIdx + 1}'s Section cell does not contain a section-anchor link.`,
            })
          );
        }
      });
    }
  }

  return findings;
}

/** Tier 1: Quick Reference and Quick Decision Guide tables have their required columns, Quick Reference Section cells link to an anchor. */
function checkQuickReferenceTable(doc, docType) {
  return [
    ...checkColumns(doc, 'Quick Reference', quickReferenceColumnsFor(docType), 'C2-04', true),
    ...checkColumns(doc, 'Quick Decision Guide', QUICK_DECISION_COLUMNS, 'C1-02', false),
  ];
}

module.exports = { checkQuickReferenceTable };
