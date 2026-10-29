'use strict';

const fs = require('fs');
const path = require('path');
const { makeFinding } = require('../lib/report');

// Structural checks for API reference pages (rules AR-01..AR-10, UG-01..UG-12).
//
// These cannot live in section-structure.js because that module works off
// data/section-order.json, which is keyed by the seven prose doc types and
// assumes an H1 page title plus H2 sections. An api-ref method page has no H1:
// it is a fragment that the CMS concatenates into a rendered class page, so its
// title is an H3 and its sections are H4.
//
// A page is classified by filename, matching the three CMS content types in the
// reference chain: usage_guide.md maps to sdk_usage_guides, class_reference.md
// maps to classes_reference, and anything under methods/ maps to method_details.
// Most checks therefore branch three ways. A usage guide is a standalone page
// like a class page, so it owns an H1 and carries no trailing rule, but its
// section set and its two navigation tables are its own.

const FRONT_MATTER_KEYS = ['uid', 'seo_title', 'seo_description'];
const PARAM_COLUMNS = ['Name', 'Type', 'Required', 'Default', 'Description'];
const CONSTRUCTOR_COLUMNS = ['Name', 'Type', 'Description'];
const METHOD_SECTIONS = ['Validation', 'Behavior', 'Example'];
const RETURNS_RE = /^\*\*Returns:\*\*\s+(.+)$/;
const ERROR_REF_RE = /Additional Resources?:/;

// Usage guide sections, in required order. SDK Limitations is omitted entirely
// when the SDK has no limitations that clear the section's entry tests, so it is
// order-checked when present but never reported as missing.
const USAGE_SECTIONS = [
  'Minimum Working Example',
  'SDK Structure',
  'Class Overview',
  'Task Index',
  'Key Usage Patterns',
  'SDK-Wide Notes',
  'SDK Limitations',
];
const USAGE_OPTIONAL = new Set(['SDK Limitations']);
const CLASS_OVERVIEW_COLUMNS = ['Class', 'Role', 'Accessed via'];
const TASK_INDEX_COLUMNS = ['Task', 'Start here', 'Class'];
const LIMITATION_COLUMNS = ['Capability', 'Supported', 'Notes / Alternative'];
const SDK_NOTE_COLUMNS = ['Concern', 'Behavior', 'Default when unset'];

// Headings that belong to another page in the chain. Setup belongs to Get
// Started, signatures and method lists to the class and method pages, and an
// FAQ heading is a sign the topic has no owner.
const FORBIDDEN_USAGE_HEADINGS = [
  'installation', 'install', 'installing', 'setup', 'prerequisites',
  'authentication', 'quickstart', 'quick start', 'methods',
  'common questions', 'faq', 'frequently asked questions',
  'additional resources', 'additional resource',
];
const INSTALL_COMMAND_RE = /\b(?:npm|yarn|pnpm)\s+(?:install|add)\b|\bpip\s+install\b|\bdotnet\s+add\s+package\b|\bgem\s+install\b|\bcomposer\s+require\b/i;
const MARKDOWN_LINK_RE = /\[[^\]]+\]\([^)]+\)/;
const GENERIC_SCENARIO_RE = /^(?:example|examples|basic usage|usage|sample|code sample)\b/i;
const NOUN_PHRASE_FIRST_WORD_RE = /^\S*(?:tion|ment|ing)\b/i;

function isClassPage(filePath) {
  return path.basename(filePath) === 'class_reference.md';
}

function isUsageGuidePage(filePath) {
  return /^usage[_-]guide\.md$/.test(path.basename(filePath));
}

/** A standalone URL, as opposed to a fragment the CMS concatenates. */
function isStandalonePage(filePath) {
  return isClassPage(filePath) || isUsageGuidePage(filePath);
}

/** The [start, end] line range a heading owns, up to the next heading of the same or higher level. */
function headingRange(doc, heading) {
  const next = (doc.headings || []).find(
    (h) => h.line > heading.line && h.level <= heading.level
  );
  return [heading.line, next ? next.line - 1 : doc.totalLines];
}

/** First H2 whose text matches, case-insensitively. */
function findUsageSection(doc, name) {
  return (doc.headings || []).find(
    (h) => h.level === 2 && h.text.trim().toLowerCase() === name.toLowerCase()
  ) || null;
}

/** The first table inside a heading's range. */
function firstTableIn(doc, heading) {
  const [start, end] = headingRange(doc, heading);
  return (doc.tables || []).find((t) => t.startLine >= start && t.startLine <= end) || null;
}

/** Strips inline code and fenced blocks so prose checks do not read code. */
function proseLines(doc) {
  const out = [];
  for (let n = doc.bodyStartLine; n <= doc.totalLines; n++) {
    if (doc.inFenceMask[n]) continue;
    out.push([n, doc.lines[n - 1]]);
  }
  return out;
}

