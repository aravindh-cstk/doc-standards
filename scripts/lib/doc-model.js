'use strict';

const fs = require('fs');
const { parseMarkdown, ownBodyRanges } = require('./parse-markdown');

/**
 * Wraps a parsed markdown document with convenience accessors shared across
 * check modules: section body text (with or without nested subsections),
 * prose-only line ranges (code fences excluded), and raw line access.
 */
class DocModel {
  constructor(filePath, source) {
    this.filePath = filePath;
    this.source = source;
    const parsed = parseMarkdown(source);
    Object.assign(this, parsed);
  }

  static fromFile(filePath) {
    const source = fs.readFileSync(filePath, 'utf8');
    return new DocModel(filePath, source);
  }

  /** Raw lines for [startLine, endLine], inclusive, 1-indexed. */
  rawLines(startLine, endLine) {
    return this.lines.slice(startLine - 1, endLine);
  }

  /** Raw text for [startLine, endLine], inclusive, 1-indexed. */
  rawText(startLine, endLine) {
    return this.rawLines(startLine, endLine).join('\n');
  }

  /** Every line number in [startLine, endLine] that is not inside a code fence. */
  proseLineNumbers(startLine, endLine) {
    const result = [];
    for (let l = startLine; l <= endLine; l++) {
      if (!this.inFenceMask[l]) result.push(l);
    }
    return result;
  }

  /** Prose-only text for a line range, one code fence collapsed to a blank line each. */
  proseText(startLine, endLine) {
    return this.proseLineNumbers(startLine, endLine)
      .map((l) => this.lines[l - 1])
      .join('\n');
  }

  /** Full body range of a section, including any nested subsections. */
  sectionBody(section) {
    return this.rawText(section.line + 1, section.endLine);
  }

  /** Body of a section excluding any direct child subsections (e.g. Prerequisites minus Mandatory/Optional). */
  sectionOwnBody(section) {
    const ranges = ownBodyRanges(section, this.sections);
    return ranges.map(([start, end]) => this.rawText(start, end)).join('\n');
  }

  /** All headings whose text matches (case-insensitive) any of the given names. */
  findSections(names) {
    const normalized = names.map((n) => n.toLowerCase());
    return this.sections.filter((s) => normalized.includes(s.text.toLowerCase()));
  }

  /** First heading whose text matches (case-insensitive) any of the given names. */
  findSection(names) {
    return this.findSections(names)[0] || null;
  }

  /** Top-level (H2) sections only, in document order. */
  topLevelSections() {
    return this.sections.filter((s) => s.level === 2);
  }

  /** Links whose target line falls within [startLine, endLine]. */
  linksInRange(startLine, endLine) {
    return this.links.filter((l) => l.line >= startLine && l.line <= endLine);
  }

  /** List items whose target line falls within [startLine, endLine]. */
  listItemsInRange(startLine, endLine) {
    return this.listItems.filter((i) => i.line >= startLine && i.line <= endLine);
  }

  /** Tables whose start line falls within [startLine, endLine]. */
  tablesInRange(startLine, endLine) {
    return this.tables.filter((t) => t.startLine >= startLine && t.startLine <= endLine);
  }
}

module.exports = { DocModel };
