'use strict';

const { makeFinding } = require('../lib/report');
const { maskProse } = require('../lib/prose-mask');

/**
 * Tier 1: no typographic characters standing in for words in prose (C3-30).
 *
 * These characters were declared out of scope when C3-27 (emoji and arrows) was
 * added, on the true observation that none of them is an emoji or an arrow.
 * Nobody checked where they actually sit. Classifying every occurrence in this
 * corpus through the same prose mask C3-27 uses gives, on the 170 published
 * pages:
 *
 *     ·   116 in prose      a heading separator, "Session 1 · Block A"
 *     §    66 in prose      cross-reference notation inside a link label
 *     …    59 in prose      a trailing elision, "Hero, Card, Button…"
 *     ×     9 in prose      dimensions, "3×3 grid", "1440 × N"
 *     ≥     7 in prose      a version floor, "Node ≥ 18"
 *     ≤ ≠   4 in prose
 *     •     0 in prose      every occurrence is inside a fence
 *     box drawing  0 in prose, all 315 inside fences
 *
 * So the box-drawing set really is out of scope, and this rule leaves it alone:
 * an ASCII diagram inside a fence is a picture, and its characters are the
 * picture. Everything above it is a word the writer did not write.
 *
 * Each one fails for the same reason an arrow does. A screen reader says
 * nothing useful for "·" and "≥". A translator has no target for them. And each
 * stands for a different word depending on where it sits, so the reader
 * reconstructs a relation the sentence should have stated: "§" is "section" in
 * one line and a paragraph mark in another, "…" is "and so on" in one and a
 * trailing-off tone in another.
 *
 * `•` and the box-drawing characters are in the banned set even though the
 * corpus has none in prose today, for the reason C3-27 gives about defining a
 * rule by range rather than by inventory. A rule that bans only what it has
 * already seen stops working the first time somebody pastes something new. Box
 * drawing is excluded from the set entirely rather than banned-then-excepted,
 * because inside a fence is where it belongs and the fence mask already covers
 * that.
 */

/**
 * The banned characters, each with the substitution that names what it stood
 * for.
 *
 * Naming the replacement matters more than the ban. "Remove the ·" is not
 * actionable: the writer has to decide whether it was a colon, a dash or a
 * word. These hints name the choice rather than make it, which is the same
 * contract HINTS carries in no-emoji.js.
 */
const HINTS = {
  '·': 'use a colon in a heading ("Session 1: Block A"), or "and" between items',
  '§': 'write "section", or link the section directly ("see [Step 3](...)")',
  '…': 'write "and so on", or name the last item and stop',
  '×': 'write "by" for dimensions ("1440 by 900"), or "x" where the product is the point',
  '≥': 'write "or later", "at least", or "or more" ("Node 18 or later")',
  '≤': 'write "or earlier", "at most", or "or fewer"',
  '≠': 'write "is not" or "differs from"',
  '•': 'use a Markdown list item, or a comma between items in a sentence',
  '‣': 'use a Markdown list item, or a comma between items in a sentence',
  '⁃': 'use a Markdown list item, or a comma between items in a sentence',
  '±': 'write "plus or minus"',
  '≈': 'write "about" or "approximately"',
  '∞': 'write "unlimited", or name the actual ceiling',
  '™': null,
};

/**
 * The three that stay.
 *
 * `©`, `®` and `™` are legal marks rather than decoration, exactly as C3-27
 * exempts them. `°` stays because a temperature or an angle has no word form
 * that reads better. `–` and `—` are not here at all: C3-05 already owns dashes,
 * and two rules reporting the same character would give a writer two findings
 * for one edit.
 */
const ALLOWED = new Set(['©', '®', '™', '°']);

const BANNED = Object.keys(HINTS).filter((ch) => !ALLOWED.has(ch));
const BANNED_RE = new RegExp(`[${BANNED.map((c) => `\\u${c.codePointAt(0).toString(16).padStart(4, '0')}`).join('')}]`, 'gu');

function describe(ch) {
  const cp = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  const hint = HINTS[ch];
  return hint ? `"${ch}" (U+${cp}), ${hint}` : `"${ch}" (U+${cp})`;
}

/**
 * One finding per line rather than per character, for the reason C3-27 gives:
 * a line carrying four separators is one editorial decision, and reporting four
 * findings buries every other rule on the page.
 */
function checkTypographicSubstitutes(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    if (!BANNED_RE.test(raw)) {
      BANNED_RE.lastIndex = 0;
      continue;
    }
    BANNED_RE.lastIndex = 0;

    // Over the mask, so a character inside a code span, a link target, an HTML
    // attribute or a bare URL is not a finding. That masking is what proves the
    // box-drawing set safe, and it is what keeps "≤ 256 chars" inside a schema
    // table's code cell from reading as prose.
    const masked = maskProse(raw);
    const seen = [];
    for (const m of masked.matchAll(BANNED_RE)) {
      if (!seen.includes(m[0])) seen.push(m[0]);
    }
    if (seen.length === 0) continue;

    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'C3-30',
        checkId: 'typographic-substitutes',
        line: lineNo,
        message:
          `Typographic character standing in for a word: ${seen.map(describe).join('; ')}. ` +
          `Line: ${raw.trim().slice(0, 100)}`,
      })
    );
  }
  return findings;
}

module.exports = { checkTypographicSubstitutes, BANNED, BANNED_RE, ALLOWED, HINTS };