function checkFrontMatterApiRef(doc, findings) {
  const fm = doc.frontMatter;
  if (!fm || !fm.present) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'AR-01', checkId: 'front-matter-api-ref',
      message: 'No front matter. An api-ref page needs uid, seo_title, and seo_description.',
      line: 1,
    }));
    return;
  }
  const keys = Object.keys(fm.keys || {});
  for (const required of FRONT_MATTER_KEYS) {
    if (!keys.includes(required)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-01', checkId: 'front-matter-api-ref',
        message: `Front matter is missing "${required}".`,
        line: fm.startLine || 1,
      }));
    }
  }
  for (const extra of keys) {
    if (!FRONT_MATTER_KEYS.includes(extra)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-01', checkId: 'front-matter-api-ref',
        message: `Front matter has unexpected key "${extra}". The api-ref content type carries only uid, seo_title, and seo_description.`,
        line: fm.startLine || 1,
      }));
    }
  }
  // A class page or usage guide is a standalone URL and needs SEO text. A
  // method page is a fragment, so filled SEO fields there would never render.
  const unquote = (v) => (v || '').replace(/^"|"$/g, '').trim();
  const seoTitle = unquote(fm.keys.seo_title);
  const seoDescription = unquote(fm.keys.seo_description);

  if (isUsageGuidePage(doc.filePath)) {
    // Tier 1 here rather than tier 2 as on a class page: the usage guide is the
    // reference's landing page, so it is the entry most often reached by search.
    // Only report an empty value when the key is present. A missing key is
    // already AR-01's finding, and reporting both reads as two separate faults.
    if (keys.includes('seo_title') && !seoTitle) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-01', checkId: 'front-matter-api-ref',
        message: 'Usage guide has an empty seo_title. A usage guide is a standalone URL, so its SEO text is rendered and indexed.',
        line: fm.startLine || 1,
      }));
    }
    if (keys.includes('seo_description') && !seoDescription) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-01', checkId: 'front-matter-api-ref',
        message: 'Usage guide has an empty seo_description. Say what the reference covers and name the package.',
        line: fm.startLine || 1,
      }));
    }
    return;
  }

  if (isClassPage(doc.filePath) && !seoTitle) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'AR-01', checkId: 'front-matter-api-ref',
      message: 'Class page has an empty seo_title. Class pages are standalone URLs and need SEO text.',
      line: fm.startLine || 1,
    }));
  }
}

function checkHeadingLevels(doc, findings) {
  const headings = doc.headings || [];
  const base = path.basename(doc.filePath, '.md');

  if (isUsageGuidePage(doc.filePath)) {
    const h1s = headings.filter((h) => h.level === 1);
    if (h1s.length !== 1) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-02', checkId: 'api-ref-heading-levels',
        message: `Usage guide has ${h1s.length} H1 headings. It needs exactly one, the SDK name followed by "API Reference".`,
        line: headings.length ? headings[0].line : 1,
      }));
    } else if (!/API Reference\s*$/i.test(h1s[0].text.trim())) {
      findings.push(makeFinding({
        tier: 2, ruleId: 'UG-02', checkId: 'api-ref-heading-levels',
        message: `Usage guide H1 is "${h1s[0].text.trim()}". Expected the SDK name followed by "API Reference".`,
        line: h1s[0].line,
      }));
    }

    const title = h1s.length === 1 ? h1s[0].text.trim().toLowerCase() : null;
    for (const h of headings) {
      if (h.level > 3) {
        findings.push(makeFinding({
          tier: 1, ruleId: 'UG-02', checkId: 'api-ref-heading-levels',
          message: `Usage guide heading "${h.text}" is H${h.level}. A usage guide uses H1 for the title, H2 for sections, and H3 only for usage-pattern titles.`,
          line: h.line,
        }));
      }
      // The live Get Started pages repeat the title as the first H2, which
      // pushes the first real section below the fold.
      if (h.level === 2 && title && h.text.trim().toLowerCase() === title) {
        findings.push(makeFinding({
          tier: 1, ruleId: 'UG-02', checkId: 'api-ref-heading-levels',
          message: `H2 "${h.text}" repeats the page title. Delete it, and let the first real section follow the intro.`,
          line: h.line,
        }));
      }
    }
    return;
  }

  if (isClassPage(doc.filePath)) {
    const h1s = headings.filter((h) => h.level === 1);
    if (h1s.length !== 1) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-02', checkId: 'api-ref-heading-levels',
        message: `Class page has ${h1s.length} H1 headings. It needs exactly one, the class name.`,
        line: headings.length ? headings[0].line : 1,
      }));
    }
    for (const h of headings) {
      if (h.level > 2) {
        findings.push(makeFinding({
          tier: 2, ruleId: 'AR-02', checkId: 'api-ref-heading-levels',
          message: `Class page heading "${h.text}" is H${h.level}. Class pages use H1 and H2 only, so group labels are bold text rather than headings.`,
          line: h.line,
        }));
      }
    }
    return;
  }

  const h3s = headings.filter((h) => h.level === 3);
  if (h3s.length !== 1) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'AR-02', checkId: 'api-ref-heading-levels',
      message: `Method page has ${h3s.length} H3 headings. It needs exactly one, the method name.`,
      line: headings.length ? headings[0].line : 1,
    }));
  } else if (h3s[0].text.trim() !== base) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'AR-02', checkId: 'api-ref-heading-levels',
      message: `Method heading "${h3s[0].text.trim()}" does not match the filename "${base}". The converter derives method_name from the filename.`,
      line: h3s[0].line,
    }));
  }
  for (const h of headings) {
    if (h.level < 3) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-02', checkId: 'api-ref-heading-levels',
        message: `Method page heading "${h.text}" is H${h.level}. A method page is a fragment inside a class page, so H1 and H2 break the assembled outline.`,
        line: h.line,
      }));
    }
  }
}

