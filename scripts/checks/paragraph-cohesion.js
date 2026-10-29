'use strict';

/**
 * C2-09, tier 2: consecutive body paragraphs under one heading that read as
 * disconnected fragments rather than one argument or labelled standalone facts.
 *
 * The unit here is new. Every other check works at the section scale (C1, C6),
 * the sentence scale (C3), or the block scale (C7-04, table adjacency). Nothing
 * looked at the relationship *between* two paragraphs, which is how a section
 * whose every paragraph opens flat passed a full pipeline run untouched.
 *
 * This check is deliberately not C3-24. That rule is about pointer DIRECTION,
 * and its exception names "This grants no extra access" as correct, because it
 * is: a backward demonstrative resolving the paragraph above is good English.
 * One of them is fine. A run of them, with nothing pointing forward and no
 * bolded lead-in to say the paragraphs are separate facts, is the defect.
 *
 * So the finding is never a single opener. The gates are structural and
 * counted:
 *
 *   three or more body paragraphs under the heading, AND
 *   not one of them carries a bolded lead-in label, AND
 *   either two or more of them open with a bare demonstrative, or a
 *   one-sentence paragraph sits between two multi-sentence ones.
 *
 * That is the whole precision budget. Loosening any gate flags correct prose,
 * which is the failure mode checks/vague-reference.js was written to avoid.
 *
 * The check nominates a section. It does not decide it. Which of the two
 * repairs applies, bolded lead-ins or connectives, is reading comprehension,
 * and that judgment lives in the C2-09 arm of judge-tone.js.
 */

const { makeFinding } = require('../lib/report');
const { ownBodyRanges } = require('../lib/parse-markdown');
const { stripNonProse } = require('../lib/phrase-list');
const { IMPERATIVE_VERBS } = require('./ordered-list-sequence');

