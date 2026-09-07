'use strict';

const { makeFinding } = require('../lib/report');
const { maskProse } = require('../lib/prose-mask');

/**
 * Tier 1: no emoji, arrows, or pictographic marks in prose (C3-27).
 *
 * Emoji render differently on every operating system and font, they carry no
 * meaning a screen reader can convey, and they are not translatable. Arrows are
 * banned for a related but distinct reason: "Settings -> Advanced" and
 * "Layer 1 -> Layer 2" and "If yes ->" all use the same glyph to mean three
 * different things, so the reader has to infer the relation the sentence should
 * have stated.
 *
 * The banned set is defined by RANGE rather than by a list of the characters
 * this corpus happens to contain today. A rule that enumerates what it has seen
 * stops working the first time somebody pastes a new emoji, which is exactly
 * the failure this rule exists to prevent. The corpus inventory at the time of
 * writing was 66 distinct characters above U+2000, of which the ranges below
 * cover 5,217 occurrences across 42 distinct characters.
 */

/**
 * Anything Unicode considers pictographic, which is the forward-compatible half
 * of the definition: every emoji added in a future Unicode revision carries
 * this property.
 */
const PICTOGRAPHIC = '\\p{Extended_Pictographic}';

/**
 * The four arrow blocks. Arrows, Supplemental Arrows-A and -B, and the arrow
 * range at the start of Miscellaneous Symbols and Arrows. Stopping at U+2B11
 * matters: the rest of that block is stars and geometric shapes, and U+2B12
 * onward has no arrows in it.
 */
const ARROWS = '\\u2190-\\u21FF\\u27F0-\\u27FF\\u2900-\\u297F\\u2B00-\\u2B11';

/**
 * Dingbat and geometric marks that read as emoji but do not carry the
 * Extended_Pictographic property, so the property alone misses them.
 *
 * This corpus uses U+2713 CHECK MARK (47 times) and U+2717 BALLOT X (23) for
 * exactly the same job as U+2705 and U+274C, which the property does catch.
 * Banning one pair and permitting the other would be arbitrary.
 */
const MARKS = '\\u2713-\\u2718\\u2751-\\u2757\\u276C-\\u2775\\u25A0-\\u25FF';

/**
 * The invisible tail of an emoji presentation sequence. U+FE0F appears 41 times
 * here, always after a base character such as U+26A0, turning the text-style
 * glyph into the colour one. It must go with its base character rather than be
 * left behind as an orphan, so it is banned in its own right.
 */
const VARIATION = '\\uFE0F';

const EMOJI_RE = new RegExp(`[${ARROWS}${MARKS}${VARIATION}]|${PICTOGRAPHIC}`, 'u');
const EMOJI_G = new RegExp(EMOJI_RE.source, 'gu');

/**
 * The only characters inside the banned ranges that survive.
 *
 * All three are Extended_Pictographic and all three are legal, load-bearing
 * text in product documentation: a trademark or copyright notice is a legal
 * mark, not decoration. None occurs in this corpus today, so the exemption is
 * here to keep the rule from being wrong later rather than to excuse anything
 * present now.
 */
const ALLOWED = new Set(['©', '®', '™']);

/**
 * What to write instead, for the shapes this corpus actually uses.
 *
 * Naming a replacement matters more than usual here. The reason arrows are
 * banned is that one glyph stands for several different relations, so "remove
 * the arrow" is not actionable on its own: the writer has to decide which
 * relation they meant. These hints name the choice rather than make it.
 */
const HINTS = {
  '→': 'name the relation: "then" for a UI path, "to" for a range, "becomes" for a mapping',
  '←': 'name the relation, usually "comes from" or "reads from"',
  '↔': 'name the relation, usually "maps to" or "and"',
  '⇄': 'name the relation, usually "in both directions"',
  '⇒': 'name the relation, usually "means" or "produces"',
  '✅': 'write "Yes", or the condition the tick stands for',
  '✔': 'write "Yes", or the condition the tick stands for',
  '✓': 'write "Yes", or the condition the tick stands for',
  '❌': 'write "No", or the condition the cross stands for',
  '✗': 'write "No", or the condition the cross stands for',
  '✘': 'write "No", or the condition the cross stands for',
  '⛔': 'write "Stop." or "Do not", as a sentence',
  '⚠': 'drop it, the callout or heading already says what the warning is',
  '️': 'drop it along with the emoji it follows',
};

function describe(ch) {
  const cp = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  const shown = ch === '️' ? 'U+FE0F variation selector' : `"${ch}" (U+${cp})`;
  const hint = HINTS[ch];
  return hint ? `${shown}, ${hint}` : shown;
}

/**
 * One finding per line rather than per character, matching C3-05.
 *
 * A line carrying five arrows is one editorial decision, not five, and the
 * corpus has lines with a dozen. Reporting per character turned a 300-line file
 * into a wall of findings that hid every other rule.
 */
function checkNoEmoji(doc) {
  const findings = [];
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];

    // Matching runs over the mask with a global unicode regex rather than
    // through proseMatches. proseMatches tests one UTF-16 code unit at a time,
    // which is correct for a dash or a semicolon but silently misses every
    // astral emoji: a lone surrogate has no Unicode property, so U+1F680 and
    // the whole 1F range read as two characters that match nothing. Because the
    // mask blanks protected spans to spaces of the same length, anything that
    // matches in the mask is prose by definition.
    const masked = maskProse(raw);
    const seen = [];
    for (const m of masked.matchAll(EMOJI_G)) {
      if (ALLOWED.has(m[0])) continue;
      if (!seen.includes(m[0])) seen.push(m[0]);
    }
    if (seen.length === 0) continue;

    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'C3-27',
        checkId: 'no-emoji',
        line: lineNo,
        message:
          `Emoji or arrow in prose: ${seen.map(describe).join('; ')}. ` +
          `Line: ${raw.trim().slice(0, 100)}`,
      })
    );
  }
  return findings;
}

module.exports = { checkNoEmoji, EMOJI_RE, EMOJI_G, ALLOWED, HINTS };
