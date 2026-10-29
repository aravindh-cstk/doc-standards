'use strict';

const { maskProse } = require('../lib/prose-mask');

/**
 * Candidate generation for C2-13: a stated count that disagrees with the thing
 * it counts.
 *
 * PR #86's reading agents reported "numeric inconsistencies" across the corpus.
 * That list lived in a session and is gone, and nothing in either repo could
 * regenerate it: no check anywhere counts "three things" against the bullets
 * that follow. This is the deterministic half of getting it back.
 *
 * The failure is specific and it is not a typo. A writer states a count, then
 * edits the list, and the count stays. "Eight deliverables are mandatory" over
 * a list of seven does more damage than a missing sentence, because a reader
 * who trusts the number stops looking after the seventh and never learns what
 * the eighth was. The same shape appears as "the four steps below", "both
 * options", and a heading that says "(13)" over a table with 12 rows.
 *
 * Candidates, not findings, and the split is where this file's whole design
 * sits. A script CAN find "three" next to a list and compare it to the list's
 * length. A script CANNOT tell whether "three" was counting that list. Half the
 * hits are a sentence about three regions that happens to sit above an
 * unrelated four-item list, and reporting those as failures teaches a reader to
 * ignore the rule. So this module emits the question, judge-numbers.js answers
 * it, and only a confirmed disagreement becomes a finding.
 */

const NUMBER_WORDS = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  both: 2,
};

/**
 * A count word, or a digit, sitting where a count sits.
 *
 * Bounded to 2 through 99, and the bounds are the point. "one" is almost never
 * a count in this corpus ("one of the two", "one place"), and a bare digit
 * above 99 in prose is a version, a port, a status code or a pixel value.
 * Widening either bound trades a handful of real hits for hundreds of spurious
 * ones, which is the failure mode a candidate generator cannot afford: a
 * reviewer who stops reading the list has the same coverage as no list.
 */
const COUNT_RE = new RegExp(
  `\\b(${Object.keys(NUMBER_WORDS).join('|')}|[2-9]|[1-9][0-9])\\b`,
  'gi'
);

/**
 * The noun after the count has to be a plural the document could enumerate.
 *
 * "three regions" is a countable claim. "three times faster" is not, and
 * neither is "two hours". Excluding the unit nouns removes the largest class of
 * false candidate without excluding anything a list can hold.
 */
const UNIT_NOUNS = new Set([
  'times', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years',
  'px', 'pixels', 'rem', 'em', 'kb', 'mb', 'gb', 'ms', 'percent', 'chars', 'characters',
  'tokens', 'words', 'lines', 'bytes', 'columns', 'col', 'cols',
]);

/**
 * Words that end in "s" without being a countable plural noun.
 *
 * "both has", "two is", "three as" all satisfy the plural test and none of them
 * names a thing. On this corpus the list removes 2 candidates of 104, which is
 * a small return, but both were ones a reviewer rejects on sight and neither
 * was one a reviewer would keep. It is here so the class does not grow: the
 * plural test admits every English verb in the third person.
 */
const NOT_A_NOUN = new Set([
  'is', 'was', 'has', 'as', 'its', 'this', 'thus', 'plus', 'less', 'says', 'does',
  'goes', 'lets', 'gets', 'runs', 'needs', 'means', 'holds', 'takes', 'uses',
  'ends', 'starts', 'stays', 'works', 'reads', 'writes', 'returns', 'always',
  'perhaps', 'yes', 'versus', 'vs',
]);

/**
 * Phrases that point at a structure on the page rather than at the world.
 *
 * "the four steps below" is a claim about this document. "four regions support
 * Studio" is a claim about Contentstack. Only the first can be checked against
 * anything, and the pointing word is what separates them.
 */
const POINTER_RE = /\b(below|above|following|here|listed|these|those|next)\b/i;

const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])\s+\S/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const TABLE_ROW_RE = /^\s*\|/;

/** How far below the claim a structure may start and still be the thing counted. */
const LOOKAHEAD_LINES = 4;