const HEADING_RE = /^\s*#{1,6}\s/;
const TABLE_ROW_RE = /^\s*\|/;
const LIST_ITEM_RE = /^\s*(?:[-*+]\s|\d+[.)]\s)/;
const BLOCKQUOTE_RE = /^\s*>/;
const IMAGE_RE = /^\s*!\[/;
const HTML_RE = /^\s*</;
const THEMATIC_BREAK_RE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;
const FRONT_MATTER_KEY_RE = /^\s*[a-z_]+:\s/;

/** A paragraph that already announces itself as a standalone fact. The shape checks/table-restatement.js uses. */
const BOLD_LEADIN_RE = /^\s*\*\*[^*]+\*\*/;

/**
 * A paragraph opening with a demonstrative and no noun naming what it points
 * at, so the referent is the whole paragraph above: "This grants...",
 * "That covers...", "These behave...".
 *
 * The lowercase-next-word gate keeps this off the constructions C3-24 already
 * owns, where the demonstrative names an element ("This URL sets a branch:").
 * Those are that rule's business, and reporting them here would give a writer
 * two findings for one sentence.
 */
const BARE_DEMONSTRATIVE_RE = /^(This|That|These|Those)\s+[a-z]/;

/** The element nouns C3-24's wordlist owns. A demonstrative naming one of these is not bare. */
const ELEMENT_NOUN_RE = /^(This|That|These|Those)\s+(url|example|snippet|command|code|shape|format|structure|text|payload|output|message|error|diagram|image|screenshot|table|list|order|sequence|set|series|section|page|step|steps|values|parameters|options|fields|rows|tabs)\b/i;

/**
 * A paragraph opening that signals its relation to the paragraph above:
 * a subordinating conjunction, a restrictive adverb, or a determiner that
 * picks one member out of a set the reader already has.
 *
 * Then, Next, and Finally join them as sequence markers, which carry a relation
 * of their own and which C3-15 does not ban.
 *
 * Only these count as the writer having done the work. A conversational
 * discourse marker ("That said", "Either way") is banned outright by C3-15 and
 * is deliberately absent, so reaching for one earns no credit here.
 */
const CONNECTIVE_OPENER_RE = /^(Because|Since|When|Once|Only|Unless|If|After|Before|While|Whereas|Although|Though|Despite|Unlike|Beyond|Apart|Aside|Instead|Rather|Then|Next|Finally|To |For |With|Without|Given|Either|Both|Neither|Together|That is|Each|Every|The (first|second|third|last|other|same|rest|remaining))\b/;

/**
 * A paragraph that opens with a base-form verb aimed at the reader: "Open the
 * Executions view", "Register the stack URL", "Replace the profile ID".
 *
 * The rule's exception exempts a procedure whose paragraphs are numbered steps.
 * A run of imperative paragraphs is the same procedure without the numbers, and
 * the reader follows it in order for the same reason, so it needs no connective
 * between one step and the next.
 */
function isImperativeOpener(opener) {
  const first = String(opener)
    .replace(/^\*\*|^[-*+]\s+/, '')
    .trim()
    .split(/[^A-Za-z-]+/)[0];
  if (!first) return false;
  const word = first.toLowerCase();
  if (IMPERATIVE_VERBS.has(word)) return true;
  const stem = word.replace(/^re-/, '');
  return stem !== word && IMPERATIVE_VERBS.has(stem);
}

/** Stricter than a bare period split: an abbreviation or a version number must not end a sentence. */
const SENTENCE_SPLIT_RE = /(?<=[.?!])\s+(?=[A-Z`"'(])/;

const INLINE_CODE_RE = /`[^`]*`/g;

/** A line that carries prose rather than structure. */
function isProseLine(text) {
  const t = String(text || '');
  if (t.trim() === '') return false;
  if (HEADING_RE.test(t)) return false;
  if (TABLE_ROW_RE.test(t)) return false;
  if (LIST_ITEM_RE.test(t)) return false;
  if (BLOCKQUOTE_RE.test(t)) return false;
  if (IMAGE_RE.test(t)) return false;
  if (HTML_RE.test(t)) return false;
  if (THEMATIC_BREAK_RE.test(t)) return false;
  if (FRONT_MATTER_KEY_RE.test(t)) return false;
  return true;
}

/**
 * Sentences in a paragraph.
 *
 * Inline code becomes the placeholder `CODE`, the way checks/sentence-concision.js
 * already does it, rather than the blank that lib/phrase-list.js's stripNonProse
 * leaves. A sentence opening with an identifier is common in this corpus, and
 * blanking it hides the capital the split looks for, so "the name. `CMS` imports
 * as..." counts as one sentence and the paragraph reads as an orphan it is not.
 */
function sentenceCount(text) {
  return String(text)
    .replace(INLINE_CODE_RE, ' CODE ')
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/**
 * Body paragraphs of one section, excluding any direct child subsection.
 *
 * This corpus is hard-wrapped, so a paragraph is many lines and lib/phrase-list.js's
 * per-line scanDoc cannot serve this check. The accumulator is the one proven in
 * checks/tier3-candidates.js proseShouldBeTableOrList, widened to flush on any
 * structural line rather than on a blank line alone: a table or a fence between
 * two paragraphs ends the first one, and treating it as a continuation would
 * merge two paragraphs the reader sees as separate.
 *
 * `precededByBlock` records whether a fence, table, image, or list sits between
 * this paragraph and the one before it. A short paragraph after a code block is
 * usually that block's resolution line, which is a correct shape, so the orphan
 * marker below needs the neighbours to be adjacent in prose.
 *
 * Returns [{ startLine, endLine, text, sentences, boldLeadIn, bareDemonstrative, precededByBlock }].
 */
function sectionParagraphs(doc, section) {
  const paragraphs = [];
  let startLine = null;
  let lines = [];
  let blockSinceLastParagraph = false;

  const flush = () => {
    if (startLine && lines.length) {
      const rawText = lines.join(' ').replace(/\s+/g, ' ').trim();
      const text = stripNonProse(rawText).replace(/\s+/g, ' ').trim();
      const opener = lines[0].trim();
      paragraphs.push({
        startLine,
        endLine: startLine + lines.length - 1,
        text,
        rawText,
        // Counted on the raw text, because stripNonProse blanks the identifier
        // a sentence can legitimately open with.
        sentences: sentenceCount(rawText),
        boldLeadIn: BOLD_LEADIN_RE.test(opener),
        bareDemonstrative: BARE_DEMONSTRATIVE_RE.test(opener) && !ELEMENT_NOUN_RE.test(opener),
        connectiveOpener: CONNECTIVE_OPENER_RE.test(opener),
        imperativeOpener: isImperativeOpener(opener),
        precededByBlock: blockSinceLastParagraph,
      });
      blockSinceLastParagraph = false;
    }
    startLine = null;
    lines = [];
  };

  for (const [rangeStart, rangeEnd] of ownBodyRanges(section, doc.sections)) {
    for (let l = rangeStart; l <= Math.min(rangeEnd, doc.totalLines); l++) {
      const raw = doc.lines[l - 1];
      // A fenced block ends the paragraph before it, the same way a blank line does.
      if (doc.inFenceMask[l] || !isProseLine(raw)) {
        flush();
        if (doc.inFenceMask[l] || String(raw).trim() !== '') blockSinceLastParagraph = true;
        continue;
      }
      if (!startLine) startLine = l;
      lines.push(raw);
    }
    flush();
  }

  return paragraphs;
}

/**
 * The gate, exported so the tier-3 candidate generator nominates exactly the
 * sections this check flags, and so a test can drive it directly.
 *
 * Returns null when the section is clean, or { paragraphs, demonstratives,
 * orphans, signal } when it is worth a reader's judgment.
 */
function cohesionSignal(paragraphs) {
  if (paragraphs.length < 3) return null;
  if (paragraphs.some((p) => p.boldLeadIn)) return null;

  const demonstratives = paragraphs.filter((p) => p.bareDemonstrative);

  // A one-sentence paragraph between two multi-sentence ones. Stranded at the
  // top or the bottom of a section it usually is an intro or a closing note,
  // which is why the marker needs a paragraph on both sides. Both neighbours
  // must also be adjacent in prose: a one-liner after a code block is that
  // block's resolution line, and a one-liner before one is its lead-in.
  const orphans = [];
  for (let i = 1; i < paragraphs.length - 1; i++) {
    const p = paragraphs[i];
    if (p.sentences !== 1) continue;
    if (p.precededByBlock || paragraphs[i + 1].precededByBlock) continue;
    if (paragraphs[i - 1].sentences > 1 && paragraphs[i + 1].sentences > 1) orphans.push(p);
  }

  // The wall: four or more paragraphs where fewer than half of the ones that
  // follow the opening paragraph either signal their relation to what came
  // before or read as a step in a procedure. The first paragraph is exempt,
  // since it opens the section and has nothing above it to connect to.
  //
  // The ratio, rather than a raw count of paragraphs, is what keeps a correctly
  // written long section quiet. A writer who connects most of the run has done
  // the work, and flagging that section would train readers to ignore the rule.
  const tail = paragraphs.slice(1);
  const connectives = tail.filter((p) => p.connectiveOpener || p.imperativeOpener).length;
  const wall = paragraphs.length >= 4 && connectives / tail.length < 0.5;

  if (demonstratives.length < 2 && orphans.length === 0 && !wall) return null;

  const parts = [`${paragraphs.length} body paragraphs, none with a bolded lead-in`];
  if (wall) {
    parts.push(`only ${connectives} of ${tail.length} open with a connective or a procedure step`);
  }
  if (demonstratives.length >= 2) {
    parts.push(`${demonstratives.length} open with a bare demonstrative`);
  }
  if (orphans.length > 0) {
    parts.push(`${orphans.length} one-sentence paragraph(s) stranded between longer ones`);
  }

  return { paragraphs, demonstratives, orphans, wall, connectives, signal: parts.join(', ') };
}

function checkParagraphCohesion(doc) {
  const findings = [];

  for (const section of doc.sections) {
    if (section.level < 2) continue;

    const result = cohesionSignal(sectionParagraphs(doc, section));
    if (!result) continue;

    const lineList = result.paragraphs.map((p) => `L${p.startLine}`).join(', ');

    findings.push(
      makeFinding({
        tier: 2,
        ruleId: 'C2-09',
        checkId: 'paragraph-cohesion',
        line: result.paragraphs[0].startLine,
        section: section.text,
        message:
          `Paragraphs under "${section.text}" signal no relation to each other: ${result.signal} (${lineList}). ` +
          'Fix: if the paragraphs cover separate sub-topics, give each a bolded lead-in label. ' +
          'If they build one argument, open each with the connective that carries the logic, for example Because, When, Only, or Since.',
        falsePositiveNote:
          'The check counts openers, it does not read them. A section whose paragraphs genuinely continue each other in plain sequence, or a procedure whose paragraphs are numbered steps, needs neither labels nor connectives. One backward demonstrative resolving the paragraph above is correct and is governed by C3-24, not by this rule. Run judge:cohesion to decide which of the two repairs applies before rewriting.',
      })
    );
  }

  return findings;
}

module.exports = {
  checkParagraphCohesion,
  sectionParagraphs,
  cohesionSignal,
  isProseLine,
  sentenceCount,
  isImperativeOpener,
};
