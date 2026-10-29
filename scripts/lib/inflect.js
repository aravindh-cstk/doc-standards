'use strict';

/**
 * Generates the surface variants a literal wordlist entry fails to cover, and
 * collapses accepted variants back into one regex.
 *
 * Why this is a lib module rather than a function inside audit-wordlists.js:
 * two callers must generate the SAME candidate set. The LLM-backed auditor
 * proposes widenings from it, and test/wordlist-inflection.test.js fails the
 * build when a literal entry has an uncovered sibling. If the two generated
 * different sets, the test would green-light a file the auditor would flag,
 * which is the drift lib/phrase-list.js exists to prevent for matching.
 *
 * The failure this addresses, stated precisely: entryRegex compiles a literal
 * into `\b<escaped>\b`, a regex exactly as wide as the string. Every literal
 * entry is therefore a claim that its rule has one correct surface form. That
 * claim is false for most of them. `casual.json` listed `reach for` and not
 * `reach out`; `unlock-language.json` lists six bare verb stems and misses
 * eighteen inflections; `raise the value` misses `raise a support request`.
 *
 * The pattern-only files in this tree (anthropomorphism, house-verbs,
 * passive-voice, discourse-markers) are inflection-complete and have never
 * produced a miss. That is not luck: each was written after a sibling was
 * caught by eye, so each was authored as a verb family from the start. This
 * module retrofits that discipline onto the entries that predate it.
 */

const { escapeRegExp } = require('./phrase-list');

/**
 * Removing a hyphen never changes the words, so this is the one class that is
 * unarguable: `production-ready` and `production ready` are the same phrase
 * under the same rule, and no rule text can coherently cover one and not the
 * other.
 */
const CLASS_DEHYPHENATION = 'DEHYPHENATION';
/**
 * Adding a hyphen where the phrase has a space is a guess, not a derivation.
 * `out of the box` really does also appear as `out-of-the-box`, but `reach for`
 * does not appear as `reach-for`, and nothing mechanical separates the two. So
 * this is proposed and judged, never hard-failed on.
 */
const CLASS_HYPHENATION = 'HYPHENATION';
/** Mechanical to generate, but whether the rule covers the form needs judgment. */
const CLASS_VERB_INFLECTION = 'VERB_INFLECTION';
const CLASS_ADVERBIAL = 'ADVERBIAL';
const CLASS_NOMINAL = 'NOMINAL';
const CLASS_PLURAL = 'PLURAL';
/** Capped and quarantined. Over-generalizing an object is how you fire 40 times on a clean corpus. */
const CLASS_OBJECT_GENERALIZATION = 'OBJECT_GENERALIZATION';

const ALL_CLASSES = [
  CLASS_DEHYPHENATION,
  CLASS_HYPHENATION,
  CLASS_VERB_INFLECTION,
  CLASS_ADVERBIAL,
  CLASS_NOMINAL,
  CLASS_PLURAL,
  CLASS_OBJECT_GENERALIZATION,
];

/**
 * The only class the always-on guard test may hard-fail on.
 *
 * Narrowed from two classes to one after running the generator over the real
 * data. Verb inflection cannot be in it, because verbhood is itself a
 * judgment: `robust` is not a verb, so the generator emits `robusts`,
 * `robusted`, `robusting`, and a hard-failing test would demand a widening
 * for three nonwords. Hyphenation cannot be in it either, because
 * `out of the box` genuinely also appears hyphenated while `reach for` never
 * does, and nothing mechanical separates them.
 *
 * What is left is de-hyphenation, which is a derivation rather than a guess.
 * The test is the floor. The auditor plus the judge is the ceiling.
 */
const GUARD_CLASSES = [CLASS_DEHYPHENATION];

/** Words that mean the phrase does not open with a verb. */
const NON_VERBAL_OPENERS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'by', 'for', 'from', 'of', 'out', 'to', 'with', 'no', 'not',
  'it', 'you', 'your', 'this', 'that', 'these', 'those', 'all', 'any', 'every', 'right', 'pretty',
  'just', 'most', 'best', 'world', 'production', 'enterprise', 'battle', 'zero', 'single', 'end',
  'mental', 'golden', 'dead', 'genuinely', 'technically',
]);

