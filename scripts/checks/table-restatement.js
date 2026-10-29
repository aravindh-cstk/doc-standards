'use strict';

const { makeFinding } = require('../lib/report');
const { shingles, containment } = require('../lib/similarity');

const WINDOW = 10;
// Containment, not Jaccard: a table row is short and the block echoing it is
// long, so overall similarity scores low on exactly the case the rule targets.
const THRESHOLD = 0.6;

const CALLOUT_RE = /^\s*>\s*\*\*(Warning|Note|Tip|Additional Resources?)\s*:\*\*\s*(.*)$/;
const BOLD_LEADIN_RE = /^\s*\*\*[^*]+\*\*\s+\S/;
const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/;

/** Prose blocks in the window after a table, each as {line, text, kind}. */
function blocksAfterTable(doc, table) {
  const blocks = [];
  const last = Math.min(table.endLine + WINDOW, doc.totalLines);

  for (let n = table.endLine + 1; n <= last; n++) {
    if (doc.inFenceMask[n]) continue;
    const raw = doc.lines[n - 1];
    if (raw.trim() === '') continue;
    // A following heading ends the table's neighbourhood.
    if (/^#{1,6}\s/.test(raw)) break;
    // Another table's rows are not a restatement of this one.
    if (raw.trim().startsWith('|')) continue;

    const callout = CALLOUT_RE.exec(raw);
    if (callout) {
      blocks.push({ line: n, text: callout[2], kind: `${callout[1]} callout` });
      continue;
    }
    const item = LIST_ITEM_RE.exec(raw);
    if (item) {
      blocks.push({ line: n, text: item[1], kind: 'list item' });
      continue;
    }
    if (BOLD_LEADIN_RE.test(raw)) {
      blocks.push({ line: n, text: raw.trim(), kind: 'bolded paragraph' });
    }
  }
  return blocks;
}

/** Tier 2: a block beside a table must add what the table cannot show. */
function checkTableRestatement(doc) {
  const findings = [];

  for (const table of doc.tables || []) {
    const blocks = blocksAfterTable(doc, table);
    if (!blocks.length) continue;

    for (const block of blocks) {
      const blockShingles = shingles(block.text, 3);
      if (blockShingles.size === 0) continue;

      let worst = null;
      for (let i = 0; i < table.rows.length; i++) {
        const rowText = table.rows[i].join(' ');
        const score = containment(blockShingles, shingles(rowText, 3));
        if (score >= THRESHOLD && (!worst || score > worst.score)) {
          // Row line numbers are not stored on the table, so derive them.
          // The header is startLine, the separator startLine + 1.
          worst = { score, rowLine: table.startLine + i + 2, rowText };
        }
      }
      if (!worst) continue;

      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C7-04',
          checkId: 'table-restatement',
          line: block.line,
          message: `This ${block.kind} restates the table row at line ${worst.rowLine} ("${worst.rowText.slice(
            0,
            70
          )}") and adds little the row does not carry. Move anything new into the row, or cut the block.`,
        })
      );
    }
  }

  return findings;
}

module.exports = { checkTableRestatement };
