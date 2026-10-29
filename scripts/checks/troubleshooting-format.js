'use strict';

const { makeFinding } = require('../lib/report');

// common-rules.md specifies **Root Cause** for a single cause and **Root Causes**
// for several. The **Root Cause(s)** spelling is not valid and must not match.
const ROOT_CAUSE_RE = /\*\*Root Causes?\*\*/;
const RESOLUTION_RE = /\*\*Resolution\*\*/;

/** Tier 1: each Troubleshooting H3 entry has a bolded Root Cause or Root Causes label, then Resolution, in order. */
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
          message: `Troubleshooting entry "${entry.text}" is missing a bolded **Root Cause** label (use **Root Causes** when there are several).`,
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
          message: `Troubleshooting entry "${entry.text}" has Resolution before the root cause, expected order is Root Cause then Resolution.`,
        })
      );
    }
  }

  return findings;
}

module.exports = { checkTroubleshootingFormat };
