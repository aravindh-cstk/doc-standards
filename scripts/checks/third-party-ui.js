'use strict';

/**
 * C5-07 (tier 1) and C4-09 (tier 2): instructions for a third-party product's UI.
 *
 * The MCP Profile Hub review found ChatGPT steps that quoted the vendor's own
 * menu ("Settings > Connectors"), its button ("Add custom connector") and its
 * plan names, and a request to link OpenAI's help page. All of it goes stale the
 * day the vendor ships a redesign, and nothing in the doc set would notice.
 *
 * The split by tier follows how certain the signal is:
 *
 *   C5-07, tier 1. A link to a vendor help host is never needed, and a menu path
 *   beside a vendor name is never Contentstack's own UI. Both are exact.
 *
 *   C4-09, tier 2. A bold label or a plan name beside a vendor name is usually the
 *   vendor's UI, but Contentstack names its own install tabs after clients ("the
 *   **Claude Desktop Manual** tab"). A bold label that contains the vendor name
 *   is skipped for that reason, and the rest go to review and to the judge.
 *
 * "Beside a vendor name" means the vendor is named on the line, in the heading of
 * the section the line sits in, or in the lead-in a few lines above a numbered
 * step, because step 2 of a ChatGPT procedure rarely repeats the word ChatGPT.
 */

const { makeFinding } = require('../lib/report');
const { byId } = require('../lib/rules-registry');
const VENDOR_DATA = require('../data/third-party/vendors.json');

const INLINE_CODE_RE = /`[^`]*`/g;
const LINK_RE = /\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)/g;
const HEADING_RE = /^\s*#{1,6}\s/;
const LEAD_IN_LOOKBACK = 4;

// "**Settings > Connectors**", "**Settings** > **Connectors**", or a plain
// "Settings > Connectors" made of capitalized words. A blockquote marker at
// the start of a line has no word in front of it, so it never matches.
const MENU_PATH_RES = [
  /\*\*[^*]+?\s(?:>|→|›|->)\s[^*]+?\*\*/,
  /\*\*[^*]+\*\*\s*(?:>|→|›|->)\s*\*\*[^*]+\*\*/,
  /\b[A-Z][\w-]*(?: [A-Z][\w-]*)*\s(?:>|→|›)\s[A-Z][\w-]*/,
];
const BOLD_RE = /\*\*([^*]+)\*\*/g;
// Bold text that is house structure rather than a quoted UI label: a callout or
// troubleshooting label, or a bold lead-in that ends in a colon or a period.
const HOUSE_BOLD_RE = /[:.]\s*$|^(?:Note|Tip|Warning|Important|Additional Resources?|Root Causes?|Possible causes?|Resolution|Applies to)\b/i;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ALIASES = VENDOR_DATA.vendors.flatMap((v) => v.aliases);
const VENDOR_RE = new RegExp(`\\b(?:${ALIASES.map(escapeRe).join('|')})\\b`);
const PLAN_RE = new RegExp(
  `\\b(?:${ALIASES.map(escapeRe).join('|')})\\s+(?:${VENDOR_DATA.planNames.join('|')})\\b|\\b(?:${VENDOR_DATA.planNames.join('|')}) plan\\b`
);
const HELP_HOSTS = VENDOR_DATA.vendors.flatMap((v) => v.helpHosts);
const ALLOWED_HOSTS = VENDOR_DATA.allowedReferences.hosts;

function prose(raw) {
  return String(raw).replace(INLINE_CODE_RE, (m) => ' '.repeat(m.length));
}

/** The vendor names in scope for a line: on the line, in its section heading, or in a lead-in just above. */
function vendorContext(doc, lineNo) {
  const found = new Set();
  const add = (text) => {
    const re = new RegExp(VENDOR_RE.source, 'g');
    for (const m of prose(text).matchAll(re)) found.add(m[0]);
  };
  add(doc.lines[lineNo - 1]);
  const section = [...doc.sections].reverse().find((s) => s.line <= lineNo && s.endLine >= lineNo);
  if (section) add(section.text);
  for (let n = lineNo - 1; n >= Math.max(doc.bodyStartLine, lineNo - LEAD_IN_LOOKBACK); n--) {
    const raw = String(doc.lines[n - 1]);
    if (HEADING_RE.test(raw)) break;
    add(raw);
  }
  return [...found];
}

/** The help host a URL points at, or null. A URL on an allowed reference host is never a help link. */
function helpHostOf(url) {
  const bare = String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (ALLOWED_HOSTS.some((h) => bare === h || bare.startsWith(`${h}/`))) return null;
  return HELP_HOSTS.find((h) => bare === h || bare.startsWith(`${h}/`) || bare.startsWith(`${h}?`)) || null;
}

function checkThirdPartyUi(doc) {
  const findings = [];
  const looseTier = byId('C4-09').tier;

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = String(doc.lines[lineNo - 1]);
    if (!raw.trim()) continue;

    for (const m of raw.matchAll(LINK_RE)) {
      const host = helpHostOf(m[2]);
      if (!host) continue;
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C5-07',
          checkId: 'third-party-ui',
          line: lineNo,
          message: `Link to a third-party help page (${host}): "${m[1]}". The vendor can move or rewrite it without notice. Fix: remove the link and point the reader to the client's own documentation in words.`,
        })
      );
    }

    const vendors = vendorContext(doc, lineNo);
    if (!vendors.length) continue;
    const text = prose(raw).replace(LINK_RE, (m, label) => `[${label}]`);

    const menu = MENU_PATH_RES.map((re) => re.exec(text)).find(Boolean);
    if (menu) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C5-07',
          checkId: 'third-party-ui',
          line: lineNo,
          message: `Menu path "${menu[0].trim()}" in instructions for ${vendors.join(', ')}. The vendor can rename any step of the path. Fix: describe the capability, for example "add a custom connector in the client's settings".`,
        })
      );
      continue;
    }

    const plan = PLAN_RE.exec(text);
    if (plan) {
      findings.push(
        makeFinding({
          tier: looseTier,
          ruleId: 'C4-09',
          checkId: 'third-party-ui',
          line: lineNo,
          message: `Vendor plan name "${plan[0]}" in instructions for ${vendors.join(', ')}. Plans are renamed and repriced without notice. Fix: say that the client's plan can limit the feature, without naming the plan.`,
          falsePositiveNote: 'A plan name that Contentstack itself sells, such as a Contentstack plan tier, is not a vendor plan. Confirm the plan belongs to the third-party product.',
        })
      );
    }

    for (const b of text.matchAll(BOLD_RE)) {
      const label = b[1].trim();
      if (HOUSE_BOLD_RE.test(label) || VENDOR_RE.test(label)) continue;
      findings.push(
        makeFinding({
          tier: looseTier,
          ruleId: 'C4-09',
          checkId: 'third-party-ui',
          line: lineNo,
          message: `Bold UI label "${label}" in instructions for ${vendors.join(', ')}. If the vendor renames it, the step no longer matches the screen. Fix: describe the action generically, for example "add a custom connector" rather than quoting the button.`,
          falsePositiveNote: 'A bold label is correct when it names a Contentstack screen or tab, even beside a vendor name. The judge (judges/judge-editorial.js) decides which UI the label belongs to.',
        })
      );
    }
  }

  return findings;
}

module.exports = { checkThirdPartyUi, vendorContext, helpHostOf, VENDOR_RE };