function countValue(token) {
  const lower = String(token).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, lower)) return NUMBER_WORDS[lower];
  const n = parseInt(lower, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * The countable structure that starts at or just after `fromLine`, and its size.
 *
 * A list, a table's body rows, or a run of same-level headings. Returns null
 * when nothing countable starts nearby, which is the common case and the reason
 * this generator emits far fewer candidates than there are numbers in the
 * corpus.
 */
function structureAfter(doc, fromLine) {
  for (let l = fromLine; l <= Math.min(fromLine + LOOKAHEAD_LINES, doc.totalLines); l++) {
    if (doc.inFenceMask[l]) continue;
    const text = doc.lines[l - 1];
    if (!text.trim()) continue;

    if (LIST_ITEM_RE.test(text)) return listAt(doc, l);
    if (TABLE_ROW_RE.test(text)) return tableAt(doc, l);
    if (HEADING_RE.test(text)) return headingRunAt(doc, l);
    // Anything else that is not blank ends the search. A paragraph between the
    // claim and a list means the list is answering the paragraph, not the claim.
    return null;
  }
  return null;
}

/**
 * Top-level items only, and the indent rule is what makes the count meaningful.
 *
 * "Eight deliverables" over a list whose eight items each carry two sub-bullets
 * counts eight, not twenty-four. The first item's indentation sets the level,
 * and anything deeper belongs to the item above it.
 */
function listAt(doc, startLine) {
  const baseIndent = doc.lines[startLine - 1].match(/^\s*/)[0].length;
  const items = [];
  let endLine = startLine;
  let blanks = 0;

  for (let l = startLine; l <= doc.totalLines; l++) {
    if (doc.inFenceMask[l]) {
      endLine = l;
      continue;
    }
    const text = doc.lines[l - 1];
    if (!text.trim()) {
      blanks += 1;
      if (blanks >= 2) break;
      continue;
    }
    const indent = text.match(/^\s*/)[0].length;
    if (LIST_ITEM_RE.test(text) && indent <= baseIndent) {
      items.push(text.trim().slice(0, 90));
      blanks = 0;
      endLine = l;
      continue;
    }
    if (indent > baseIndent) {
      blanks = 0;
      endLine = l;
      continue;
    }
    break;
  }
  return items.length ? { kind: 'list', size: items.length, startLine, endLine, items } : null;
}

function tableAt(doc, startLine) {
  const table = (doc.tables || []).find((t) => t.startLine === startLine || t.startLine === startLine + 0);
  if (!table) return null;
  return {
    kind: 'table',
    size: table.rows.length,
    startLine: table.startLine,
    endLine: table.endLine,
    items: table.rows.slice(0, 12).map((r) => (Array.isArray(r) ? r.join(' | ') : String(r)).slice(0, 90)),
  };
}

/** A run of consecutive same-level headings, which is how several pages enumerate. */
function headingRunAt(doc, startLine) {
  const level = doc.lines[startLine - 1].match(HEADING_RE)[1].length;
  const items = [];
  let endLine = startLine;

  for (const h of doc.headings) {
    if (h.line < startLine) continue;
    if (h.level < level) break;
    if (h.level === level) {
      items.push(h.text.slice(0, 90));
      endLine = h.line;
    }
  }
  return items.length >= 2 ? { kind: 'heading run', size: items.length, startLine, endLine, items } : null;
}

/**
 * The count claims on one line, each with the noun it counts.
 *
 * Runs over the prose mask, so a number inside a code span, a version string in
 * backticks, a link target or an HTML attribute is not a claim.
 */
function claimsOn(text) {
  const masked = maskProse(text);
  const out = [];
  COUNT_RE.lastIndex = 0;
  for (const m of masked.matchAll(COUNT_RE)) {
    const value = countValue(m[0]);
    if (value === null || value < 2 || value > 99) continue;

    const after = masked.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const noun = (after.match(/^\s+([a-zA-Z][a-zA-Z-]*)/) || [])[1];
    if (!noun) continue;
    if (UNIT_NOUNS.has(noun.toLowerCase())) continue;
    if (NOT_A_NOUN.has(noun.toLowerCase())) continue;
    // "both" carries its own noun requirement loosely, everything else needs a
    // plural. A singular noun after a count is a compound ("three-step flow"),
    // not an enumeration.
    if (m[0].toLowerCase() !== 'both' && !/s$/i.test(noun)) continue;

    out.push({ token: m[0], value, noun, index: m.index });
  }
  return out;
}

/**
 * Candidates for one document.
 *
 * A claim becomes a candidate only when it points at the page ("below",
 * "following") AND a countable structure starts within four lines AND the
 * numbers disagree. All three, because any two of them without the third
 * produce a list a reviewer abandons.
 */
function collectNumericCandidates(doc) {
  const candidates = [];

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const text = doc.lines[lineNo - 1];
    if (!text.trim()) continue;

    const claims = claimsOn(text);
    if (!claims.length) continue;
    const pointsAtPage = POINTER_RE.test(maskProse(text)) || /^#{1,6}\s/.test(text) || /:\s*$/.test(text.trim());
    if (!pointsAtPage) continue;

    const structure = structureAfter(doc, lineNo + 1);
    if (!structure) continue;

    for (const claim of claims) {
      if (claim.value === structure.size) continue;

      candidates.push({
        candidateId: `C2-13:${doc.filePath.split('/').pop()}:${lineNo}:${claim.token}`,
        ruleId: 'C2-13',
        checkId: 'numeric-consistency',
        tier: 1,
        file: doc.filePath,
        line: lineNo,
        endLine: structure.endLine,
        claim: `${claim.token} ${claim.noun}`,
        claimed: claim.value,
        found: structure.size,
        structure: structure.kind,
        signal:
          `The line claims ${claim.value} ${claim.noun} and points at the page, ` +
          `and the ${structure.kind} that follows has ${structure.size} items.`,
        evidence: [`claim: ${text.trim().slice(0, 160)}`, ...structure.items.map((i) => `item: ${i}`)],
        decide:
          `Was "${claim.token} ${claim.noun}" counting this ${structure.kind}? ` +
          `Answer VIOLATION only if it was, and the count is therefore wrong.`,
      });
    }
  }

  return candidates;
}

module.exports = {
  collectNumericCandidates,
  claimsOn,
  structureAfter,
  listAt,
  headingRunAt,
  NUMBER_WORDS,
  UNIT_NOUNS,
  NOT_A_NOUN,
  POINTER_RE,
};
