'use strict';

const fs = require('fs');
const path = require('path');
const { makeFinding } = require('../lib/report');

const DATA_DIR = path.join(__dirname, '..', 'data', 'passive-voice');
const INLINE_CODE_RE = /`[^`]*`/g;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadPhraseList() {
  const entries = [];
  for (const file of fs.readdirSync(DATA_DIR)) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    for (const p of data.phrases) {
      entries.push({ phrase: p.phrase, pattern: p.pattern, label: p.label, fix: p.fix, category: data.category, ruleId: data.ruleId });
    }
  }
  return entries;
}

/**
 * Same literal-`phrase`-or-raw-`pattern` shape as checks/banned-phrases.js and
 * checks/metaphor-phrases.js. Every pattern here requires a genuine multi-word
 * construction (an auxiliary or modal plus a participle, or a get-passive) so a
 * lone term like "is" or "returned" can never trigger a finding on its own.
 */
function entryRegex(entry) {
  if (entry.pattern) return new RegExp(entry.pattern, 'i');
  return new RegExp(`\\b${escapeRegExp(entry.phrase)}\\b`, 'i');
}

/**
 * A match where every word is capitalized is a name, not a construction.
 *
 * The patterns are written lowercase and matched case-insensitively, so
 * "Get Started" satisfies the get-passive shape of get plus a regular
 * participle. It is the title of a guide, and this corpus links to one on
 * nearly every SDK page, so the check reported a rewrite that would have
 * renamed a real page.
 *
 * Only an all-capitalized match is exempt. A sentence-initial passive such as
 * "Is discarded by the runtime" capitalizes the auxiliary alone, so it still
 * reports.
 */
function isTitleCase(text) {
  const words = text.match(/[A-Za-z]+/g) || [];
  return words.length > 1 && words.every((w) => /^[A-Z]/.test(w));
}

/**
 * Tier 2: a genuine aux(+adverb/negation)+participle passive-voice construction
 * (regular -ed, curated irregular participles, modal+be, get-passive, or an
 * explicit by-agent variant of each). Tier 2, not tier 1, because whether a
 * given passive sentence is worth an active-voice rewrite is a judgment call,
 * the same reasoning that puts checks/metaphor-phrases.js (C3-08) and
 * checks/periphrasis-phrases.js (C3-09) at tier 2. The explicit by-agent
 * category is a stronger signal than a bare aux+participle match, so it gets a
 * lighter falsePositiveNote instead of a separate tier.
 */
function checkPassiveVoice(doc) {
  const findings = [];
  const phraseList = loadPhraseList();

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];
    const stripped = raw.replace(INLINE_CODE_RE, ' ');

    for (const entry of phraseList) {
      const re = entryRegex(entry);
      const match = re.exec(stripped);
      if (match && !isTitleCase(match[0])) {
        const isByAgent = entry.category.includes('by-agent');
        findings.push(
          makeFinding({
            tier: 2,
            ruleId: entry.ruleId,
            checkId: 'passive-voice',
            line: lineNo,
            message: `Passive voice: "${match[0]}" (${entry.label}). Fix: ${entry.fix}`,
            falsePositiveNote: isByAgent
              ? 'An explicit by-agent phrase is a strong passive-voice signal, but confirm the "agent" noun is a real actor and not an idiom (for example "by default" or "by design").'
              : 'This may be a predicate adjective describing a state, not a passive verb describing an action (for example "is unchanged" versus "is discarded"). Check whether an implied actor actually performed an action before rewriting.',
          })
        );
      }
    }
  }
  return findings;
}

module.exports = { checkPassiveVoice };
