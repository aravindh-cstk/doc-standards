'use strict';

/**
 * C2-16, tier 2: a long sentence that packs a list or a chain of clauses.
 *
 * C3-07 asks whether a long sentence is wordy. This rule asks a different
 * question: can a reader skim it? The MCP Profile Hub review found a 44-word
 * Limitations sentence that held three separate limits joined by commas, and a
 * 37-word Root Cause sentence that chained a cause, a consequence and a caveat.
 * Neither was wordy. Both were hard to scan, and the fix was structural: bullets
 * with a lead-in for the first, three short sentences for the second.
 *
 * The check fires when a sentence runs past LIST_SIGNAL_WORDS and carries a list
 * signal, or runs past HARD_LIMIT_WORDS on any shape. Which repair applies is a
 * reading question, so every finding is also a judge candidate (generator
 * skimmableSentence in tier3-candidates.js).
 */

const { makeFinding } = require('../lib/report');
const { normalizeLine, splitSentences, wordCount } = require('./sentence-concision');

const LIST_SIGNAL_WORDS = 30;
const HARD_LIMIT_WORDS = 40;
// Three or more comma-separated items closed by "and" or "or".
const SERIES_RE = /,[^,]+,[^,]*\b(?:and|or)\b/;
// A comma join, a causal join, or "and" opening a second predicate ("and can be added").
const JOINER_RE = /,\s*(?:and|but|so|which|while|whereas)\b|\b(?:as a result|because|so that|which means)\b|\band (?:can|could|will|would|must|may|is|are|was|were|then)\b/gi;

/** Why a sentence is hard to scan, or null when it is fine. */
function skimSignal(sentence) {
  const words = wordCount(sentence);
  if (words > HARD_LIMIT_WORDS) return { words, reason: `${words} words` };
  if (words <= LIST_SIGNAL_WORDS) return null;
  if (SERIES_RE.test(sentence)) return { words, reason: `${words} words holding a comma series` };
  const joins = (sentence.match(JOINER_RE) || []).length;
  if (joins >= 2) return { words, reason: `${words} words chaining ${joins} clauses` };
  return null;
}

/** Lines whose sentences this rule reads: prose and list items, never headings, tables, callouts or images. */
function readableLines(doc) {
  return doc
    .proseLineNumbers(doc.bodyStartLine, doc.totalLines)
    .filter((lineNo) => {
      const raw = String(doc.lines[lineNo - 1]);
      return raw.trim() && !/^\s*(?:#{1,6}\s|\||>|!\[|<)/.test(raw);
    });
}

function checkSkimmableSentence(doc) {
  const findings = [];
  for (const lineNo of readableLines(doc)) {
    for (const sentence of splitSentences(normalizeLine(doc.lines[lineNo - 1]))) {
      const signal = skimSignal(sentence);
      if (!signal) continue;
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C2-16',
          checkId: 'skimmable-sentence',
          line: lineNo,
          message: `Sentence is hard to skim (${signal.reason}): "${sentence.slice(0, 90)}${sentence.length > 90 ? '...' : ''}". Fix: when it lists separate facts, turn them into bullets under a lead-in that names the list. When it chains a cause and its effects, split it into two or three sentences joined by connectives such as "As a result" or "However".`,
          falsePositiveNote:
            'A long sentence that states one idea with no series and no chained clauses can stay. The judge (judges/judge-editorial.js) decides between bullets, a split, or no change, and checks that bullets keep the information flow.',
        })
      );
    }
  }
  return findings;
}

module.exports = { checkSkimmableSentence, skimSignal, readableLines, LIST_SIGNAL_WORDS, HARD_LIMIT_WORDS };
