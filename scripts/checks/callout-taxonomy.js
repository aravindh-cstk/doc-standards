'use strict';

const { makeFinding } = require('../lib/report');

const CLI_TYPES = ['cli-command-reference', 'cli-task-runbook', 'cli-module-reference', 'cli-plugin-guide'];

/**
 * The closed label set, per C2-11.
 *
 * `additional resources` is here as well as the singular because AR-06 requires
 * the plural whenever the callout carries two or more links, and
 * api-ref-structure.js enforces that agreement in both directions. Listing only
 * the singular made the spelling AR-06 mandates a tier-1 C2-11 error, on a
 * callout that was correct. Number agreement belongs to AR-06, which owns it.
 * This set owns only which words may appear.
 *
 * No other label takes a plural. `Notes` is not a label.
 *
 * `before you begin` is here because UG-09 is tier 1 and requires exactly that
 * blockquote on an api-ref usage guide, with api-ref-structure.js matching the
 * literal label. Leaving it out put two tier-1 rules in direct contradiction,
 * which stayed hidden only because lint-api-ref.js does not run this check.
 */
const ALLOWED_LABELS = new Set([
  'warning',
  'note',
  'tip',
  'additional resource',
  'additional resources',
  'before you begin',
]);

/**
 * Both spellings of a blockquote label, captured separately so the check can
 * tell them apart:
 *
 *   > **Note:**   the compliant form, colon inside the bold
 *   > **Note**:   the drift form CLI-C7 bans
 *
 * Matching only the first form meant the second matched nothing, so it reported
 * neither C2-11 (the label set was never reached) nor CLI-09 (the rule that
 * exists for this exact spelling).
 */
const LABEL_COLON_INSIDE_RE = /^>\s*\*\*([^*:]+):\*\*/;
const LABEL_COLON_OUTSIDE_RE = /^>\s*\*\*([^*:]+)\*\*\s*:/;

/** Tier 1: a callout uses one of the labels C2-11 permits. Tier 2: a CLI doc puts the colon inside the bold, per CLI-09. */
function checkCalloutTaxonomy(doc, docType, isCli) {
  const findings = [];
  const cliApplies = CLI_TYPES.includes(docType) || Boolean(isCli);

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];

    const inside = raw.match(LABEL_COLON_INSIDE_RE);
    const outside = inside ? null : raw.match(LABEL_COLON_OUTSIDE_RE);
    const match = inside || outside;
    if (!match) continue;

    const label = match[1].trim();
    if (!ALLOWED_LABELS.has(label.toLowerCase())) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C2-11',
          checkId: 'callout-taxonomy',
          line: lineNo,
          message: `Callout uses label "${label}", which is not one of the four allowed labels (Warning, Note, Tip, Additional Resource). Use the plural "Additional Resources" only when the callout carries two or more links, per AR-06.`,
        })
      );
    }

    // Colon placement is a CLI convention, so reporting it on a prose doc would
    // invent a rule the registry does not hold.
    if (outside && cliApplies) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'CLI-09',
          checkId: 'callout-taxonomy',
          line: lineNo,
          message: `Callout label "${label}" puts the colon outside the bold. Write "> **${label}:**", with the colon inside, per CLI-C7.`,
        })
      );
    }
  }
  return findings;
}

module.exports = { checkCalloutTaxonomy };
