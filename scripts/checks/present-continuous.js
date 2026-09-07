'use strict';

const { makeFinding } = require('../lib/report');

const INLINE_CODE_RE = /`[^`]*`/g;

/**
 * Words ending in "-ing" that follow a be-verb as predicate adjectives rather
 * than as verbs. "The tool list is missing" describes a state, and rewriting it
 * to simple present produces nonsense ("the tool list misses").
 *
 * Only words that genuinely appear in the predicate slot belong here. A word
 * like "matching" or "underlying" is an adjective before a noun ("the matching
 * section"), where no be-verb precedes it and the pattern never fires, so
 * listing it would buy nothing and would hide the verb reading ("the filter is
 * matching every tool").
 */
const PARTICIPIAL_ADJECTIVES = new Set([
  'missing',
  'willing',
  'interesting',
  'confusing',
  'misleading',
  'surprising',
  'outstanding',
  'pending',
  'remaining',
  'existing',
  'matching',
  'conflicting',
  'promising',
  'demanding',
  'challenging',
  'encouraging',
  'appealing',
  'binding',
]);

/**
 * A be-verb, an optional negation and up to one adverb, then an "-ing" word.
 *
 * "being" is excluded in the alternation rather than in the stoplist: "is being
 * created" is a passive progressive, which C3-10 already owns. A check that
 * emits a rule another check owns is exactly what validateRegistry rejects.
 */
const CONTINUOUS_RE =
  /\b(is|are|was|were|am|be|been)\s+(?:not\s+|never\s+)?(?:only\s+|still\s+|already\s+|currently\s+|now\s+|also\s+|always\s+)?([a-z]+ing)\b/gi;

/** Tier 2: present continuous where simple present states the same fact. */
function checkPresentContinuous(doc) {
  const findings = [];

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const stripped = doc.lines[lineNo - 1].replace(INLINE_CODE_RE, ' ');

    CONTINUOUS_RE.lastIndex = 0;
    let match;
    while ((match = CONTINUOUS_RE.exec(stripped)) !== null) {
      const participle = match[2].toLowerCase();
      if (participle === 'being') continue;
      if (PARTICIPIAL_ADJECTIVES.has(participle)) continue;

      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C3-19',
          checkId: 'present-continuous',
          line: lineNo,
          message: `Present continuous: "${match[0]}". Write it in simple present, naming the actor: "the client is holding a token" becomes "the client holds a token".`,
          falsePositiveNote:
            'The "-ing" word may be a predicate adjective describing a state rather than a verb describing an action (for example "is missing" versus "is holding"). Rewrite only when a simple present verb says the same thing.',
        })
      );
    }
  }
  return findings;
}

module.exports = { checkPresentContinuous, CONTINUOUS_RE, PARTICIPIAL_ADJECTIVES };