function checkUsageSectionOrder(doc, findings) {
  const h2 = (doc.headings || []).filter((h) => h.level === 2).map((h) => h.text.trim());
  const known = h2.filter((t) => USAGE_SECTIONS.includes(t));

  for (const required of USAGE_SECTIONS) {
    if (USAGE_OPTIONAL.has(required)) continue;
    if (!h2.includes(required)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-03', checkId: 'api-ref-section-order',
        message: `Missing the "${required}" section.`,
        line: doc.bodyStartLine,
      }));
    }
  }

  const expected = USAGE_SECTIONS.filter((s) => known.includes(s));
  const actual = known.filter((s, i) => known.indexOf(s) === i);
  if (expected.join('>') !== actual.join('>')) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-03', checkId: 'api-ref-section-order',
      message: `Sections are ordered ${actual.join(', ')}. Expected ${expected.join(', ')}. Measured scroll depth on the pages this replaces is 28.85%, so the orientation, the snippet, and both navigation tables have to stay in the top third.`,
      line: doc.bodyStartLine,
    }));
  }
}

function checkSectionOrder(doc, findings) {
  if (isUsageGuidePage(doc.filePath)) {
    checkUsageSectionOrder(doc, findings);
    return;
  }
  if (isClassPage(doc.filePath)) return;
  const h4 = (doc.headings || []).filter((h) => h.level === 4).map((h) => h.text.trim());
  const known = h4.filter((t) => METHOD_SECTIONS.includes(t) || t === 'Instance State');

  for (const required of METHOD_SECTIONS) {
    if (!h4.includes(required)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-03', checkId: 'api-ref-section-order',
        message: `Missing the "${required}" section.`,
        line: doc.bodyStartLine,
      }));
    }
  }

  const expected = ['Instance State', ...METHOD_SECTIONS].filter((s) => known.includes(s));
  const actual = known.filter((s, i) => known.indexOf(s) === i);
  if (expected.join('>') !== actual.join('>')) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'AR-03', checkId: 'api-ref-section-order',
      message: `Sections are ordered ${actual.join(', ')}. Expected ${expected.join(', ')}.`,
      line: doc.bodyStartLine,
    }));
  }
}

function checkReturnsLine(doc, findings) {
  if (isUsageGuidePage(doc.filePath)) return;
  if (isClassPage(doc.filePath)) return;
  let found = null;
  for (const [n, text] of proseLines(doc)) {
    const m = RETURNS_RE.exec(text.trim());
    if (m) { found = { line: n, body: m[1].trim() }; break; }
  }
  if (!found) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'AR-04', checkId: 'api-ref-returns-line',
      message: 'No "**Returns:**" line. The converter reads the CMS returns field from it.',
      line: doc.bodyStartLine,
    }));
    return;
  }
  // Shape: "<Type>. <Sentence ending in a period>"
  if (!/^[A-Za-z][\w.<>\[\]]*(\s+or\s+[A-Za-z][\w.<>\[\]]*)*\.\s+\S/.test(found.body)) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'AR-04', checkId: 'api-ref-returns-line',
      message: `Returns line is "${found.body}". Expected a type, a period, then a noun-phrase sentence, as in "dict. The requested taxonomy."`,
      line: found.line,
    }));
  } else if (!found.body.trimEnd().endsWith('.')) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'AR-04', checkId: 'api-ref-returns-line',
      message: 'Returns description does not end with a period. It is reused verbatim in the class Method Index.',
      line: found.line,
    }));
  }
}

