'use strict';

/**
 * C1-07, tier 1: a page under a troubleshooting hub keeps only a pointer.
 *
 * The MCP docs held troubleshooting entries on five pages until the review moved
 * all 52 of them onto one hub. A page-level copy goes stale in every place it was
 * copied, so once a hub exists the page's Troubleshooting section is one line
 * that links to it. Keeping the H2 keeps every existing #troubleshooting link
 * working.
 *
 * Hubs and the pages they cover live in data/troubleshooting-hubs.json, keyed by
 * the page's `url:` front matter. The CLI hub is enforced separately by CLI-19.
 */

const { makeFinding } = require('../lib/report');
const HUB_DATA = require('../data/troubleshooting-hubs.json');

const LABEL_RE = /^\s*\*\*\s*(?:Root causes?|Possible causes?|Resolution)\s*:?\s*\*\*/i;

/** The hub whose scope covers this page, or null. The hub page itself is never in scope. */
function hubFor(doc) {
  const keys = (doc.frontMatter && doc.frontMatter.keys) || {};
  const url = String(keys.url || keys.slug || '').replace(/^["']|["']$/g, '').trim();
  if (!url) return null;
  return (
    HUB_DATA.hubs.find((h) => url !== h.hubUrl && h.scope.some((s) => new RegExp(s).test(url))) || null
  );
}

function linksToHub(doc, section, hub) {
  const hubPath = hub.hubUrl.replace(/^\//, '');
  return doc
    .linksInRange(section.line, section.endLine)
    .some((l) => String(l.url).replace(/^https?:\/\/[^/]+/, '').replace(/^\/?(?:docs\/)?/, '').startsWith(hubPath));
}

function checkTroubleshootingHubPointer(doc) {
  const hub = hubFor(doc);
  if (!hub) return [];
  const findings = [];
  for (const section of doc.sections.filter((s) => s.level === 2 && /^troubleshooting$/i.test(s.text.trim()))) {
    const problems = [];
    const entries = doc.headings.filter((h) => h.line > section.line && h.line <= section.endLine);
    if (entries.length) problems.push(`${entries.length} entry heading(s), first "${entries[0].text}" at line ${entries[0].line}`);
    const labels = doc
      .proseLineNumbers(section.line + 1, section.endLine)
      .filter((n) => LABEL_RE.test(String(doc.lines[n - 1])));
    if (labels.length) problems.push(`Root cause or Resolution labels at line ${labels.join(', ')}`);
    if (!linksToHub(doc, section, hub)) problems.push(`no link to the hub ${hub.hubUrl}`);
    if (!problems.length) continue;
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'C1-07',
        checkId: 'troubleshooting-hub-pointer',
        line: section.line,
        section: section.text,
        message: `${hub.product} keeps its troubleshooting on ${hub.hubUrl}, but this section has ${problems.join(', and ')}. Fix: move each entry to the hub, and leave one Additional Resource callout that links to the matching hub category.`,
      })
    );
  }
  return findings;
}

module.exports = { checkTroubleshootingHubPointer, hubFor };
