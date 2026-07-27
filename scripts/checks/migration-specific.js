'use strict';

const { makeFinding } = require('../lib/report');

const TYPE_MAPPING_COLUMNS = ['area', 'old api', 'new api'];

/** Tier 1, migration-guide only: Type Mapping Reference columns, Pre-Upgrade Checklist is a numbered list. */
function checkMigrationSpecific(doc, docType) {
  const findings = [];
  if (docType !== 'migration-guide') return findings;

  const typeMapping = doc.findSection(['Type Mapping Reference']);
  if (typeMapping) {
    const tables = doc.tablesInRange(typeMapping.line + 1, typeMapping.endLine);
    if (tables.length === 0) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'MIG-04',
          checkId: 'migration-specific',
          line: typeMapping.line,
          section: 'Type Mapping Reference',
          message: 'Type Mapping Reference section has no table.',
        })
      );
    } else {
      const headers = tables[0].headerCells.map((c) => c.trim().toLowerCase());
      const missing = TYPE_MAPPING_COLUMNS.filter((col) => !headers.some((h) => h.includes(col)));
      if (missing.length > 0) {
        findings.push(
          makeFinding({
            tier: 1,
            ruleId: 'MIG-04',
            checkId: 'migration-specific',
            line: tables[0].startLine,
            section: 'Type Mapping Reference',
            message: `Type Mapping Reference table is missing required column(s): ${missing.join(', ')}.`,
          })
        );
      }
    }
  }

  const preUpgrade = doc.findSection(['Pre-Upgrade Checklist']);
  if (preUpgrade) {
    const items = doc.listItemsInRange(preUpgrade.line + 1, preUpgrade.endLine);
    if (items.length === 0) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'MIG-06',
          checkId: 'migration-specific',
          line: preUpgrade.line,
          section: 'Pre-Upgrade Checklist',
          message: 'Pre-Upgrade Checklist has no list items.',
        })
      );
    } else if (!items.every((item) => item.ordered)) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'MIG-06',
          checkId: 'migration-specific',
          line: items.find((item) => !item.ordered).line,
          section: 'Pre-Upgrade Checklist',
          message: 'Pre-Upgrade Checklist must be a numbered (ordered) list.',
        })
      );
    }
  }

  return findings;
}

module.exports = { checkMigrationSpecific };
