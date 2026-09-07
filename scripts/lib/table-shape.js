'use strict';

/**
 * One definition of "where do this table row's cells begin and end".
 *
 * A corpus-wide punctuation pass corrupted 19 table rows and nothing caught it.
 * The rule that did the damage, `fixPairedDashes`, converts a matched pair of
 * spaced em dashes into parentheses. Given
 *
 *   | Does it render multiple things AND arrange them? | **Compound — decompose** | — |
 *
 * it saw two spaced dashes, had no idea a `|` sat between them, and emitted
 *
 *   | Does it render multiple things AND arrange them? | **Compound (decompose** |) |
 *
 * The opening paren landed mid cell 2 and the closing paren landed after the
 * pipe, so the bold run now ends inside a parenthetical and the third cell is a
 * lone `)`. The row still had three cells, so a cell-count check would have
 * passed it. The only mechanical tell was the unbalanced paren.
 *
 * Every gate missed it for a different reason, and all four reasons trace back
 * to nobody owning the question "is this row still shaped like a table row":
 *
 *   - verify-edit-integrity.js compares word sequences with `*`, `(` and `)`
 *     stripped, so both versions reduced to the same list.
 *   - plan_push.py asserts the Markdown is a fixed point, and broken Markdown is
 *     a perfectly stable fixed point.
 *   - doc-standards had no table rule at all.
 *
 * So the splitter, the shape assertions and the pipe accounting live here, and
 * the fixer, the integrity verifier and the C2-10 check all import them. The
 * same lesson produced lib/prose-mask.js, for the same reason: two copies of
 * "what counts as prose" disagreed and the check reported 296 findings its own
 * fixer put at zero.
 */

const { maskMarkup } = require('./prose-mask');

/** A GFM row opens with a pipe, allowing for list or blockquote indentation. */
const TABLE_ROW_RE = /^\s*\|/;

/** The `|---|:--:|` alignment row, which has no cell content to check. */
const ALIGNMENT_ROW_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

/**
 * A complete markdown link or image.
 *
 * This has to be blanked BEFORE the prose mask runs, not after. The mask's own
 * link pattern is `\]\([^)]*\)`, which covers the `](target)` half and leaves
 * the `[text` half standing, so counting brackets on a masked cell reports an
 * unbalanced `[` for every linked cell in the corpus. Blanking the whole link
 * first leaves nothing for either count to trip on.
 */
const COMPLETE_LINK_RE = /!?\[[^\]]*\]\([^)]*\)/g;

/** Replace every match with spaces of the same length, so offsets hold. */
function blankMatches(text, re) {
  return text.replace(re, (m) => ' '.repeat(m.length));
}

/**
 * The row with links blanked and then the prose mask applied, same length as
 * the input so a cell span indexes both identically.
 */
function shapeMask(line) {
  return maskMarkup(blankMatches(line, COMPLETE_LINK_RE));
}

function isTableRow(line) {
  return TABLE_ROW_RE.test(line);
}

function isAlignmentRow(line) {
  return ALIGNMENT_ROW_RE.test(line);
}

/**
 * Indices of the pipes that actually separate cells.
 *
 * Three kinds of pipe are not separators, and all three occur in this corpus:
 * one inside an inline code span (`` `a|b` ``), one inside an HTML tag or
 * attribute, and one escaped as `\|`. The first two come free from the prose
 * mask, which blanks those spans to spaces of the same length so an index into
 * the mask still indexes the original.
 */
function separatorIndices(line) {
  // maskMarkup, not maskProse. An `alt` value's words are prose, so a dash
  // there is a finding, but a pipe there is still inside an attribute and
  // cannot separate cells. Using the prose mask here made a pipe in alt text
  // split a table row.
  const masked = maskMarkup(line);
  const out = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '|') continue;
    if (masked[i] !== '|') continue;
    if (i > 0 && line[i - 1] === '\\') continue;
    out.push(i);
  }
  return out;
}