const SIBILANT_END_RE = /(s|sh|ch|x|z)$/;
const CVC_END_RE = /[^aeiou][aeiou][bdgklmnprt]$/;
const VOWEL_RE = /[aeiou]/;

/** The -s/-es form of a verb stem. */
function thirdPerson(stem) {
  if (/[^aeiou]y$/.test(stem)) return `${stem.slice(0, -1)}ies`;
  if (SIBILANT_END_RE.test(stem)) return `${stem}es`;
  return `${stem}s`;
}

/** The -ed and -ing forms. Emits both the doubled and undoubled variants on a CVC stem. */
function pastAndProgressive(stem) {
  const out = [];
  if (stem.endsWith('e') && stem.length > 2) {
    out.push(`${stem}d`, `${stem.slice(0, -1)}ing`);
    return out;
  }
  if (/[^aeiou]y$/.test(stem)) {
    out.push(`${stem.slice(0, -1)}ied`, `${stem}ing`);
    return out;
  }
  out.push(`${stem}ed`, `${stem}ing`);
  // Consonant doubling is where a purely mechanical generator is wrong often
  // enough to matter, so emit both and let the judge drop the nonword. A
  // nonword sibling is harmless noise. A missing real sibling is the bug.
  if (CVC_END_RE.test(stem)) {
    const doubled = stem + stem.slice(-1);
    out.push(`${doubled}ed`, `${doubled}ing`);
  }
  return out;
}

/** The -ly form of an adjective. */
function adverbial(stem) {
  if (/[^aeiou]y$/.test(stem)) return `${stem.slice(0, -1)}ily`;
  if (stem.endsWith('le') && !stem.endsWith('ile')) return `${stem.slice(0, -1)}y`;
  if (stem.endsWith('ic')) return `${stem}ally`;
  return `${stem}ly`;
}

/** Plausible nominalizations. Genuinely judgment-bearing: "transformation" is a real technical noun. */
function nominal(stem) {
  const out = [];
  if (/(less|ful|ous|ive|ust|ent|ant)$/.test(stem)) out.push(`${stem}ness`);
  if (stem.endsWith('e')) out.push(`${stem.slice(0, -1)}ion`, `${stem.slice(0, -1)}ation`);
  else out.push(`${stem}ation`);
  return out;
}

function tokensOf(phrase) {
  return String(phrase).trim().split(/\s+/).filter(Boolean);
}

/** Hyphen removed: `production-ready` becomes `production ready` and `productionready`. */
function dehyphenated(phrase) {
  if (!phrase.includes('-')) return [];
  const out = new Set([phrase.replace(/-/g, ' ')]);
  if ((phrase.match(/-/g) || []).length === 1) out.add(phrase.replace('-', ''));
  out.delete(phrase);
  return [...out];
}

/** Hyphen added where the phrase has spaces. A guess, so judged rather than assumed. */
function hyphenated(phrase) {
  if (!/\s/.test(phrase) || phrase.includes('-')) return [];
  const out = new Set([phrase.replace(/\s+/g, '-')]);
  out.delete(phrase);
  return [...out];
}

/**
 * The variants a literal entry does not match.
 *
 * `opts.classes` restricts which classes to generate. Returns siblings only,
 * never the original phrase. Every form is lowercase, because entryRegex
 * compiles case-insensitively and a case-bearing sibling would be a lie about
 * what the widening covers.
 */
