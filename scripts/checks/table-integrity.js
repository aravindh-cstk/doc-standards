'use strict';

const { makeFinding } = require('../lib/report');
const { splitCells, isTableRow, rowShapeProblems } = require('../lib/table-shape');

/**
 * Tier 1: every table row has the header's cell count and structurally intact
 * cells (C2-10).
 *
 * This rule exists because a corpus-wide punctuation pass corrupted 19 table
 * rows and nothing in the toolkit was looking. `findTables()` has always
 * returned `headerCells` and `rows` and no check ever compared their lengths.
 *
 * Both halves of the rule are needed, and the reported defect is the reason
 * why. A pass turned
 *
 *   | Does it render multiple things AND arrange them? | **Compound — decompose** | — |
 *
 * into
 *
 *   | Does it render multiple things AND arrange them? | **Compound (decompose** |) |
 *
 * which still has three cells. A cell-count check alone passes it. The only
 * mechanical tell is that cell 2 opens a paren it never closes and cell 3
 * closes one it never opened, which is what the shape half catches.
 *
 * Conversely a row can have balanced cells and the wrong number of them, which
 * is what an unescaped `|` in prose does. `authenticate-cma.md:129` carries a
 * literal pipe inside a JSON sample and renders as four columns in a
 * three-column table.
 *
 * Tier 1 because both halves are mechanically certain. A row either has the
 * header's cell count or it does not, and a paren either closes or it does not.
 */
function checkTableIntegrity(doc) {
  const findings = [];

  for (const table of doc.tables || []) {
    const headerLine = doc.lines[table.startLine - 1];
    const headerCells = splitCells(headerLine);

    /**
     * A blank leading header cell is idiomatic, not a defect.
     *
     * "| | Component Slot | Section Slot |" is a comparison table whose first
     * column holds the dimension being compared, so that cell has nothing to
     * name. 18 of the 19 blank header cells in this corpus are exactly that
     * shape, and flagging them would have made the rule's first run 19 parts
     * noise to 1 part signal.
     *
     * The exception is narrow on purpose. It only applies to the first cell,
     * and only when some other cell does carry a label, which still catches a
     * table with no header row at all ("| | |") and a column lost from the
     * middle or the end.
     */
    const anyLabelled = headerCells.some((c) => c !== '');
    if (!anyLabelled && headerCells.length > 0) {
      // One finding for the table, not one per cell. The defect is the missing
      // header row, and it is a single edit.
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C2-10',
          checkId: 'table-integrity',
          line: table.startLine,
          message:
            `Table has no header labels at all (${headerCells.length} empty header cells). ` +
            `Name each column, so a reader knows what the values are.`,
        })
      );
    } else {
      headerCells.forEach((cell, index) => {
        if (cell !== '' || index === 0) return;
        findings.push(
          makeFinding({
            tier: 1,
            ruleId: 'C2-10',
            checkId: 'table-integrity',
            line: table.startLine,
            message:
              `Table header cell ${index + 1} of ${headerCells.length} is empty, and it is ` +
              `not the leading column. Name the column, or remove it if the table does not ` +
              `need it.`,
          })
        );
      });
    }

    // startLine is the header and startLine + 1 is the alignment row, so data
    // starts two below. endLine is inclusive of the last data row.
    for (let lineNo = table.startLine + 2; lineNo <= table.endLine; lineNo++) {
      const raw = doc.lines[lineNo - 1];
      if (!raw || !isTableRow(raw)) continue;

      const cells = splitCells(raw);
      if (cells.length !== headerCells.length) {
        findings.push(
          makeFinding({
            tier: 1,
            ruleId: 'C2-10',
            checkId: 'table-integrity',
            line: lineNo,
            message:
              `Table row has ${cells.length} cells against ${headerCells.length} in the header. ` +
              `An unescaped "|" inside a cell splits it, so write it as "\\|" or wrap it in ` +
              `backticks. Line: ${raw.trim().slice(0, 100)}`,
          })
        );
      }

      for (const p of rowShapeProblems(raw)) {
        findings.push(
          makeFinding({
            tier: 1,
            ruleId: 'C2-10',
            checkId: 'table-integrity',
            line: lineNo,
            message:
              `Table cell ${p.cell} has ${p.problem}. This usually means punctuation was ` +
              `moved across a cell boundary, so the cell contents no longer read as written. ` +
              `Cell: ${p.text.slice(0, 80)}`,
          })
        );
      }
    }
  }

  return findings;
}

module.exports = { checkTableIntegrity };
