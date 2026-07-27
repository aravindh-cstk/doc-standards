#!/usr/bin/env node
'use strict';

/**
 * Regenerates data/section-order.json and data/section-matrix.json from the
 * doc-standards markdown source files. Re-run this manually whenever the
 * "## Section Order" tables in doc-standards/*.md or section-matrix.md change.
 * lint-doc.js never parses these markdown files at runtime, it only reads
 * the generated JSON.
 */

const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('../lib/parse-markdown');

const STANDARDS_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(__dirname, '..', 'data');

const TYPE_FILES = {
  'conceptual-guide': 'conceptual-guide.md',
  'feature-doc': 'feature-doc.md',
  'how-to-guide': 'how-to-guide.md',
  'setup-guide': 'setup-guide.md',
  'kickstarter': 'kickstarter.md',
  'migration-guide': 'migration-guide.md',
  'getting-started': 'getting-started.md',
};

function findSectionOrderTable(doc) {
  const heading = doc.sections.find((s) => s.text.trim().toLowerCase() === 'section order');
  if (!heading) return null;
  return doc.tables.find((t) => t.startLine > heading.line && t.startLine <= heading.endLine) || null;
}

function buildSectionOrder() {
  const result = {};
  for (const [typeKey, fileName] of Object.entries(TYPE_FILES)) {
    const filePath = path.join(STANDARDS_DIR, fileName);
    const source = fs.readFileSync(filePath, 'utf8');
    const doc = parseMarkdown(source);
    const table = findSectionOrderTable(doc);
    if (!table) {
      throw new Error(`No "Section Order" table found in ${fileName}`);
    }
    const headerIdx = {
      order: table.headerCells.findIndex((c) => c.trim() === '#'),
      section: table.headerCells.findIndex((c) => c.trim().toLowerCase() === 'section'),
      required: table.headerCells.findIndex((c) => c.trim().toLowerCase() === 'required'),
      purpose: table.headerCells.findIndex((c) => c.trim().toLowerCase() === 'purpose'),
    };
    result[typeKey] = table.rows.map((row) => ({
      order: row[headerIdx.order],
      section: row[headerIdx.section],
      required: row[headerIdx.required],
      purpose: row[headerIdx.purpose],
    }));
  }
  return result;
}

function buildSectionMatrix() {
  const filePath = path.join(STANDARDS_DIR, 'section-matrix.md');
  const source = fs.readFileSync(filePath, 'utf8');
  const doc = parseMarkdown(source);
  const table = doc.tables[0];
  if (!table) throw new Error('No table found in section-matrix.md');
  const docTypes = table.headerCells.slice(1);
  const matrix = {};
  for (const row of table.rows) {
    const sectionName = row[0];
    matrix[sectionName] = {};
    docTypes.forEach((type, idx) => {
      matrix[sectionName][type] = row[idx + 1];
    });
  }
  return { docTypes, matrix };
}

function main() {
  const sectionOrder = buildSectionOrder();
  const sectionMatrix = buildSectionMatrix();

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, 'section-order.json'),
    JSON.stringify(sectionOrder, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'section-matrix.json'),
    JSON.stringify(sectionMatrix, null, 2) + '\n'
  );

  for (const [typeKey, rows] of Object.entries(sectionOrder)) {
    console.log(`${typeKey}: ${rows.length} sections`);
  }
  console.log(`section-matrix: ${Object.keys(sectionMatrix.matrix).length} rows, ${sectionMatrix.docTypes.length} doc types`);
}

main();