function siblingsOf(phrase, { classes = ALL_CLASSES } = {}) {
  const original = String(phrase || '').trim();
  if (!original) return [];

  const lower = original.toLowerCase();
  const tokens = tokensOf(lower);
  const head = tokens[0];
  const wanted = new Set(classes);
  const out = [];
  const seen = new Set([lower]);

  const add = (form, cls, stem, tokenIndex) => {
    const f = form.toLowerCase();
    if (seen.has(f) || !f || f === lower) return;
    seen.add(f);
    out.push({
      form: f,
      class: cls,
      safety: cls === CLASS_DEHYPHENATION ? 'MECHANICAL' : cls === CLASS_OBJECT_GENERALIZATION ? 'NOISY' : 'LIKELY',
      stem,
      tokenIndex,
    });
  };

  if (wanted.has(CLASS_DEHYPHENATION)) {
    for (const v of dehyphenated(lower)) add(v, CLASS_DEHYPHENATION, lower, 0);
  }
  if (wanted.has(CLASS_HYPHENATION)) {
    for (const v of hyphenated(lower)) add(v, CLASS_HYPHENATION, lower, 0);
  }

  // A head token that is a determiner, preposition, or modifier is not a verb,
  // so the inflection classes do not apply. "in practice" and "out of the box"
  // open with function words; "raise the value" and "unlock" open with a verb.
  //
  // Hyphens are checked segment by segment, because tokensOf splits on
  // whitespace only. Without this, "production-ready" is one token whose head
  // is not in the set, and the generator emits "production-readies".
  const headSegments = head ? head.split('-') : [];
  const headIsVerbal =
    Boolean(head) &&
    head.length > 2 &&
    VOWEL_RE.test(head) &&
    !headSegments.some((seg) => NON_VERBAL_OPENERS.has(seg)) &&
    // A single-token entry already ending in `s` is a plural or an existing
    // inflection, so inflecting it again produces "guardrailses".
    !(tokens.length === 1 && head.endsWith('s'));

  if (headIsVerbal && wanted.has(CLASS_VERB_INFLECTION)) {
    const rest = tokens.slice(1).join(' ');
    const suffix = rest ? ` ${rest}` : '';
    add(thirdPerson(head) + suffix, CLASS_VERB_INFLECTION, head, 0);
    for (const f of pastAndProgressive(head)) add(f + suffix, CLASS_VERB_INFLECTION, head, 0);
  }

  // Adverbial and nominal apply to a single-token adjectival entry only. A
  // multi-token phrase has no single stem to suffix.
  // A single-token entry that already ends in `s` is handled here rather than
  // through headIsVerbal, so a plural noun still gets its singular proposed.
  if (tokens.length === 1 && head && head.endsWith('s') && !head.endsWith('ss') && head.length > 3) {
    if (wanted.has(CLASS_PLURAL)) add(head.slice(0, -1), CLASS_PLURAL, head, 0);
  }

  if (tokens.length === 1 && headIsVerbal) {
    if (wanted.has(CLASS_ADVERBIAL)) add(adverbial(head), CLASS_ADVERBIAL, head, 0);
    if (wanted.has(CLASS_NOMINAL)) for (const f of nominal(head)) add(f, CLASS_NOMINAL, head, 0);
    if (wanted.has(CLASS_PLURAL)) add(thirdPerson(head), CLASS_PLURAL, head, 0);
  }

  // `<verb> the|a|an|your <noun>`: the rule may be about the verb rather than
  // the verb applied to this object. Exactly ONE candidate, the bare verb. A
  // wildcard object regex is how a widening fires 40 times on a clean corpus.
  if (wanted.has(CLASS_OBJECT_GENERALIZATION) && tokens.length >= 3 && headIsVerbal) {
    if (['the', 'a', 'an', 'your', 'its'].includes(tokens[1])) {
      add(head, CLASS_OBJECT_GENERALIZATION, tokens.slice(1).join(' '), 0);
    }
  }

  return out;
}

/**
 * Collapses a phrase plus the accepted siblings into ONE regex source, in the
 * house style already used by this tree (`\breach(es|ed|ing)? out\b`).
 *
 * Asserts the result matches the original phrase and every accepted form before
 * returning. A compiler that drops its own input is the exact bug the superset
 * gate exists to catch downstream, and catching it here costs nothing.
 */
