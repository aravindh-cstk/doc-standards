'use strict';

const { makeFinding } = require('../lib/report');

const MAX_WORDS = 4;
const INLINE_CODE_RE = /`[^`]+`/g;

// A heading may open in lowercase when the first word is itself an identifier.
// Anything else opening lowercase is the tail of a sentence whose subject was cut.
const LOWERCASE_IDENTIFIER_RE = /^(?:[a-z0-9]+[-_][a-z0-9-_]+|[a-z]+\.[a-z]+|npx|npm|node|stdio)\b/;

// Signals that a heading reproduces text the product emits, rather than the
// author's own description of a symptom.
const PLACEHOLDER_RE = /`<[A-Z_]+>`|<[A-Z_]+>/;
const QUOTED_IDENTIFIER_RE = /"[a-z_]+"|`[a-z_]+`/;

/** The next non-blank line after a heading, skipping fenced regions. */
function nextProseLine(doc, headingLine) {
  for (let n = headingLine + 1; n <= doc.totalLines; n++) {
    if (doc.inFenceMask[n]) continue;
    const raw = doc.lines[n - 1];
    if (raw.trim() === '') continue;
    return raw;
  }
  return '';
}

/**
 * A troubleshooting entry, detected structurally rather than by section name.
 *
 * monitor-and-troubleshoot.md names its error sections "Configuration errors"
 * and "Connection and sign-in problems", so every check that looks for a
 * heading called "Troubleshooting" misses the file that holds most of these
 * headings. The Root Cause label is the signal that survives that.
 */
function isTroubleshootingEntry(doc, headingLine) {
  return /^\s*\*\*Root Cause\*\*/.test(nextProseLine(doc, headingLine));
}

function readsAsProductOutput(text) {
  return text.trim().endsWith('.') || PLACEHOLDER_RE.test(text) || QUOTED_IDENTIFIER_RE.test(text);
}

function wordCount(text) {
  return text
    .replace(INLINE_CODE_RE, 'X')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Tier 2: headings stay short enough to scan, and read as complete phrases. */
function checkHeadingLength(doc) {
  const findings = [];

  for (const heading of doc.headings) {
    if (doc.inFenceMask[heading.line]) continue;
    // The H1 is the page title, a product name rather than a scannable label.
    if (heading.level === 1) continue;

    const text = heading.text.trim();

    if (/^[a-z]/.test(text) && !LOWERCASE_IDENTIFIER_RE.test(text)) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C2-08',
          checkId: 'heading-length',
          line: heading.line,
          message: `Heading opens mid-sentence: "${text}". Name the subject the heading is about, or reproduce the product's message in full.`,
        })
      );
      continue;
    }

    const words = wordCount(text);
    if (words <= MAX_WORDS) continue;

    if (isTroubleshootingEntry(doc, heading.line) && readsAsProductOutput(text)) continue;

    findings.push(
      makeFinding({
        tier: 2,
        ruleId: 'C2-07',
        checkId: 'heading-length',
        line: heading.line,
        message: `Heading runs to ${words} words, over the ${MAX_WORDS}-word maximum: "${text}". Shorten it to a label. Only a heading reproducing product output verbatim is exempt.`,
      })
    );
  }

  return findings;
}

module.exports = { checkHeadingLength };