/**
 * Cell spans as [start, end) index pairs, so the caller can slice either the
 * raw line or its mask with the same offsets.
 *
 * A GFM row's outer pipes are delimiters rather than separators, so the empty
 * fragments outside them are dropped. Only the outermost fragment is dropped on
 * each side: a row that genuinely ends in an empty cell, `| a | b | |`, keeps
 * that cell.
 */
function cellSpans(line) {
  const seps = separatorIndices(line);
  if (seps.length === 0) return [[0, line.length]];

  // A trailing HTML comment sits outside the row. Four rows in this corpus end
  // with `<!-- style-lint: allow -->` after the closing pipe, a pragma for a
  // different linter, and counting it as a cell reported each of them as having
  // one column too many.
  const trailingComment = line.match(/\s*<!--[\s\S]*?-->\s*$/);
  const end = trailingComment ? trailingComment.index : line.length;

  const spans = [];
  let cursor = 0;
  for (const at of seps) {
    if (at >= end) break;
    spans.push([cursor, at]);
    cursor = at + 1;
  }
  spans.push([cursor, end]);

  const isBlank = ([s, e]) => line.slice(s, e).trim() === '';
  if (spans.length && isBlank(spans[0])) spans.shift();
  if (spans.length && isBlank(spans[spans.length - 1])) spans.pop();
  return spans;
}

/** The row's cells, trimmed. */
function splitCells(line) {
  return cellSpans(line).map(([s, e]) => line.slice(s, e).trim());
}

function countOf(text, ch) {
  let n = 0;
  for (const c of text) if (c === ch) n += 1;
  return n;
}

/**
 * What is structurally wrong inside one cell, given that cell already masked.
 *
 * Counting happens on the mask so a paren or asterisk inside inline code, an
 * HTML attribute or a link target is not counted. `style="max-width: 680px"`
 * and `` `f(x)` `` are legal and common.
 */
function maskedCellProblems(maskedCell) {
  const text = maskedCell;
  const problems = [];

  if (countOf(text, '*') > 0) {
    const runs = (text.match(/\*\*/g) || []).length;
    if (runs % 2 === 1) problems.push('a ** bold marker opens and never closes');
  }

  const open = countOf(text, '(');
  const close = countOf(text, ')');
  if (open !== close) {
    problems.push(`unbalanced parentheses (${open} "(" against ${close} ")")`);
  }

  const openSq = countOf(text, '[');
  const closeSq = countOf(text, ']');
  if (openSq !== closeSq) {
    problems.push(`unbalanced brackets (${openSq} "[" against ${closeSq} "]")`);
  }

  return problems;
}

/**
 * Every shape problem in one table row, as `{cell, text, problem}` objects.
 *
 * Returns an empty array for anything that is not a content row, including the
 * alignment row, so a caller can hand it every line of a table without
 * pre-filtering.
 */
function rowShapeProblems(line) {
  if (!isTableRow(line) || isAlignmentRow(line)) return [];
  const spans = cellSpans(line);
  if (spans.length < 1) return [];

  const masked = shapeMask(line);
  const out = [];
  spans.forEach(([s, e], index) => {
    const raw = line.slice(s, e).trim();
    for (const problem of maskedCellProblems(masked.slice(s, e))) {
      out.push({ cell: index + 1, text: raw, problem });
    }
  });
  return out;
}

/** True when every cell in the row is structurally intact. */
function rowShapeOk(line) {
  return rowShapeProblems(line).length === 0;
}

/** How many cell separators the row has, for a before-and-after comparison. */
function separatorCount(line) {
  return separatorIndices(line).length;
}

module.exports = {
  isTableRow,
  isAlignmentRow,
  shapeMask,
  separatorIndices,
  separatorCount,
  cellSpans,
  splitCells,
  rowShapeProblems,
  rowShapeOk,
  maskedCellProblems,
  TABLE_ROW_RE,
  ALIGNMENT_ROW_RE,
};
