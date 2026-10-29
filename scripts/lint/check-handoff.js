#!/usr/bin/env node
'use strict';

/**
 * Lints a review hand-back: every question or decision item links to the line it
 * is about.
 *
 *   node lint/check-handoff.js <NEEDS-YOUR-INPUT.md | review-report.md>...
 *
 * During the MCP Profile Hub review, a "What needs you" section asked the reader
 * to confirm a claim and supply a link, with no pointer to the sentence in
 * question. The reader had to ask for the file and line before they could answer.
 * A question the reader cannot locate is not answerable, so this check fails the
 * hand-back instead.
 *
 * An item counts as a question when it contains a question mark or a decision
 * verb (confirm, decide, choose, approve, send me, tell me). It passes when it
 * carries a line reference: a markdown link whose target ends in #L<n>, or a
 * path:line reference such as manage-profiles.md:17.
 *
 * Items are read at three grains, finest first: a table row, a top-level list
 * item when a section holds several, and otherwise the whole section under its
 * heading. judges/judge-editorial.js --escalate writes files that always pass.
 */

const fs = require('fs');

const QUESTION_RE = /\?|\b(?:confirm|decide|choose|approve|send me|tell me|should I|do you want|which one)\b/i;
const LINE_REF_RE = /\]\([^)\s]*#L\d+(?:-L?\d+)?\)|\b[\w./-]+\.(?:md|mdx|js|json|ts|py):\d+\b/;
const HEADING_RE = /^\s{0,3}#{1,6}\s/;
const TOP_ITEM_RE = /^(?:[-*+]|\d+[.)])\s+/;
// An unordered bullet that opens on a bold label ("- **Where:** ...") is a field
// of one item, not an item of its own. Numbered items are always separate.
const FIELD_ITEM_RE = /^[-*+]\s+\*\*[^*]+:\*\*/;
const TABLE_ROW_RE = /^\s*\|/;
const TABLE_RULE_RE = /^\s*\|?\s*:?-{3,}/;

/** Lines outside fenced code, with their 1-based numbers. */
function proseLines(text) {
  const out = [];
  let fence = false;
  text.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      return;
    }
    if (!fence) out.push({ n: i + 1, line });
  });
  return out;
}

/** Splits a file into heading sections. Text above the first heading is its own section. */
function sections(lines) {
  const out = [];
  let current = { heading: null, lines: [] };
  for (const l of lines) {
    if (HEADING_RE.test(l.line)) {
      out.push(current);
      current = { heading: l, lines: [] };
    } else {
      current.lines.push(l);
    }
  }
  out.push(current);
  return out.filter((s) => s.heading || s.lines.some((l) => l.line.trim()));
}

/** Top-level list items, each with its indented continuation lines. */
function topItems(lines) {
  const items = [];
  let current = null;
  for (const l of lines) {
    if (TOP_ITEM_RE.test(l.line)) {
      current = [l];
      items.push(current);
    } else if (current && (/^\s+\S/.test(l.line) || !l.line.trim())) {
      current.push(l);
    } else if (l.line.trim()) {
      // An unindented paragraph ends the list item above it.
      current = null;
    }
  }
  return items;
}

function checkHandoff(text) {
  const problems = [];
  const report = (n, what) => problems.push({ line: n, message: `${what} asks the reader something but gives no file:line link. Add a link such as [page.md:12](path/page.md#L12).` });

  for (const sec of sections(proseLines(text))) {
    const body = sec.lines.filter((l) => !TABLE_ROW_RE.test(l.line));
    for (const row of sec.lines.filter((l) => TABLE_ROW_RE.test(l.line) && !TABLE_RULE_RE.test(l.line))) {
      if (QUESTION_RE.test(row.line) && !LINE_REF_RE.test(row.line)) report(row.n, 'Table row');
    }
    // Several bullets that each ask something are separate questions, and each
    // needs its own link. One question with field bullets around it (Where,
    // Sentence, Question) is one item, and one link in the section covers it.
    const items = topItems(body);
    const allFields = items.length > 0 && items.every((item) => FIELD_ITEM_RE.test(item[0].line));
    const asking = items.filter((item) => QUESTION_RE.test(item.map((l) => l.line).join('\n')));
    if (!allFields && asking.length >= 2) {
      for (const item of asking) {
        if (!LINE_REF_RE.test(item.map((l) => l.line).join('\n'))) report(item[0].n, 'List item');
      }
      continue;
    }
    const all = [sec.heading, ...body].filter(Boolean);
    const txt = all.map((l) => l.line).join('\n');
    if (QUESTION_RE.test(txt) && !LINE_REF_RE.test(txt)) report(all[0].n, sec.heading ? `Section "${sec.heading.line.replace(/^\s*#+\s*/, '')}"` : 'Text');
  }
  return problems;
}

function main() {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.error('Usage: node lint/check-handoff.js <hand-back.md>...');
    process.exit(2);
  }
  let total = 0;
  for (const file of files) {
    const problems = checkHandoff(fs.readFileSync(file, 'utf8'));
    total += problems.length;
    console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${file}  ${problems.length} item(s) without a line link`);
    for (const p of problems) console.log(`  L${p.line} ${p.message}`);
  }
  process.exitCode = total ? 1 : 0;
}

if (require.main === module) main();

module.exports = { checkHandoff, QUESTION_RE, LINE_REF_RE };
