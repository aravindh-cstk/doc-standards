'use strict';

const { byId } = require('./rules-registry');

/**
 * A single Finding: {tier, ruleId, checkId, message, line, section, falsePositiveNote}.
 * tier 1 findings are hard errors, tier 2 are always advisory.
 */
function makeFinding({ tier, ruleId, checkId, message, line, section, falsePositiveNote }) {
  return { tier, ruleId, checkId, message, line: line || null, section: section || null, falsePositiveNote: falsePositiveNote || null };
}

function manualReviewQueue(docType) {
  const { forDocType } = require('./rules-registry');
  return forDocType(docType).filter((r) => r.tier === 3);
}

function buildReport(filePath, docType, findings) {
  const tier1 = findings.filter((f) => f.tier === 1);
  const tier2 = findings.filter((f) => f.tier === 2);
  const queue = manualReviewQueue(docType);
  return {
    file: filePath,
    type: docType,
    automatedFindings: tier1,
    flagged: tier2,
    manualReviewQueue: queue,
    summary: { errors: tier1.length, warnings: tier2.length, manualReviewItems: queue.length },
  };
}

function ruleLine(ruleId) {
  const rule = byId(ruleId);
  if (!rule) return `[${ruleId}]`;
  return `[${ruleId}] ${rule.rule}`;
}

function renderText(report) {
  const lines = [];
  lines.push(`Doc-standards lint: ${report.file}`);
  lines.push(`Type: ${report.type}`);
  lines.push(
    `Summary: ${report.summary.errors} error(s), ${report.summary.warnings} flagged, ${report.summary.manualReviewItems} manual review item(s)`
  );
  lines.push('');

  lines.push(`Automated Findings (${report.automatedFindings.length})`);
  lines.push('-'.repeat(60));
  if (report.automatedFindings.length === 0) {
    lines.push('None.');
  } else {
    for (const f of report.automatedFindings) {
      lines.push(`${f.line ? `L${f.line}` : '(no line)'} ${f.section ? `[${f.section}] ` : ''}${f.message}`);
      lines.push(`  Rule: ${ruleLine(f.ruleId)}`);
    }
  }
  lines.push('');

  lines.push(`Flagged for Review (${report.flagged.length}, non-blocking)`);
  lines.push('-'.repeat(60));
  if (report.flagged.length === 0) {
    lines.push('None.');
  } else {
    for (const f of report.flagged) {
      lines.push(`${f.line ? `L${f.line}` : '(no line)'} ${f.section ? `[${f.section}] ` : ''}${f.message}`);
      lines.push(`  Rule: ${ruleLine(f.ruleId)}`);
      if (f.falsePositiveNote) lines.push(`  Possible false positive: ${f.falsePositiveNote}`);
    }
  }
  lines.push('');

  lines.push(`Manual Review Queue (${report.manualReviewQueue.length}, requires reading comprehension)`);
  lines.push('-'.repeat(60));
  for (const r of report.manualReviewQueue) {
    lines.push(`[${r.id}] ${r.rule}`);
    lines.push(`  Why: ${r.why}`);
    if (r.exception && r.exception !== 'None.') lines.push(`  Exception: ${r.exception}`);
  }

  return lines.join('\n');
}

module.exports = { makeFinding, buildReport, renderText };