function checkParamTable(doc, findings) {
  // A usage guide's two tables are checked by their own rules, not here.
  if (isUsageGuidePage(doc.filePath)) return;
  // A class page's constructor table is deliberately three columns, because a
  // constructor argument has no meaningful default and its requiredness is
  // covered by Instance State. Only method pages carry the five-column table.
  if (isClassPage(doc.filePath)) {
    for (const t of doc.tables || []) {
      const headers = t.headerCells || [];
      if (headers[0] !== 'Name') continue;
      // A class page carries two legitimate table shapes: the three-column
      // constructor-argument table, and the five-column Class-Level Properties
      // table, which the class template defines separately. Accept either.
      const asConstructor = headers.join('|') === CONSTRUCTOR_COLUMNS.join('|');
      const asProperties = headers.join('|') === PARAM_COLUMNS.join('|');
      if (!asConstructor && !asProperties) {
        findings.push(makeFinding({
          tier: 2, ruleId: 'AR-05', checkId: 'api-ref-param-table',
          message: `Table columns are [${headers.join(', ')}]. A class page uses [${CONSTRUCTOR_COLUMNS.join(', ')}] for constructor arguments or [${PARAM_COLUMNS.join(', ')}] for class properties.`,
          line: t.startLine,
        }));
      }
    }
    return;
  }

  for (const t of doc.tables || []) {
    const headers = t.headerCells || [];
    // Only judge tables that are trying to be parameter tables.
    const looksLikeParams = headers[0] === 'Name' || headers.includes('Required');
    if (!looksLikeParams) continue;

    if (headers.join('|') !== PARAM_COLUMNS.join('|')) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-05', checkId: 'api-ref-param-table',
        message: `Parameter table columns are [${headers.join(', ')}]. Expected exactly [${PARAM_COLUMNS.join(', ')}]. The converter maps them positionally.`,
        line: t.startLine,
      }));
      continue;
    }
    const defaultIdx = PARAM_COLUMNS.indexOf('Default');
    (t.rows || []).forEach((row, i) => {
      const cell = (row[defaultIdx] || '').trim();
      const line = t.startLine + 2 + i;
      if (!cell) {
        findings.push(makeFinding({
          tier: 1, ruleId: 'AR-05', checkId: 'api-ref-param-table',
          message: `Default cell for "${row[0]}" is blank. Use the actual default, or "Not applicable" when the parameter is required.`,
          line,
        }));
      } else if (/[—–]/.test(cell)) {
        findings.push(makeFinding({
          tier: 1, ruleId: 'AR-05', checkId: 'api-ref-param-table',
          message: `Default cell for "${row[0]}" uses an em or en dash. C3-05 forbids it. Use "Not applicable".`,
          line,
        }));
      }
    });
  }
}

function checkAdditionalResource(doc, findings) {
  if (isUsageGuidePage(doc.filePath)) return;
  if (isClassPage(doc.filePath)) return;
  const validation = (doc.headings || []).find((h) => h.level === 4 && h.text.trim() === 'Validation');
  if (!validation) return;
  const nextHeading = (doc.headings || []).find((h) => h.line > validation.line);
  const end = nextHeading ? nextHeading.line - 1 : doc.totalLines;

  let callout = null;
  for (let n = validation.line; n <= end; n++) {
    const text = doc.lines[n - 1] || '';
    if (ERROR_REF_RE.test(text)) { callout = { line: n, text }; break; }
  }
  if (!callout) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'AR-06', checkId: 'api-ref-additional-resource',
      message: 'Validation has no Additional Resource callout linking the API error reference. Omit only for pure client-side utility methods that make no request.',
      line: validation.line,
      falsePositiveNote: 'Correct to omit when the method never triggers a request on any terminal call.',
    }));
    return;
  }
  const linkCount = (callout.text.match(/\]\(/g) || []).length;
  const isPlural = /Additional Resources:/.test(callout.text);
  if (linkCount === 1 && isPlural) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'AR-06', checkId: 'api-ref-additional-resource',
      message: 'Callout says "Additional Resources" but carries one link. Use the singular.',
      line: callout.line,
    }));
  } else if (linkCount > 1 && !isPlural) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'AR-06', checkId: 'api-ref-additional-resource',
      message: `Callout says "Additional Resource" but carries ${linkCount} links. Use the plural.`,
      line: callout.line,
    }));
  }
}

function checkTrailingRule(doc, findings) {
  const lines = doc.lines.slice();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const last = (lines[lines.length - 1] || '').trim();
  const hasRule = last === '---';
  if (isStandalonePage(doc.filePath) && hasRule) {
    const kind = isUsageGuidePage(doc.filePath) ? 'Usage guide' : 'Class page';
    findings.push(makeFinding({
      tier: 2, ruleId: 'AR-07', checkId: 'api-ref-trailing-rule',
      message: `${kind} ends with a horizontal rule. Only method pages carry one, to separate concatenated fragments.`,
      line: lines.length,
    }));
  } else if (!isStandalonePage(doc.filePath) && !hasRule) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'AR-07', checkId: 'api-ref-trailing-rule',
      message: 'Method page does not end with a horizontal rule. It marks the end of the fragment in the rendered class page.',
      line: lines.length,
    }));
  }
}

function checkMethodIndexSoleList(doc, findings) {
  if (!isClassPage(doc.filePath)) return;
  const methodsHeading = (doc.headings || []).find(
    (h) => h.level === 2 && /^methods$/i.test(h.text.trim())
  );
  if (methodsHeading) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'AR-08', checkId: 'api-ref-method-index-sole-list',
      message: 'Class page has a trailing "Methods" list in addition to the Method Index. The index is the only list, and the converter derives the CMS methods array from it.',
      line: methodsHeading.line,
    }));
  }
  const hasIndex = (doc.headings || []).some(
    (h) => h.level === 2 && /method index/i.test(h.text.trim())
  );
  if (!hasIndex) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'AR-08', checkId: 'api-ref-method-index-sole-list',
      message: 'Class page has no "Method Index" section.',
      line: doc.bodyStartLine,
    }));
  }
}

