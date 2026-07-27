'use strict';

const { makeFinding } = require('../lib/report');

const BASE_REQUIRED_KEYS = ['title', 'description', 'url'];

/** Tier 1: required front matter keys present, malformed key:value lines, version field for migration guides. */
function checkFrontMatter(doc, docType) {
  const findings = [];
  const fm = doc.frontMatter;

  if (!fm.present) {
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'FM-01',
        checkId: 'front-matter',
        message: 'No YAML front matter block found at the top of the document.',
        line: 1,
      })
    );
    return findings;
  }

  for (const malformed of fm.malformedLines) {
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'FM-02',
        checkId: 'front-matter',
        line: malformed.line,
        message: `Malformed front matter line, not a valid "key: value" pair: ${JSON.stringify(malformed.text)}`,
      })
    );
  }

  const requiredKeys = [...BASE_REQUIRED_KEYS];
  if (docType === 'migration-guide') requiredKeys.push('version');

  for (const key of requiredKeys) {
    if (!(key in fm.keys)) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: key === 'version' ? 'MIG-02' : 'FM-01',
          checkId: 'front-matter',
          line: fm.startLine,
          message: `Missing required front matter key "${key}".`,
        })
      );
    }
  }

  return findings;
}

module.exports = { checkFrontMatter };
