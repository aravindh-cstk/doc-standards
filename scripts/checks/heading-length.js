'use strict';

const { makeFinding } = require('../lib/report');
const { byId } = require('../lib/rules-registry');

const MAX_WORDS = 4;

// A capitalized conjunction or relative pronoun that needs a clause the heading
// does not have, such as "Because the URL changes" or "Which profile wins".
const DEPENDENT_OPENER_RE = /^(?:And|But|Or|Nor|So|Because|Which|Whereas|Unless|Although|Though)\b/;
const INLINE_CODE_RE = /`[^`]+`/g;

// A heading may open in lowercase when the first word is itself an identifier.
// Anything else opening lowercase is the tail of a sentence whose subject was cut.
const LOWERCASE_IDENTIFIER_RE = /^(?:[a-z0-9]+[-_][a-z0-9-_]+|[a-z]+\.[a-z]+|npx|npm|node|stdio)\b/;

// An API reference names its members in their own case: a camelCase identifier
// ("currentUser", "onChange not firing"), a call ("getEntry()"), or a heading
// that is one lowercase word ("stack", "location"). None of these is a sentence
// with its subject cut off.
const API_IDENTIFIER_RE = /^(?:[a-z]+[A-Z][A-Za-z0-9]*|[a-z][\w.]*\(|[a-z][\w-]*$)/;

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

    const lowercaseFragment = /^[a-z]/.test(text) && !LOWERCASE_IDENTIFIER_RE.test(text) && !API_IDENTIFIER_RE.test(text);
    // A one-word heading such as "And" or "Or" is an API member (Query.And), not a clause.
    const conjunctionOpener = DEPENDENT_OPENER_RE.test(text) && /\s/.test(text);
    if (lowercaseFragment || conjunctionOpener) {
      findings.push(
        makeFinding({
          tier: byId('C2-08').tier,
          ruleId: 'C2-08',
          checkId: 'heading-length',
          line: heading.line,
          message: `Heading opens mid-sentence: "${text}". Fix: write the heading as a complete symptom that names its subject, for example "An automation call fails with a secure HTTP trigger error" rather than "uses a secure HTTP trigger". Quote a partial product message in the body, under the heading, not as the heading.`,
          falsePositiveNote: 'A heading may open in lowercase when its first word is an identifier the reader types or sees, such as a package name or an error code like authorization_required.',
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
