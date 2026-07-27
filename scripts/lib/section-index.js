'use strict';

const sectionOrder = require('../data/section-order.json');
const sectionMatrix = require('../data/section-matrix.json');

function orderFor(docType) {
  return sectionOrder[docType] || null;
}

/**
 * Rows in section-order.json that do not correspond to a literal H2 heading
 * to search for: "SEO front matter" is the YAML front matter block (checked
 * by front-matter.js), "Page title" is the H1 (checked separately below),
 * and "Main Content" is a conceptual bucket for domain-specific H2 sections
 * (installation, commands, and so on), never a heading literally named
 * "Main Content" in practice.
 */
const PSEUDO_SECTIONS = ['seo front matter', 'page title', 'main content'];

function isPseudoSection(sectionLabel) {
  const core = sectionLabel.toLowerCase().split('(')[0].trim();
  return PSEUDO_SECTIONS.includes(core);
}

/**
 * Compares a document's actual top-level (H2) section headings against the
 * expected order for its doc type. Returns:
 *  - missing: expected sections marked Required (or a narrowed conditional)
 *    that have no matching heading
 *  - unexpected: headings present in the doc with no entry in the expected
 *    order table at all (candidates for "forbidden section" findings)
 *  - outOfOrder: pairs of expected sections both present, in the wrong
 *    relative order
 */
function compareOrder(docHeadingsTextInOrder, docType) {
  const rawExpected = orderFor(docType);
  if (!rawExpected) return null;
  const expected = rawExpected.filter((row) => !isPseudoSection(row.section));

  const normalize = (s) => s.trim().toLowerCase();
  const expectedNames = expected.map((row) => normalize(row.section));
  const docNames = docHeadingsTextInOrder.map(normalize);

  const isRequired = (row) => /^required\b/i.test(row.required.trim());

  const missing = expected.filter(
    (row) => isRequired(row) && !docNames.some((name) => matches(name, row.section))
  );

  const unexpected = docHeadingsTextInOrder.filter(
    (text) => !expectedNames.some((name) => matches(normalize(text), sectionNameFromNormalized(expected, name)))
  );

  const presentExpected = expected
    .map((row, idx) => ({ row, idx, docIdx: docNames.findIndex((name) => matches(name, row.section)) }))
    .filter((entry) => entry.docIdx !== -1)
    .sort((a, b) => a.docIdx - b.docIdx);

  const outOfOrder = [];
  for (let i = 1; i < presentExpected.length; i++) {
    if (presentExpected[i].idx < presentExpected[i - 1].idx) {
      outOfOrder.push({ before: presentExpected[i].row.section, after: presentExpected[i - 1].row.section });
    }
  }

  return { missing, unexpected, outOfOrder };
}

/** Loose match: doc heading text matches section-order.json's section label if one contains the other. */
function matches(docHeadingLower, expectedLabel) {
  const expectedLower = expectedLabel.toLowerCase();
  const expectedCore = expectedLower.split('(')[0].trim();
  return docHeadingLower === expectedCore || docHeadingLower.includes(expectedCore) || expectedCore.includes(docHeadingLower);
}

function sectionNameFromNormalized(expected, normalizedName) {
  const found = expected.find((row) => row.section.toLowerCase() === normalizedName);
  return found ? found.section : normalizedName;
}

module.exports = { orderFor, compareOrder, sectionMatrix };
