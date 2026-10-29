'use strict';

const { makeFinding } = require('../lib/report');

// The SDK doc set and the CLI doc set publish through different pipelines and
// require different front matter, so the key set is scoped by doc type rather
// than unified. Unifying them would mean reporting FM-01 on every page of one
// corpus or the other.
const SDK_REQUIRED_KEYS = ['seo_title', 'seo_description', 'url'];
const CLI_REQUIRED_KEYS = ['title', 'description', 'url'];
const CLI_TYPES = ['cli-command-reference', 'cli-task-runbook', 'cli-module-reference', 'cli-plugin-guide'];

// A CLI doc generated from the CMS carries the mirror's own shape, written by
// json_to_markdown.py: uid, seo_title, seo_description. Those three satisfy the
// same requirement as title, description, url, so a mirrored page must not be
// reported as missing all three. Detected by `uid`, which authored front matter
// never carries.
const MIRROR_KEYS = { title: 'seo_title', description: 'seo_description', url: 'uid' };

function isCmsMirror(fm) {
  return 'uid' in fm.keys && !('title' in fm.keys);
}

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

  const isCliType = CLI_TYPES.includes(docType);
  const requiredKeys = [...(isCliType ? CLI_REQUIRED_KEYS : SDK_REQUIRED_KEYS)];
  if (docType === 'migration-guide') requiredKeys.push('version');

  const mirror = isCliType && isCmsMirror(fm);

  for (const key of requiredKeys) {
    if (key in fm.keys) continue;
    // A mirrored page satisfies the requirement through its equivalent key.
    if (mirror && MIRROR_KEYS[key] && MIRROR_KEYS[key] in fm.keys) continue;
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: key === 'version' ? 'MIG-02' : 'FM-01',
        checkId: 'front-matter',
        line: fm.startLine,
        message: mirror
          ? `Missing required front matter key "${key}" (or its mirror equivalent "${MIRROR_KEYS[key] || key}").`
          : `Missing required front matter key "${key}".`,
      })
    );
  }

  return findings;
}

module.exports = { checkFrontMatter };