/**
 * AR-09 needs the whole class folder, not one file, so it runs separately from
 * the per-file checks. Returns findings against the class page.
 */
function checkIndexCompleteness(classDoc) {
  const findings = [];
  const dir = path.dirname(classDoc.filePath);
  const methodsDir = path.join(dir, 'methods');
  if (!fs.existsSync(methodsDir)) return findings;

  const onDisk = fs.readdirSync(methodsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.basename(f, '.md'))
    .sort();

  const counts = new Map();
  for (const link of classDoc.links || []) {
    const m = /^methods\/([^/]+)\.md$/.exec(link.url || '');
    if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }

  for (const name of onDisk) {
    const n = counts.get(name) || 0;
    if (n === 0) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-09', checkId: 'api-ref-index-completeness',
        message: `Method "${name}" exists on disk but is not linked from the Method Index. It would be unreachable in the rendered page.`,
        line: classDoc.bodyStartLine,
      }));
    }
  }
  for (const [name, n] of counts) {
    if (!onDisk.includes(name) && !resolvesSomewhere(methodsDir, `${name}.md`)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-09', checkId: 'api-ref-index-completeness',
        message: `Method Index links "methods/${name}.md", which does not exist.`,
        line: classDoc.bodyStartLine,
      }));
    }
  }
  // Two index rows for one method imply two callable methods.
  const inTableRows = new Map();
  for (const t of classDoc.tables || []) {
    if (!(t.headerCells || []).includes('Method Name')) continue;
    for (const row of t.rows || []) {
      const m = /\[([^\]]+)\]\(methods\/([^)]+)\.md\)/.exec(row[0] || '');
      if (m) inTableRows.set(m[2], (inTableRows.get(m[2]) || 0) + 1);
    }
  }
  for (const [name, n] of inTableRows) {
    if (n > 1) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-09', checkId: 'api-ref-index-completeness',
        message: `Method "${name}" has ${n} rows in the Method Index. One row per method, or it reads as two callable methods.`,
        line: classDoc.bodyStartLine,
      }));
    }
  }
  return findings;
}

/**
 * Flags relative links whose target file does not exist.
 *
 * A review folder holds only the pages under review, so a link to an unchanged
 * sibling resolves in the canonical tree but not in the copy. Set the
 * API_REF_BASELINE environment variable (or pass --baseline) to a canonical
 * doc-set root and link resolution falls back to the same relative path there
 * before reporting a dead link.
 */
function resolvesSomewhere(dir, target) {
  if (fs.existsSync(path.resolve(dir, target))) return true;
  const baseline = process.env.API_REF_BASELINE;
  if (!baseline) return false;
  // Re-anchor the link at the matching position under the baseline root by
  // reusing the trailing path segments that identify the class and method.
  const abs = path.resolve(dir, target);
  const marker = abs.split(path.sep).slice(-3).join(path.sep);
  return fs.existsSync(path.join(baseline, marker))
    || fs.existsSync(path.join(baseline, abs.split(path.sep).slice(-2).join(path.sep)));
}

function checkDeadLinks(doc, findings) {
  const dir = path.dirname(doc.filePath);
  for (const link of doc.links || []) {
    const url = link.url || '';
    if (!url.endsWith('.md')) continue;
    if (/^(https?:)?\/\//.test(url)) continue;
    if (!resolvesSomewhere(dir, url.split('#')[0])) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'AR-09', checkId: 'api-ref-index-completeness',
        message: `Relative link "${url}" does not resolve.`,
        line: link.line,
      }));
    }
  }
}

/**
 * UG-09. The block carries three facts, and each is a separate finding so a page
 * missing only the changelog link is not reported as missing the whole block.
 */
