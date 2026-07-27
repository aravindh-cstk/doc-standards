'use strict';

const { makeFinding } = require('../lib/report');

const ROUTING_COLUMNS = ['i want to...', 'i am...', 'start here'];
const TIME_ESTIMATE_RE = /estimated time:/i;

/** Tier 1, getting-started only: Routing Table position/columns, Quick Start step count and time estimate. */
function checkGettingStartedSpecific(doc, docType) {
  const findings = [];
  if (docType !== 'getting-started') return findings;

  const overview = doc.findSection(['Overview']);
  const routing = doc.findSection(['Role-Based Routing Table']);
  if (overview && routing) {
    const topLevel = doc.topLevelSections();
    const overviewIdx = topLevel.findIndex((s) => s.line === overview.line);
    const routingIdx = topLevel.findIndex((s) => s.line === routing.line);
    if (routingIdx !== overviewIdx + 1) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'RS1-01',
          checkId: 'getting-started-specific',
          line: routing.line,
          section: 'Role-Based Routing Table',
          message: 'Role-Based Routing Table must come immediately after Overview.',
        })
      );
    }
  }

  if (routing) {
    const tables = doc.tablesInRange(routing.line + 1, routing.endLine);
    if (tables.length === 0) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'RS1-02',
          checkId: 'getting-started-specific',
          line: routing.line,
          section: 'Role-Based Routing Table',
          message: 'Role-Based Routing Table has no table.',
        })
      );
    } else {
      const headers = tables[0].headerCells.map((c) => c.trim().toLowerCase());
      const missing = ROUTING_COLUMNS.filter((col) => !headers.includes(col));
      if (missing.length > 0) {
        findings.push(
          makeFinding({
            tier: 1,
            ruleId: 'RS1-02',
            checkId: 'getting-started-specific',
            line: tables[0].startLine,
            section: 'Role-Based Routing Table',
            message: `Role-Based Routing Table is missing required column(s): ${missing.join(', ')}.`,
          })
        );
      }
    }
  }

  const quickStart = doc.findSection(['Quick Start']);
  if (quickStart) {
    const body = doc.rawText(quickStart.line, quickStart.endLine);
    if (!TIME_ESTIMATE_RE.test(body)) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'RS2-02',
          checkId: 'getting-started-specific',
          line: quickStart.line,
          section: 'Quick Start',
          message: 'Quick Start is missing an "Estimated time: X minutes" statement.',
        })
      );
    }

    const items = doc.listItemsInRange(quickStart.line + 1, quickStart.endLine);
    const topLevelSteps = items.filter((item) => item.ordered && item.indent === 0);
    const stepCount = topLevelSteps.length > 0 ? topLevelSteps.length : items.filter((item) => item.ordered).length;
    if (stepCount > 10) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'RS2-04',
          checkId: 'getting-started-specific',
          line: quickStart.line,
          section: 'Quick Start',
          message: `Quick Start has ${stepCount} steps, must be 10 or fewer.`,
        })
      );
    }
  }

  return findings;
}

module.exports = { checkGettingStartedSpecific };
