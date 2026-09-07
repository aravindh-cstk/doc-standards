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
  PROTOCOL_CONTEXT_RE,
  MARKUP_PREFIX_RE,
  DOMAIN_VERB_NOTE,
};
