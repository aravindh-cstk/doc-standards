'use strict';

const fs = require('fs');
const path = require('path');
const { makeFinding } = require('../lib/report');

// Structural checks for API reference pages (rules AR-01..AR-10).
//
// These cannot live in section-structure.js because that module works off
// data/section-order.json, which is keyed by the seven prose doc types and
// assumes an H1 page title plus H2 sections. An api-ref method page has no H1:
// it is a fragment that the CMS concatenates into a rendered class page, so its
// title is an H3 and its sections are H4.
//
// A page is classified as a class page or a method page by filename, matching
// the CMS content types: class_reference.md maps to classes_reference, anything
// under methods/ maps to method_details.

const FRONT_MATTER_KEYS = ['uid', 'seo_title', 'seo_description'];
const PARAM_COLUMNS = ['Name', 'Type', 'Required', 'Default', 'Description'];
const CONSTRUCTOR_COLUMNS = ['Name', 'Type', 'Description'];
const METHOD_SECTIONS = ['Validation', 'Behavior', 'Example'];
const RETURNS_RE = /^\*\*Returns:\*\*\s+(.+)$/;
const ERROR_REF_RE = /Additional Resources?:/;

function isClassPage(filePath) {
  return path.basename(filePath) === 'class_reference.md';
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
  // A class page is a standalone URL and needs SEO text. A method page is a
  // fragment, so filled SEO fields there would never be rendered.
  const seoTitle = (fm.keys.seo_title || '').replace(/^"|"$/g, '');
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

function checkSectionOrder(doc, findings) {
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
  if (isClassPage(doc.filePath) && hasRule) {
    findings.push(makeFinding({
      tier: 2, ruleId: 'AR-07', checkId: 'api-ref-trailing-rule',
      message: 'Class page ends with a horizontal rule. Only method pages carry one, to separate concatenated fragments.',
      line: lines.length,
    }));
  } else if (!isClassPage(doc.filePath) && !hasRule) {
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
  checkDeadLinks(doc, findings);
  return findings;
}

module.exports = { checkApiRefStructure, checkIndexCompleteness, isClassPage };
