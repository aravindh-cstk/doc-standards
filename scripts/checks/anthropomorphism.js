'use strict';

/**
 * Tier 2 (C3-18): verbs that attribute intent, knowledge, perception, or speech
 * to a system component, where the sentence leaves the mechanism unstated.
 *
 * This check exists because a reviewer caught "a disabled profile advertises
 * zero tools" by eye and asked why the linter did not. It could not: the phrase
 * was in no wordlist, and C3-08 (figurative metaphors) owns a different
 * exception set. `walks` substitutes a picture for an operation that exists,
 * while `advertises` invents an actor that does not, and the exemptions the two
 * need have nothing in common. Hence a separate rule rather than six more
 * entries in data/metaphors/.
 *
 * Two facts a future widening must not rediscover by shipping a false positive:
 *
 * 1. `exposes` and `discovers` are NEVER entries here. They are the MCP
 *    specification's own verbs for the operations this doc set describes, and
 *    `exposes` alone appears 18 times legitimately in the corpus. An entry for
 *    either makes this check useless on the only corpus it runs against.
 * 2. `entryRegex` compiles every entry case-insensitively and that is not a
 *    parameter. An entry that needs case sensitivity cannot be expressed as
 *    data and has to become a module constant, the way C3-12 handles "How".
 *
 * Uses lib/phrase-list.js rather than the hand-copied loader in
 * metaphor-phrases.js, passive-voice.js, and periphrasis-phrases.js. Those three
 * predate the lib and have already drifted from it (none filters for `.json`,
 * so a stray file in their data dir crashes the check into an LD-00 finding).
 */

const path = require('path');
const { makeFinding } = require('../lib/report');
const { loadPhraseList, scanDoc } = require('../lib/phrase-list');
const { byId } = require('../lib/rules-registry');

const DATA_DIR = path.join(__dirname, '..', 'data', 'anthropomorphism');

/**
 * A line carrying protocol vocabulary vetoes any hit on that line.
 *
 * Inside an OAuth or MCP paragraph, "the server refuses the request" and "the
 * client asks for a scope" are the specification's own phrasing, not tone. The
 * alternative, a lookaround per entry, would repeat this list in every pattern
 * and drift the moment one entry is edited.
 *
 * Named in check-sources.json under `patterns`, so probe-corpus.js triages the
 * next missed verb as REGEX_TOO_NARROW against this constant rather than
 * sending the next agent to the data directory.
 */
const PROTOCOL_CONTEXT_RE =
  /\b(OAuth|PKCE|handshake|token endpoint|scopes?|authoriz(e|es|ed|ation) (code|server|endpoint)|refresh token|Dynamic Client Registration)\b/i;

/**
 * Markup that can precede an imperative verb: heading markers, list markers
 * (ordered and unordered), blockquote markers, a callout label, and bold or
 * italic emphasis. Matched from the start of the line only.
 */