function checkBeforeYouBegin(doc, findings) {
  const h1 = (doc.headings || []).find((h) => h.level === 1);
  const firstH2 = (doc.headings || []).find((h) => h.level === 2);
  const start = h1 ? h1.line + 1 : doc.bodyStartLine;
  const end = firstH2 ? firstH2.line - 1 : doc.totalLines;

  let blockStart = null;
  for (let n = start; n <= end; n++) {
    if (doc.inFenceMask[n]) continue;
    if (/^\s*>\s*\*\*Before you begin:\*\*/i.test(doc.lines[n - 1] || '')) {
      blockStart = n;
      break;
    }
  }
  if (blockStart === null) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-09', checkId: 'api-ref-before-you-begin',
      message: 'No "Before you begin" blockquote between the intro paragraph and the first section. It is what a reader who skipped setup needs to see first.',
      line: start,
    }));
    return;
  }

  // Consume the contiguous blockquote.
  let n = blockStart;
  const block = [];
  while (n <= doc.totalLines && /^\s*>/.test(doc.lines[n - 1] || '')) {
    block.push(doc.lines[n - 1]);
    n++;
  }
  const text = block.join(' ');

  if (!/get started/i.test(text) || !MARKDOWN_LINK_RE.test(text)) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'UG-09', checkId: 'api-ref-before-you-begin',
      message: 'Before you begin does not link the Get Started guide. Readers arrive here from search having skipped setup.',
      line: blockStart,
    }));
  }
  if (!/\b(?:requires?|supports?)\b/i.test(text) || !/\d/.test(text)) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'UG-09', checkId: 'api-ref-before-you-begin',
      message: 'Before you begin does not state the runtime versions this SDK supports. An unsupported runtime produces failures that read as SDK bugs.',
      line: blockStart,
      falsePositiveNote: 'Correct to omit only for an SDK with no runtime version floor at all.',
    }));
  }
  if (!/\b(?:changelog|release notes)\b/i.test(text)) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'UG-09', checkId: 'api-ref-before-you-begin',
      message: 'Before you begin names no changelog or release notes. Without it an upgrade regression is indistinguishable from a documentation error.',
      line: blockStart,
    }));
  }
}

/** UG-04. The Class Overview table is this page's Method Index equivalent. */
function checkClassOverviewTable(doc, findings) {
  const heading = findUsageSection(doc, 'Class Overview');
  if (!heading) return; // UG-03 already reports the missing section.
  const table = firstTableIn(doc, heading);
  if (!table) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-04', checkId: 'api-ref-class-overview-table',
      message: 'Class Overview has no table. It is the page\'s primary navigation into the class pages.',
      line: heading.line,
    }));
    return;
  }
  const headers = table.headerCells || [];
  if (headers.join('|') !== CLASS_OVERVIEW_COLUMNS.join('|')) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-04', checkId: 'api-ref-class-overview-table',
      message: `Class Overview columns are [${headers.join(', ')}]. Expected exactly [${CLASS_OVERVIEW_COLUMNS.join(', ')}].`,
      line: table.startLine,
    }));
    return;
  }
  (table.rows || []).forEach((row, i) => {
    const line = table.startLine + 2 + i;
    const classCell = (row[0] || '').trim();
    const accessedVia = (row[2] || '').trim();
    if (classCell && !MARKDOWN_LINK_RE.test(classCell)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-04', checkId: 'api-ref-class-overview-table',
        message: `Class cell "${classCell}" is not a link. A class name in plain text is the affordance failure the dead-click rate measures, and there is no other route to the class page.`,
        line,
      }));
    }
    if (accessedVia && !accessedVia.includes('`')) {
      findings.push(makeFinding({
        tier: 2, ruleId: 'UG-04', checkId: 'api-ref-class-overview-table',
        message: `Accessed via cell for "${classCell}" is not inline code. It names a call, so it is code.`,
        line,
      }));
    }
  });
}

/** UG-06. The task-oriented second entry point into the reference. */
function checkTaskIndexTable(doc, findings) {
  const heading = findUsageSection(doc, 'Task Index');
  if (!heading) return;
  const table = firstTableIn(doc, heading);
  if (!table) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-06', checkId: 'api-ref-task-index',
      message: 'Task Index has no table. It is the entry point for readers who know their goal but not which class owns it.',
      line: heading.line,
    }));
    return;
  }
  const headers = table.headerCells || [];
  if (headers.join('|') !== TASK_INDEX_COLUMNS.join('|')) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-06', checkId: 'api-ref-task-index',
      message: `Task Index columns are [${headers.join(', ')}]. Expected exactly [${TASK_INDEX_COLUMNS.join(', ')}].`,
      line: table.startLine,
    }));
    return;
  }
  (table.rows || []).forEach((row, i) => {
    const line = table.startLine + 2 + i;
    const task = (row[0] || '').trim();
    const startHere = (row[1] || '').trim();
    if (startHere && !MARKDOWN_LINK_RE.test(startHere)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-06', checkId: 'api-ref-task-index',
        message: `Start here cell for "${task}" is not a link. A row the reader cannot follow is worse than an absent row, because they have already committed to the route.`,
        line,
      }));
    }
    if (task && NOUN_PHRASE_FIRST_WORD_RE.test(task)) {
      findings.push(makeFinding({
        tier: 2, ruleId: 'UG-06', checkId: 'api-ref-task-index',
        message: `Task "${task}" opens with a noun or gerund. Phrase it as the reader's goal, starting with a plain verb, as in "Fetch one entry by UID".`,
        line,
        falsePositiveNote: 'A legitimate task can begin with a word ending in tion, ment, or ing.',
      }));
    }
  });
}