function compileWidening(phrase, acceptedForms) {
  const original = String(phrase || '').trim().toLowerCase();
  const forms = [...new Set([original, ...acceptedForms.map((f) => String(f).toLowerCase())])];
  if (forms.length === 1) return null;

  const tokens = tokensOf(original);
  const head = tokens[0];
  const rest = tokens.slice(1).join(' ');
  let pattern;
  let style;

  // Suffix group, when every form is the same phrase with a different head
  // inflection. This is the readable form and the one the tree already uses.
  const sameTail = forms.every((f) => {
    const t = tokensOf(f);
    return t.slice(1).join(' ') === rest;
  });
  const headForms = forms.map((f) => tokensOf(f)[0]);
  const sharedPrefix = headForms.every((h) => h.startsWith(head.slice(0, Math.max(3, head.length - 1))));

  if (sameTail && sharedPrefix) {
    const stem = commonPrefix(headForms);
    const suffixes = [...new Set(headForms.map((h) => h.slice(stem.length)))].filter(Boolean);
    const optional = headForms.includes(stem);
    const group = suffixes.length > 0 ? `(${suffixes.map(escapeRegExp).join('|')})${optional ? '?' : ''}` : '';
    pattern = `\\b${escapeRegExp(stem)}${group}${rest ? ` ${escapeRegExp(rest)}` : ''}\\b`;
    style = 'SUFFIX_GROUP';
  } else {
    // A boundary class when the forms are the same letters modulo separators.
    // Compare with separators REMOVED rather than normalized to spaces, because
    // `zero-downtime`, `zero downtime` and `zerodowntime` are one pattern with
    // an optional separator, and that optional separator is exactly what covers
    // the closed compound. Normalizing to spaces leaves the closed form out and
    // falls through to a three-way alternation saying the same thing less well.
    const stripped = [...new Set(forms.map((f) => f.replace(/[-\s]/g, '')))];
    if (stripped.length === 1) {
      // Segment from whichever form actually carries separators.
      const segmented = forms.find((f) => /[-\s]/.test(f)) || forms[0];
      pattern = `\\b${segmented.split(/[-\s]/).map(escapeRegExp).join('[- ]?')}\\b`;
      style = 'BOUNDARY_CLASS';
    } else {
      pattern = `\\b(${forms.map(escapeRegExp).join('|')})\\b`;
      style = 'ALTERNATION';
    }
  }

  const re = new RegExp(pattern, 'i');
  const missed = forms.filter((f) => !re.test(f));
  if (missed.length > 0) {
    throw new Error(`compileWidening produced ${pattern}, which does not match: ${missed.join(', ')}`);
  }
  return { pattern, covers: forms.filter((f) => f !== original), style };
}

function commonPrefix(strings) {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (const s of strings.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}

/**
 * The siblings no entry sharing this rule already matches.
 *
 * The pre-filter that keeps cost down and stops the auditor proposing
 * `reaches out` in casual.json, which that file's `\breach(es|ed|ing)? out\b`
 * pattern already covers. Compiles in a try/catch, as every consumer of a
 * hand-drafted pattern in this tree does.
 */
function uncoveredSiblings(entry, siblings, siblingEntries) {
  const { entryRegex } = require('./phrase-list');
  const others = siblingEntries.filter((e) => e !== entry && e.ruleId === entry.ruleId);
  return siblings.filter((s) => {
    for (const other of others) {
      let re;
      try {
        re = entryRegex(other);
      } catch (err) {
        continue;
      }
      if (re.test(s.form)) return false;
    }
    return true;
  });
}

module.exports = {
  siblingsOf,
  compileWidening,
  uncoveredSiblings,
  commonPrefix,
  ALL_CLASSES,
  GUARD_CLASSES,
  CLASS_DEHYPHENATION,
  CLASS_HYPHENATION,
  CLASS_VERB_INFLECTION,
  CLASS_ADVERBIAL,
  CLASS_NOMINAL,
  CLASS_PLURAL,
  CLASS_OBJECT_GENERALIZATION,
};
