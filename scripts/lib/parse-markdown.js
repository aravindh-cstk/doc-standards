'use strict';

const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const KEY_VALUE_RE = /^([A-Za-z_][\w-]*):\s?(.*)$/;
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

/** GitHub-style heading anchor slug. */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Splits raw markdown text into lines and computes, per line (1-indexed),
 * whether it falls inside a fenced code block. Fence lines themselves count
 * as "in fence" (open and close lines included in the range).
 */
function findCodeFences(lines) {
  const fences = [];
  let openFence = null;
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const match = line.match(FENCE_RE);
    if (!match) return;
    const fenceChar = match[2][0];
    if (!openFence) {
      openFence = { start: lineNo, fenceChar, lang: match[3].trim() };
    } else if (fenceChar === openFence.fenceChar) {
      fences.push({ start: openFence.start, end: lineNo, lang: openFence.lang });
      openFence = null;
    }
  });
  if (openFence) {
    fences.push({ start: openFence.start, end: lines.length, lang: openFence.lang });
  }
  return fences;
}

function buildInFenceMask(lines, fences) {
  const mask = new Array(lines.length + 1).fill(false);
  for (const fence of fences) {
    for (let l = fence.start; l <= fence.end; l++) mask[l] = true;
  }
  return mask;
}

/** Parses a leading YAML-like front matter block of flat `key: value` scalars. */
function parseFrontMatter(lines) {
  if (lines[0] !== '---') {
    return { present: false, keys: {}, malformedLines: [], startLine: null, endLine: null };
  }
  let endLine = null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endLine = i + 1;
      break;
    }
  }
  if (endLine === null) {
    return { present: false, keys: {}, malformedLines: [], startLine: 1, endLine: null };
  }
  const keys = {};
  const malformedLines = [];
  for (let i = 1; i < endLine - 1; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    if (raw.trim() === '') continue;
    if (LIST_ITEM_RE.test(raw)) continue;
    const kv = raw.match(KEY_VALUE_RE);
    if (kv) {
      keys[kv[1]] = kv[2];
    } else {
      malformedLines.push({ line: lineNo, text: raw });
    }
  }
  return { present: true, keys, malformedLines, startLine: 1, endLine };
}

/** Builds a flat heading list, skipping headings inside code fences or front matter. */
function findHeadings(lines, inFenceMask, bodyStartLine) {
  const headings = [];
  const anchorCounts = new Map();
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (lineNo < bodyStartLine) return;
    if (inFenceMask[lineNo]) return;
    const match = line.match(HEADING_RE);
    if (!match) return;
    const level = match[1].length;
    const text = match[2].trim();
    let anchor = slugify(text);
    const count = anchorCounts.get(anchor) || 0;
    anchorCounts.set(anchor, count + 1);
    if (count > 0) anchor = `${anchor}-${count}`;
    headings.push({ level, text, line: lineNo, anchor });
  });
  return headings;
}

/**
 * Turns the flat heading list into sections, each spanning from its heading
 * line to the line before the next heading of level <= its own (or EOF).
 */
function buildSections(headings, totalLines) {
  return headings.map((heading, idx) => {
    let endLine = totalLines;
    for (let j = idx + 1; j < headings.length; j++) {
      if (headings[j].level <= heading.level) {
        endLine = headings[j].line - 1;
        break;
      }
    }
    return { ...heading, endLine };
  });
}

/** Direct child subsections of a section (next heading level = section.level + 1, before section.endLine). */
function directChildren(section, allSections) {
  return allSections.filter(
    (s) => s.line > section.line && s.endLine <= section.endLine && s.level === section.level + 1
  );
}

/** Body line range of a section excluding any direct child subsections' ranges. */
function ownBodyRanges(section, allSections) {
  const children = directChildren(section, allSections).sort((a, b) => a.line - b.line);
  const ranges = [];
  let cursor = section.line + 1;
  for (const child of children) {
    if (child.line - 1 >= cursor) ranges.push([cursor, child.line - 1]);
    cursor = child.endLine + 1;
  }
  if (cursor <= section.endLine) ranges.push([cursor, section.endLine]);
  return ranges;
}

/** Finds GFM pipe tables outside code fences. Returns header cells, alignment row, and body rows. */
function findTables(lines, inFenceMask) {
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    const lineNo = i + 1;
    if (
      !inFenceMask[lineNo] &&
      lines[i].includes('|') &&
      i + 1 < lines.length &&
      !inFenceMask[lineNo + 1] &&
      TABLE_SEPARATOR_RE.test(lines[i + 1])
    ) {
      const headerCells = splitTableRow(lines[i]);
      const startLine = lineNo;
      let j = i + 2;
      const rows = [];
      while (j < lines.length && !inFenceMask[j + 1] && lines[j].includes('|') && lines[j].trim() !== '') {
        rows.push(splitTableRow(lines[j]));
        j++;
      }
      tables.push({ startLine, endLine: j, headerCells, rows });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

function splitTableRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((cell) => cell.trim());
}

/** Extracts every markdown link outside code fences, with a bare-link heuristic per line. */
function findLinks(lines, inFenceMask) {
  const links = [];
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (inFenceMask[lineNo]) return;
    let match;
    LINK_RE.lastIndex = 0;
    const matchesOnLine = [];
    while ((match = LINK_RE.exec(line)) !== null) {
      matchesOnLine.push({ text: match[0], linkText: match[1], url: match[2], index: match.index });
    }
    matchesOnLine.forEach((m) => {
      const listItem = line.match(LIST_ITEM_RE);
      let isBare = false;
      if (listItem) {
        const itemBody = listItem[3].trim();
        isBare = itemBody === m.text || itemBody.replace(/[.:]$/, '') === m.text;
      }
      links.push({ line: lineNo, linkText: m.linkText, url: m.url, isBare });
    });
  });
  return links;
}

/** Extracts bullet/numbered list items outside code fences. */
function findListItems(lines, inFenceMask) {
  const items = [];
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (inFenceMask[lineNo]) return;
    const match = line.match(LIST_ITEM_RE);
    if (!match) return;
    items.push({
      line: lineNo,
      indent: match[1].length,
      marker: match[2],
      ordered: /\d/.test(match[2]),
      text: match[3],
    });
  });
  return items;
}

/** Parses a markdown document into a structural model used by every check. */
function parseMarkdown(source) {
  const lines = source.split(/\r?\n/);
  const frontMatter = parseFrontMatter(lines);
  const bodyStartLine = frontMatter.present ? frontMatter.endLine + 1 : 1;
  const fences = findCodeFences(lines);
  const inFenceMask = buildInFenceMask(lines, fences);
  const headings = findHeadings(lines, inFenceMask, bodyStartLine);
  const sections = buildSections(headings, lines.length);
  const tables = findTables(lines, inFenceMask);
  const links = findLinks(lines, inFenceMask);
  const listItems = findListItems(lines, inFenceMask);

  return {
    lines,
    totalLines: lines.length,
    frontMatter,
    bodyStartLine,
    codeFences: fences,
    inFenceMask,
    headings,
    sections,
    tables,
    links,
    listItems,
  };
}

module.exports = {
  parseMarkdown,
  slugify,
  directChildren,
  ownBodyRanges,
};
