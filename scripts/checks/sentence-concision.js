'use strict';

const fs = require('fs');
const path = require('path');
const { makeFinding } = require('../lib/report');

const WORDY_PHRASES_PATH = path.join(__dirname, '..', 'data', 'wordy-connectors.json');
const INLINE_CODE_RE = /`[^`]*`/g;
const LINK_RE = /\[[^\]]*\]\([^)]*\)/g;
const LIST_MARKER_RE = /^\s*(?:[-*+]|\d+\.)\s+/;
const SENTENCE_SPLIT_RE = /(?<=[.?!])\s+(?=[A-Z`"'(])/;
const MAX_WORDS = 28;
const CAUSAL_MARKER_RE = /\b(because|since|so that|so it|therefore)\b/gi;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadWordyPhrases() {
  const data = JSON.parse(fs.readFileSync(WORDY_PHRASES_PATH, 'utf8'));
  return data.phrases.map((p) => ({ ...p, ruleId: data.ruleId }));
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
  const wordyPhrases = loadWordyPhrases();
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
      const matchedPhrase = wordyPhrases.find((entry) =>
        new RegExp(`\\b${escapeRegExp(entry.phrase)}\\b`, 'i').test(sentence)
      );

      if (words > MAX_WORDS || causalCount >= 2 || matchedPhrase) {
        const reasons = [];
        if (words > MAX_WORDS) reasons.push(`${words} words`);
        if (causalCount >= 2) reasons.push(`${causalCount} stacked causal clauses`);
        if (matchedPhrase) reasons.push(`wordy phrase "${matchedPhrase.phrase}" (fix: ${matchedPhrase.fix})`);

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

module.exports = { checkSentenceConcision };
