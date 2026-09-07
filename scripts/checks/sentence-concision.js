'use strict';

const path = require('path');
const { makeFinding } = require('../lib/report');
const { loadEntryFile, entryRegex } = require('../lib/phrase-list');

const WORDY_PHRASES_PATH = path.join(__dirname, '..', 'data', 'wordy-connectors.json');
const INLINE_CODE_RE = /`[^`]*`/g;
const LINK_RE = /\[[^\]]*\]\([^)]*\)/g;
const LIST_MARKER_RE = /^\s*(?:[-*+]|\d+\.)\s+/;
const SENTENCE_SPLIT_RE = /(?<=[.?!])\s+(?=[A-Z`"'(])/;
const MAX_WORDS = 28;
const CAUSAL_MARKER_RE = /\b(because|since|so that|so it|therefore)\b/gi;

/**
 * Finds the first wordy-connector entry matching one sentence, or null.
 *
 * Uses the shared `entryRegex` rather than a private matcher. This module used
 * to hard-code `escapeRegExp(entry.phrase)`, which meant a `pattern`-only entry
 * added to data/wordy-connectors.json threw on `undefined.replace`, and
 * lint-doc.js converts a thrown check into a tier-1 LD-00 finding. A data edit
 * could therefore fail the lint on every file in the corpus. It was the fourth
 * hand-copied copy of this loader in the tree and the only one that crashed.
 *
 * The try/catch mirrors lib/phrase-list.js: a hand-drafted bad pattern must
 * name itself rather than take the sweep down.
 *
 * Exported so its behavior is testable without building a DocModel, which is
 * what lets test/sentence-concision.test.js cover the pattern case at all.
 */
function matchWordyPhrase(sentence, entries) {
  for (const entry of entries) {
    let re;
    try {
      re = entryRegex(entry);
    } catch (err) {
      continue;
    }
    if (re.test(sentence)) return entry;
  }
  return null;
}

/** Strip inline code, links, and a leading list marker so word/phrase counts reflect only prose. */
function normalizeLine(rawLine) {
  return rawLine
    .replace(LIST_MARKER_RE, '')
    .replace(LINK_RE, (m) => m.replace(/\[([^\]]*)\]\([^)]*\)/, '$1'))
    .replace(INLINE_CODE_RE, ' CODE ');
}

function splitSentences(text) {
  return text
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordCount(sentence) {
  return sentence.split(/\s+/).filter(Boolean).length;
}

function countCausalMarkers(sentence) {
  const matches = sentence.match(CAUSAL_MARKER_RE);
  return matches ? matches.length : 0;
}

/**
 * Tier 2 heuristic: flags candidate sentences for an agentic (reading-comprehension)
 * rewrite pass, per C3-07. This check identifies, it does not rewrite, a wordy sentence
 * often reads fine grammatically, so only a human or LLM reviewer can judge the actual
 * fix. Skips headings, table rows, and code fences.
 */
function checkSentenceConcision(doc) {
  const findings = [];
  const wordyPhrases = loadEntryFile(WORDY_PHRASES_PATH);
  const lines = doc.proseLineNumbers(doc.bodyStartLine, doc.totalLines);

  for (const lineNo of lines) {
    const raw = doc.lines[lineNo - 1];
    if (!raw || !raw.trim()) continue;
    if (/^\s*#{1,6}\s/.test(raw)) continue; // headings
    if (/^\s*\|/.test(raw)) continue; // table rows
    if (/^\s*>/.test(raw)) continue; // callouts, reviewed by callout-frequency instead

    const normalized = normalizeLine(raw);
    for (const sentence of splitSentences(normalized)) {
      const words = wordCount(sentence);
      const causalCount = countCausalMarkers(sentence);
      const matchedPhrase = matchWordyPhrase(sentence, wordyPhrases);

      if (words > MAX_WORDS || causalCount >= 2 || matchedPhrase) {
        const reasons = [];
        if (words > MAX_WORDS) reasons.push(`${words} words`);
        if (causalCount >= 2) reasons.push(`${causalCount} stacked causal clauses`);
        // `label || phrase`, because a pattern entry has no `phrase` and would
        // otherwise report `wordy phrase "undefined"`. That is a silently wrong
        // report rather than a crash, so it is the real regression risk in the
        // matcher switch above. Same fallback as banned-phrases.js.
        if (matchedPhrase) {
          const found = matchedPhrase.label || matchedPhrase.phrase;
          reasons.push(`wordy phrase "${found}" (fix: ${matchedPhrase.fix})`);
        }

        findings.push(
          makeFinding({
            tier: 2,
            ruleId: 'C3-07',
            checkId: 'sentence-concision',
            line: lineNo,
            message: `Candidate wordy sentence (${reasons.join(', ')}): "${sentence.slice(0, 100)}${sentence.length > 100 ? '...' : ''}"`,
            falsePositiveNote:
              'Length or a single causal clause alone can be legitimate. Read the sentence and rewrite only if it actually stacks justifications or hedges per C3-07.',
          })
        );
      }
    }
  }
  return findings;
}

module.exports = { checkSentenceConcision, matchWordyPhrase, WORDY_PHRASES_PATH, MAX_WORDS };
