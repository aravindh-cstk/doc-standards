'use strict';

const { makeFinding } = require('../lib/report');

const ROOT_CAUSE_RE = /\*\*Root Cause\(s\)\*\*/;
const RESOLUTION_RE = /\*\*Resolution\*\*/;

/** Tier 1: each Troubleshooting H3 entry has bolded Root Cause(s) then Resolution labels, in order. */
function checkTroubleshootingFormat(doc) {
  const findings = [];
  const troubleshooting = doc.findSection(['Troubleshooting']);
  if (!troubleshooting) return findings;

  const entries = doc.sections.filter(
    (s) => s.level === troubleshooting.level + 1 && s.line > troubleshooting.line && s.endLine <= troubleshooting.endLine
  );

  for (const entry of entries) {
    const body = doc.rawText(entry.line + 1, entry.endLine);
    const rootCauseMatch = body.match(ROOT_CAUSE_RE);
    const resolutionMatch = body.match(RESOLUTION_RE);

    if (!rootCauseMatch) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C1-05',
          checkId: 'troubleshooting-format',
          line: entry.line,
          section: entry.text,
          message: `Troubleshooting entry "${entry.text}" is missing a bolded **Root Cause(s)** label.`,
        })
      );
    }
    if (!resolutionMatch) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C1-05',
          checkId: 'troubleshooting-format',
          line: entry.line,
          section: entry.text,
          message: `Troubleshooting entry "${entry.text}" is missing a bolded **Resolution** label.`,
        })
      );
    }
    if (rootCauseMatch && resolutionMatch && rootCauseMatch.index > resolutionMatch.index) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C1-05',
          checkId: 'troubleshooting-format',
          line: entry.line,
          section: entry.text,
          message: `Troubleshooting entry "${entry.text}" has Resolution before Root Cause(s), expected order is Root Cause(s) then Resolution.`,
        })
      );
    }
  }

  return findings;
}

module.exports = { checkTroubleshootingFormat };
