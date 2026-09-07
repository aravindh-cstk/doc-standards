'use strict';

/**
 * C3-24, tier 2: a demonstrative that points FORWARD at a block the reader has
 * not seen yet.
 *
 * The defect is directional, not lexical. "This grants no extra access" after
 * the behavior it summarizes is correct English and correct house style, and
 * the same words one paragraph earlier would be wrong. So a wordlist hit alone
 * can never be the finding: the check fires only when the referent provably
 * sits AFTER the sentence.
 *
 * That is what `pointsForward` decides, and it is the whole precision budget of
 * this check. Loosening it turns every correct backward demonstrative in the
 * corpus red, which is why the gate is a structural fact about the next line
 * rather than a second wordlist.
 *
 * Built on lib/phrase-list.js rather than copied from checks/metaphor-phrases.js.
 * That module predates the lib and masks no link targets, and an anchor slug
 * such as #the-url-decides-which-profile-a-client-can-use would otherwise
 * report this rule in every file that links to the heading.
 */

const path = require('path');

const { makeFinding } = require('../lib/report');
const { loadPhraseList, scanDoc } = require('../lib/phrase-list');

const DATA_DIR = path.join(__dirname, '..', 'data', 'vague-reference');

/** A markdown table row. The pipe-delimited cell is never the lead-in to a block. */
const TABLE_ROW_RE = /^\s*\|/;

/** A bullet or a numbered step. Either one opens the structure a lead-in points at. */
const LIST_ITEM_RE = /^\s*(?:[-*+]\s|\d+[.)]\s)/;

/** A heading names its own section, so C3-24 has nothing to say about it. */
const HEADING_RE = /^\s*#{1,6}\s/;

/** A trailing colon, allowing for trailing whitespace only. */
const LEAD_IN_RE = /:\s*$/;

/**
 * The next line that carries content, skipping blanks. Returns 0 past the end,
 * which every caller reads as "nothing follows", the safe answer.
 */
function nextContentLine(doc, lineNo) {
  for (let n = lineNo + 1; n <= doc.totalLines; n++) {
    if (String(doc.lines[n - 1]).trim() !== '') return n;
  }
  return 0;
}

/**
 * True when the element the sentence points at comes after the sentence.
 *
 * Two signals, either one sufficient:
 *
 *   the line ends in a colon, which in this doc set always introduces what
 *   follows, or
 *
 *   the next content line opens a fenced block, a table, or a list, so the
 *   sentence is the last prose before a structure.
 *
 * A sentence followed by more prose fails both and is left alone, because a
 * demonstrative there is almost always resolving something already said.
 */
function pointsForward(doc, lineNo) {
  const raw = String(doc.lines[lineNo - 1]);
  if (LEAD_IN_RE.test(raw)) return true;

  const next = nextContentLine(doc, lineNo);
  if (!next) return false;
  if (doc.inFenceMask[next]) return true;

  const nextRaw = String(doc.lines[next - 1]);
  return TABLE_ROW_RE.test(nextRaw) || LIST_ITEM_RE.test(nextRaw);
}

function checkVagueReference(doc) {
  const entries = loadPhraseList(DATA_DIR);
  const findings = [];
  // One finding per line. Two entries can match the same sentence, and
  // reporting it twice tells the writer nothing the first report did not.
  const reported = new Set();

  scanDoc(doc, entries, {
    onMatch: ({ error, entry, line, matched, raw }) => {
      if (error) {
        findings.push(
          makeFinding({ tier: 2, ruleId: 'C3-24', checkId: 'vague-reference', line, message: error })
        );
        return;
      }
      if (reported.has(line)) return;
      if (HEADING_RE.test(String(raw)) || TABLE_ROW_RE.test(String(raw))) return;
      if (!pointsForward(doc, line)) return;

      reported.add(line);
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C3-24',
          checkId: 'vague-reference',
          line,
          message: `Forward-pointing demonstrative "${entry.label || matched}" introduces a block the reader has not seen yet: ${String(raw).trim().slice(0, 100)}. Fix: ${entry.fix}`,
          falsePositiveNote:
            'The check fires only when the line ends in a colon or the next content line opens a fence, a table, or a list, so a backward demonstrative resolving the paragraph above is not flagged. If the referent really is above and the line still ends in a colon, name the direction anyway, for example the table above, since the reader cannot tell direction from the demonstrative alone.',
        })
      );
    },
  });

  return findings;
}

module.exports = { checkVagueReference, pointsForward };
