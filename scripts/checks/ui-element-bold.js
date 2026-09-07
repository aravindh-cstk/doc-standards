'use strict';

const { makeFinding } = require('../lib/report');

const INLINE_CODE_RE = /`([^`]+)`/g;

// A UI label reads as title-case prose: letters, digits and single spaces, one
// to four words, starting with a capital. Anything carrying code punctuation
// (underscore, slash, dot, dash, brace) is an identifier or a path, not a label.
const LABEL_RE = /^[A-Z][A-Za-z0-9]*(?: [A-Za-z0-9]+){0,3}$/;
const HAS_LOWERCASE_RE = /[a-z]/;

// The element type a doc names beside the label. Without one of these nearby,
// a capitalized code span is more likely a value than something on the screen.
const UI_CUE_RE =
  /\b(tabs?|buttons?|menus?|menu items?|screens?|panels?|fields?|sections?|badges?|icons?|actions?|columns?|dialogs?|modals?|toggles?|checkboxes?|dropdowns?|statuses|status|wizard|clicks?|selects?|hovers?|opens?|choose|chooses)\b/i;

/** Rows of a table keyed by line number, so a row can inherit its header's cue words. */
function tableHeaderCueLines(doc) {
  const cued = new Set();
  for (const table of doc.tables || []) {
    if (!UI_CUE_RE.test(table.headerCells.join(' '))) continue;
    for (let lineNo = table.startLine; lineNo <= table.endLine; lineNo++) cued.add(lineNo);
  }
  return cued;
}

/** Tier 2: UI element names belong in bold, not inline code. */
function checkUiElementBold(doc) {
  const findings = [];
  const cuedByTable = tableHeaderCueLines(doc);

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    if (!UI_CUE_RE.test(raw) && !cuedByTable.has(lineNo)) continue;

    const labels = [];
    INLINE_CODE_RE.lastIndex = 0;
    let m;
    while ((m = INLINE_CODE_RE.exec(raw)) !== null) {
      const content = m[1].trim();
      if (!LABEL_RE.test(content)) continue;
      // A pure acronym (POST, CMA) is a literal, not a screen label.
      if (!HAS_LOWERCASE_RE.test(content)) continue;
      if (!labels.includes(content)) labels.push(content);
    }
    if (!labels.length) continue;

    findings.push(
      makeFinding({
        tier: 2,
        ruleId: 'C4-07',
        checkId: 'ui-element-bold',
        line: lineNo,
        message: `UI element name(s) in inline code: ${labels
          .map((l) => `\`${l}\``)
          .join(', ')}. Write a tab, button, menu item, screen, field, badge or card action in bold instead: ${labels
          .map((l) => `**${l}**`)
          .join(', ')}. A name the reader supplies or the product derives is a value and stays in code.`,
      })
    );
  }
  return findings;
}

module.exports = { checkUiElementBold };