const MARKUP_PREFIX_RE = /^(?:[>\s]*)(?:#{1,6}\s+|\d+[.)]\s+|[-*+]\s+)?(?:\*\*[^*]+\*\*:?\s*)?(?:[*_]{1,2})?/;

/**
 * A bare verb at the start of a heading, a step, or a sentence is the reader
 * being told to do something, not a component being given a mind.
 *
 * "## Choose an MCP product" and "2. Choose **Add custom connector**" are
 * instructions. "The URL decides which profile" is the violation. English marks
 * the difference by position, not by the verb, so no wordlist entry can carry
 * this distinction and no lookbehind in a pattern can see past the markdown
 * markers. Hence a positional veto here, applied to every entry.
 */
function isImperativeOpener(stripped, index) {
  const prefix = (MARKUP_PREFIX_RE.exec(stripped) || [''])[0];
  if (index === prefix.length) return true;

  // Also an imperative when it opens a sentence inside the line, as in
  // "See the table. Choose the catalog your plan includes."
  const before = stripped.slice(prefix.length, index);
  return /(^|[.!?:]\s+)(?:\*\*|[*_])?$/.test(before);
}

/**
 * Nouns that name a person or a role, so a verb whose subject is one of them is
 * a person acting rather than a component being given a mind.
 *
 * The rule's own labels already claim this exclusion. "want (non-reader
 * subject)", "see (non-model subject)" and "decide (non-reader subject)" were
 * each written as a one-word lookbehind in the data file: `(?<!\byou )\bwants?\b`.
 * A fixed-width lookbehind of one word cannot do the job, and the corpus proves
 * it twice over.
 *
 * It sees no other subject. "we", "they", "users", "marketing", "engineering",
 * "sales", "authors", "teams" and "customers" were all missing, so "Marketing
 * sees the component as a drag-and-drop tile" was a finding.
 *
 * And it cannot see past anything sitting between the subject and the verb. All
 * four of these were findings, on a corpus where the rule was believed clean:
 *
 *   "you'll want to know"           a contraction
 *   "you may want to override"      a modal
 *   "you often want a slot here"    an adverb
 *   "if you also code, or want to"  a coordinated second verb
 *
 * Measured: 287 of 438 flagged lines in docs/ mention a person or a role. Not
 * every one of those is a false positive, because a line can address the reader
 * and still anthropomorphise a component in a later clause, which is why the
 * check below is scoped to the flagged verb's own clause rather than to the
 * whole line.
 */
const HUMAN_SUBJECT_RE =
  /\b(?:you|your|yours|we|our|us|they|their|them|i|me|my|users?|readers?|authors?|editors?|marketers?|marketing|engineers?|engineering|developers?|designers?|teams?|attendees?|sales|customers?|clients?|people|someone|somebody|anyone|anybody|everyone|reviewers?|maintainers?|admins?|administrators?|operators?|consultants?|stakeholders?|colleagues?|partners?|managers?|owners?)\b/i;

/**
 * Where the flagged verb's clause begins.
 *
 * Scanning the whole line for a human noun is too broad: "You configure the
 * SDK, and the SDK knows the region" addresses the reader and still gives the
 * SDK a mind. Scanning one word back is too narrow, which is the bug this
 * replaces. A clause is the unit that carries a subject, so the window runs
 * from the nearest clause boundary to the verb.
 *
 * The boundary set is the punctuation and the conjunctions that start a new
 * clause in this corpus. "that" and "which" are included because a relative
 * clause takes its own subject from the noun before it, and that noun is inside
 * the window either way.
 */
const CLAUSE_BOUNDARY_RE = /[.!?;:,()\[\]|]|\b(?:and|or|but|so|then|because|while|whereas|although|though|unless|until)\b/gi;

/**
 * Words that cannot be a subject, so a clause window containing only these has
 * no subject of its own and takes one from the clause before it.
 *
 * This is what coordination does in English. "If you also code, or want to
 * understand the mechanics" is one subject and two verbs, so cutting the window
 * at "or" leaves "want to" with nothing in it and the reader is still the one
 * wanting. Cutting at a comma or a full stop is different: those start a clause
 * that brings its own subject, which is why "You configure the SDK, and the SDK
 * knows the region" must still be a finding.
 */
const NON_SUBJECT_RE =
  /^(?:\s|\b(?:to|also|often|still|already|now|then|just|only|really|simply|always|never|sometimes|usually|likely|probably|may|might|can|could|will|would|shall|should|must|do|does|did|not|no|never|even|rather|instead|therefore|thus|and|or|but|then|so)\b|[*_`"'(),-])*$/i;

function clauseBefore(stripped, index) {
  const boundaries = [];
  CLAUSE_BOUNDARY_RE.lastIndex = 0;
  for (const m of stripped.slice(0, index).matchAll(CLAUSE_BOUNDARY_RE)) {
    boundaries.push({ end: m.index + m[0].length, text: m[0] });
  }

  // Walk boundaries from the nearest backwards, extending past any that leaves
  // a window with no possible subject in it.
  for (let i = boundaries.length - 1; i >= 0; i--) {
    const window = stripped.slice(boundaries[i].end, index);
    if (!NON_SUBJECT_RE.test(window)) return window;
    // The conjunction that opened this window is itself skippable, so the next
    // iteration sees the clause before it rather than the conjunction plus an
    // empty tail. Without this, ", or want to" stops at the comma with "or" in
    // the window and the shared subject two words earlier is never reached.
  }
  return stripped.slice(0, index);
}

/**
 * True when the flagged verb's own clause names a person.
 *
 * Applied to every entry, the way PROTOCOL_CONTEXT_RE already is, rather than
 * as a lookbehind per pattern. A veto that has to be repeated in ten patterns
 * drifts the moment one of them is edited, which is exactly what happened: two
 * entries carry a `(?<!\bmodel )` guard and the other eight do not.
 */
function hasHumanSubject(stripped, index) {
  return HUMAN_SUBJECT_RE.test(clauseBefore(stripped, index));
}

/**
 * Named separately from the message so the note stays one sentence in the
 * report while the registry keeps the full allowlist. The report prints this
 * under "Possible false positive" on every tier-2 finding, which lib/report.js
 * requires and which tier 2 exists for.
 */
const DOMAIN_VERB_NOTE =
  'Protocol and network vocabulary is exempt (a server exposes tools, a client discovers them, an OAuth handshake, a token that lacks a scope, a request that cannot reach an endpoint, a chain that falls back, an ID that collides, an organization that owns a stack, an LLM that reads a schema). Confirm the verb is not the standard term for the operation before fixing it.';

/**
 * Read from the registry rather than hardcoded, so the tier lives in one place.
 *
 * It shipped at tier 2 and was promoted to tier 1 once the corpus swept clean,
 * which is doc-gap.md's closing rule: a new tier-1 rule firing 40 times on a
 * corpus believed clean means the tier is wrong, not the corpus. Demoting is a
 * one-field edit to the registry row and needs no change here.
 */
const RULE_TIER = byId('C3-18').tier;

/**
 * Message shape is deliberate. fix/fix-banned-phrases.js:137 parses findings
 * with /phrase "(.+?)" found\. Fix: (.+)$/, so keeping that shape means a later
 * fix/fix-anthropomorphism.js reuses the regex unchanged. Do not reword it
 * without checking that caller.
 */
function checkAnthropomorphism(doc) {
  const findings = [];
  const phraseList = loadPhraseList(DATA_DIR);

  scanDoc(doc, phraseList, {
    onMatch: ({ entry, line, matched, raw, stripped, index, error }) => {
      if (error) {
        findings.push(
          makeFinding({
            tier: RULE_TIER,
            ruleId: entry.ruleId || 'C3-18',
            checkId: 'anthropomorphism',
            line,
            message: error,
            falsePositiveNote: DOMAIN_VERB_NOTE,
          })
        );
        return;
      }

      if (PROTOCOL_CONTEXT_RE.test(raw)) return;
      if (isImperativeOpener(stripped, index)) return;
      if (hasHumanSubject(stripped, index)) return;

      const found = entry.phrase || entry.label || matched;
      findings.push(
        makeFinding({
          tier: RULE_TIER,
          ruleId: entry.ruleId,
          checkId: 'anthropomorphism',
          line,
          message: `Anthropomorphic ${entry.category} phrase "${found}" found. Fix: ${entry.fix}`,
          falsePositiveNote: DOMAIN_VERB_NOTE,
        })
      );
    },
  });

  return findings;
}

module.exports = {
  checkAnthropomorphism,
  isImperativeOpener,
  hasHumanSubject,
  clauseBefore,
  PROTOCOL_CONTEXT_RE,
  MARKUP_PREFIX_RE,
  HUMAN_SUBJECT_RE,
  CLAUSE_BOUNDARY_RE,
  NON_SUBJECT_RE,
  DOMAIN_VERB_NOTE,
};
