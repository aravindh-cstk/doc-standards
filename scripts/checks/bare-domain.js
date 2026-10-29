'use strict';

/**
 * C5-09: a bare domain name in prose, such as claude.ai.
 *
 * Markdown converters with auto-linking turn a bare domain into a live link that
 * nobody wrote. The MCP Profile Hub pages mentioned "claude.ai" as the name of a
 * web app, the docs converter linked it, and a vendor link reached staging that
 * the rules about vendor links were supposed to keep out. Code formatting keeps
 * the name as text. A real link has to be written as one, on purpose.
 *
 * Only a token ending in a web TLD from DOMAIN_TLDS counts, so Node.js,
 * package.json and README.md never match. Code spans, link text and targets,
 * HTML tags and full URLs are masked first. An email address is skipped.
 */

const { makeFinding } = require('../lib/report');
const { byId } = require('../lib/rules-registry');

const DOMAIN_TLDS = ['com', 'ai', 'io', 'net', 'org', 'dev', 'app', 'co'];
const DOMAIN_RE = new RegExp(
  `(?<![\\w@/.:-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${DOMAIN_TLDS.join('|')})(?![\\w-]|\\.[a-z0-9])`,
  'gi'
);
const MASKS = [/`[^`]*`/g, /!?\[[^\]]*\]\([^)]*\)/g, /<[^>]+>/g, /https?:\/\/[^\s)>\]]+/g];

function maskLine(raw) {
  let out = String(raw);
  for (const re of MASKS) out = out.replace(re, (m) => ' '.repeat(m.length));
  return out;
}

function checkBareDomain(doc) {
  const findings = [];
  const tier = byId('C5-09').tier;
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const domains = [...new Set(maskLine(doc.lines[lineNo - 1]).match(DOMAIN_RE) || [])];
    if (!domains.length) continue;
    findings.push(
      makeFinding({
        tier,
        ruleId: 'C5-09',
        checkId: 'bare-domain',
        line: lineNo,
        message: `Bare domain ${domains.map((d) => `"${d}"`).join(', ')} in prose. A converter with auto-linking turns it into a link nobody chose. Fix: write it as code (\`${domains[0]}\`), or as a deliberate link where the reader needs one.`,
        falsePositiveNote: 'A product name that only looks like a domain is still worth code formatting, because the converter cannot tell the difference either.',
      })
    );
  }
  return findings;
}

module.exports = { checkBareDomain, DOMAIN_RE, maskLine };