/** UG-11. The scenario title is how a reader picks which example to read. */
function checkUsagePatterns(doc, findings) {
  const heading = findUsageSection(doc, 'Key Usage Patterns');
  if (!heading) return;
  const [start, end] = headingRange(doc, heading);
  const h3s = (doc.headings || []).filter(
    (h) => h.level === 3 && h.line > start && h.line <= end
  );
  if (h3s.length < 3) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'UG-11', checkId: 'api-ref-usage-patterns',
      message: `Key Usage Patterns has ${h3s.length} H3 examples. Three is the floor. Benchmarked competitors carry 8 to 13 named scenarios per method.`,
      line: heading.line,
    }));
  }
  for (const h of h3s) {
    if (GENERIC_SCENARIO_RE.test(h.text.trim())) {
      findings.push(makeFinding({
        tier: 2, ruleId: 'UG-11', checkId: 'api-ref-usage-patterns',
        message: `Example title "${h.text.trim()}" is generic. Name the scenario it demonstrates, as in "Fetch a single entry with its references resolved".`,
        line: h.line,
      }));
    }
  }
}

/**
 * UG-13. One table rather than a run of bold labels with bullets under each. The
 * three columns hold across every SDK family, because each cross-cutting concern
 * has a behavior and a default.
 */
function checkSdkWideNotes(doc, findings) {
  const heading = findUsageSection(doc, 'SDK-Wide Notes');
  if (!heading) return; // UG-03 already reports the missing section.
  const table = firstTableIn(doc, heading);
  if (!table) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-13', checkId: 'api-ref-sdk-wide-notes',
      message: `SDK-Wide Notes has no table. Use the three columns [${SDK_NOTE_COLUMNS.join(', ')}], one row per cross-cutting concern.`,
      line: heading.line,
    }));
    return;
  }
  const headers = table.headerCells || [];
  if (headers.join('|') !== SDK_NOTE_COLUMNS.join('|')) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-13', checkId: 'api-ref-sdk-wide-notes',
      message: `SDK-Wide Notes columns are [${headers.join(', ')}]. Expected exactly [${SDK_NOTE_COLUMNS.join(', ')}].`,
      line: table.startLine,
    }));
    return;
  }
  const defaultIdx = SDK_NOTE_COLUMNS.indexOf('Default when unset');
  (table.rows || []).forEach((row, i) => {
    const cell = (row[defaultIdx] || '').trim();
    const line = table.startLine + 2 + i;
    if (!cell) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-13', checkId: 'api-ref-sdk-wide-notes',
        message: `Default when unset cell for "${row[0]}" is blank. Name the value the SDK falls back to, or write "Not applicable" when the parameter is required.`,
        line,
      }));
    } else if (/[\u2014\u2013]/.test(cell)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-13', checkId: 'api-ref-sdk-wide-notes',
        message: `Default when unset cell for "${row[0]}" uses an em or en dash. C3-05 forbids it. Use "Not applicable".`,
        line,
      }));
    }
  });
}

/** UG-08. Auth is the largest theme in the corpus, and the failure is near silent. */
function checkTokenTypeWarning(doc, findings) {
  const heading = findUsageSection(doc, 'SDK-Wide Notes');
  if (!heading) return;
  const [start, end] = headingRange(doc, heading);
  let found = false;
  for (let n = start; n <= end; n++) {
    if (doc.inFenceMask[n]) continue;
    const text = doc.lines[n - 1] || '';
    if (/^\s*>\s*\*\*(?:Warning|IMPORTANT)/i.test(text) && /token/i.test(text)) {
      found = true;
      break;
    }
  }
  if (!found) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'UG-08', checkId: 'api-ref-token-type-warning',
      message: 'SDK-Wide Notes has no token-type warning. A management or preview token used where a delivery token belongs returns error code 109, which names neither the token nor the fix.',
      line: heading.line,
      falsePositiveNote: 'Correct to omit for an SDK that accepts exactly one token type and cannot be initialized with another.',
    }));
  }
}

/** UG-12. Same columns as the class-level Capability Matrix, one tier up. */
function checkSdkLimitations(doc, findings) {
  const heading = findUsageSection(doc, 'SDK Limitations');
  if (!heading) return; // Omitting the section entirely is correct when none are known.
  const table = firstTableIn(doc, heading);
  if (!table) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-12', checkId: 'api-ref-sdk-limitations',
      message: 'SDK Limitations has no table. Omit the whole section when no limitations clear its two entry tests, rather than leaving it prose-only.',
      line: heading.line,
    }));
    return;
  }
  const headers = table.headerCells || [];
  if (headers.join('|') !== LIMITATION_COLUMNS.join('|')) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-12', checkId: 'api-ref-sdk-limitations',
      message: `SDK Limitations columns are [${headers.join(', ')}]. Expected exactly [${LIMITATION_COLUMNS.join(', ')}], matching the class-level Capability Matrix so both tiers read alike.`,
      line: table.startLine,
    }));
    return;
  }
  if (!(table.rows || []).length) {
    findings.push(makeFinding({
      tier: 1, ruleId: 'UG-12', checkId: 'api-ref-sdk-limitations',
      message: 'SDK Limitations table has no rows. Omit the section instead. An empty table is never correct.',
      line: table.startLine,
    }));
    return;
  }
  const altIdx = LIMITATION_COLUMNS.indexOf('Notes / Alternative');
  (table.rows || []).forEach((row, i) => {
    if (!(row[altIdx] || '').trim()) {
      findings.push(makeFinding({
        tier: 2, ruleId: 'UG-12', checkId: 'api-ref-sdk-limitations',
        message: `Notes / Alternative cell for "${row[0]}" is blank. Name the workaround, or state that none exists. A blank cell leaves the reader knowing they are blocked and not what to do.`,
        line: table.startLine + 2 + i,
      }));
    }
  });
}

/** UG-10. Content that belongs to another page in the chain. */
function checkUsageGuideScope(doc, findings) {
  for (const h of doc.headings || []) {
    if (h.level < 2) continue;
    if (FORBIDDEN_USAGE_HEADINGS.includes(h.text.trim().toLowerCase())) {
      findings.push(makeFinding({
        tier: 2, ruleId: 'UG-10', checkId: 'api-ref-usage-guide-scope',
        message: `Heading "${h.text.trim()}" belongs to another page. Setup belongs to Get Started, method lists to the class pages, and links belong inline in the section that needs them.`,
        line: h.line,
      }));
    }
  }
  for (const [n, text] of proseLines(doc)) {
    if (INSTALL_COMMAND_RE.test(text)) {
      findings.push(makeFinding({
        tier: 2, ruleId: 'UG-10', checkId: 'api-ref-usage-guide-scope',
        message: 'Install command in prose. Installation belongs to Get Started, and repeating it here is the duplication this page exists to prevent.',
        line: n,
        falsePositiveNote: 'A command inside a fenced code block is not flagged. This is prose or inline code.',
      }));
    }
  }
}

/**
 * UG-05 needs the whole doc set, not one file, so it runs separately from the
 * per-file checks. This is AR-09 in reverse: instead of checking that every
 * method file is linked from its class page, it checks that every class page is
 * linked from the usage guide. Returns findings against the usage guide.
 */
function checkClassOverviewCompleteness(usageDoc) {
  const findings = [];
  const dir = path.dirname(usageDoc.filePath);
  if (!fs.existsSync(dir)) return findings;

  const onDisk = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'class_reference.md')))
    .map((e) => e.name)
    .sort();

  // Scan only the Class Overview section. A class page legitimately gets linked
  // again from the Task Index, and counting those would read as a duplicate row.
  const heading = findUsageSection(usageDoc, 'Class Overview');
  const [start, end] = heading
    ? headingRange(usageDoc, heading)
    : [usageDoc.bodyStartLine, usageDoc.totalLines];

  const counts = new Map();
  for (const link of usageDoc.links || []) {
    if (link.line < start || link.line > end) continue;
    const m = /^([^/]+)\/class_reference\.md$/.exec((link.url || '').split('#')[0]);
    if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }

  for (const name of onDisk) {
    if (!counts.get(name)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-05', checkId: 'api-ref-class-overview-completeness',
        message: `Class "${name}" exists on disk but is not linked from the Class Overview. It would be unreachable from the reference landing page.`,
        line: usageDoc.bodyStartLine,
      }));
    }
  }
  for (const [name, n] of counts) {
    if (n > 1) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-05', checkId: 'api-ref-class-overview-completeness',
        message: `Class "${name}" is linked ${n} times from the Class Overview. One row per class, or it reads as two classes.`,
        line: usageDoc.bodyStartLine,
      }));
    }
    if (!onDisk.includes(name) && !resolvesSomewhere(dir, `${name}/class_reference.md`)) {
      findings.push(makeFinding({
        tier: 1, ruleId: 'UG-05', checkId: 'api-ref-class-overview-completeness',
        message: `Class Overview links "${name}/class_reference.md", which does not exist.`,
        line: usageDoc.bodyStartLine,
      }));
    }
  }
  return findings;
}

function checkApiRefStructure(doc) {
  const findings = [];
  checkFrontMatterApiRef(doc, findings);
  checkHeadingLevels(doc, findings);
  checkSectionOrder(doc, findings);
  checkReturnsLine(doc, findings);
  checkParamTable(doc, findings);
  checkAdditionalResource(doc, findings);
  checkTrailingRule(doc, findings);
  checkMethodIndexSoleList(doc, findings);
  if (isUsageGuidePage(doc.filePath)) {
    checkBeforeYouBegin(doc, findings);
    checkClassOverviewTable(doc, findings);
    checkTaskIndexTable(doc, findings);
    checkUsagePatterns(doc, findings);
    checkSdkWideNotes(doc, findings);
    checkTokenTypeWarning(doc, findings);
    checkSdkLimitations(doc, findings);
    checkUsageGuideScope(doc, findings);
  }
  checkDeadLinks(doc, findings);
  return findings;
}

module.exports = {
  checkApiRefStructure,
  checkIndexCompleteness,
  checkClassOverviewCompleteness,
  isClassPage,
  isUsageGuidePage,
};
