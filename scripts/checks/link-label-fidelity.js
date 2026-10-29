'use strict';

const fs = require('fs');
const path = require('path');

const { linksIn, classify, splitFragment } = require('../lib/markdown-links');
const { slugifyVariants } = require('../lib/slugify');

/**
 * Candidate generation for C2-14: a link label that does not describe where the
 * link goes.
 *
 * PR #86's reading agents reported "misleading link labels" and the list is
 * gone with the session. check-links.js could not have produced it: it answers
 * whether a target RESOLVES, and a label that says "the section reference" over
 * a link to the composition-rendering page resolves perfectly. A reader
 * following it lands somewhere they were not promised, which costs them more
 * than a 404 does, because a 404 tells them something is wrong.
 *
 * The same defect has a second shape that PR #86 already met: the punctuation
 * pass moved a bracket across a label boundary in 20 links, and the label came
 * out as fragments. Those were caught by reading. This finds them by asking.
 *
 * Candidates, not findings, for the reason tier3-candidates.js states: a
 * candidate is a question and a lint failure has to be an answer. A script can
 * measure that a label shares no words with its destination's title. It cannot
 * tell "Studio CLI" pointing at "Register components with the command line"
 * (fine, the label names the tool) apart from "Slot props" pointing at
 * "Composition rendering reference" (wrong page). Only the second is a defect,
 * and both look identical to a token overlap.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'for', 'from', 'how', 'in', 'into',
  'is', 'it', 'its', 'of', 'on', 'or', 'the', 'this', 'to', 'up', 'via', 'what', 'when',
  'where', 'which', 'why', 'with', 'you', 'your', 'guide', 'reference', 'overview', 'docs',
  'doc', 'page', 'see', 'read', 'more', 'about', 'using', 'use',
]);

/**
 * Labels that describe the act of following the link rather than the
 * destination.
 *
 * These need no model to confirm: a screen reader user tabbing between links
 * hears "here, here, this page" with no way to tell them apart, whatever the
 * surrounding sentence says.
 *
 * The set is deliberately narrow, and the first draft is why it is. It also
 * held "reference", "docs", "details" and "documentation", which produced 15
 * findings on this corpus and every one was wrong. "A multi-type
 * [Reference](rendering-reference-fields.md) field" uses the product's own noun
 * mid-sentence, and "`<StudioComponent />` [reference](...)" gets its subject
 * from the two words before the bracket. Those are ordinary nouns that happen
 * to be short. A label is only opaque when it names no thing at all in any
 * sentence, which is true of "here" and false of "reference".
 */
const OPAQUE_LABELS = new Set([
  'here', 'this', 'this page', 'this doc', 'this guide', 'this link', 'this section',
  'click here', 'click this', 'read more', 'learn more', 'see here', 'see this',
  'read this', 'go here', 'link', 'this one', 'that', 'it',
]);

/** Words that carry meaning, lowercased, with code punctuation stripped. */
function tokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[`*_[\]()<>]/g, ' ')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/** The H1, and the front-matter title if the page carries one. */
function titlesOf(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const out = [];

  const h1 = lines.find((l) => /^#\s+\S/.test(l));
  if (h1) out.push(h1.replace(/^#\s+/, '').trim());

  if (lines[0] === '---') {
    for (let i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
      const m = lines[i].match(/^(title|seo_title|nav_title)\s*:\s*(.+)$/);
      if (m) out.push(m[2].replace(/\s*\|\s*Contentstack\s*$/, '').trim());
    }
  }
  return out;
}

/** The heading text a fragment points at, when the fragment resolves to one. */
function headingForFragment(file, fragment) {
  if (!fragment) return null;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^#{1,6}\s+(.*)$/);
    if (!m) continue;
    for (const variant of slugifyVariants(m[1])) {
      if (variant === fragment) return m[1].trim();
    }
  }
  return null;
}

/**
 * A label that is broken rather than merely inaccurate.
 *
 * "[, [" and "[`build-repeating-section`" are what a bracketing bug leaves
 * behind, and PR #86 restored 20 of them by hand. These need no judgment: a
 * label with unbalanced brackets or backticks, or one that is empty, is wrong
 * whatever the destination says.
 */
function structurallyBroken(label) {
  const trimmed = label.trim();
  if (!trimmed) return 'the label is empty';
  if ((trimmed.match(/`/g) || []).length % 2 === 1) return 'the label has an unclosed backtick';
  for (const [open, close] of [['[', ']'], ['(', ')']]) {
    const o = (trimmed.match(new RegExp(`\\${open}`, 'g')) || []).length;
    const c = (trimmed.match(new RegExp(`\\${close}`, 'g')) || []).length;
    if (o !== c) return `the label has ${o} "${open}" and ${c} "${close}"`;
  }
  if (/^[,;:.\s]+$/.test(trimmed)) return 'the label is punctuation only';
  return null;
}

/**
 * Candidates and direct findings for the links in one file.
 *
 * Returns two lists because the two halves have different standing. `findings`
 * are defects the script settles on its own: an opaque label, a broken one.
 * `candidates` are questions for the judge: a label that resolves but shares no
 * vocabulary with what it resolves to.
 */
function collectLinkLabelCandidates(file, { corpus = null } = {}) {
  const findings = [];
  const candidates = [];

  for (const link of linksIn(file)) {
    if (link.image || link.html) continue;
    // rawLabel, not label: check-links blanks code spans before extracting, so
    // a label written in backticks reads as a run of spaces there. Reading a
    // label needs the bytes the writer wrote.
    const label = String(link.rawLabel != null ? link.rawLabel : link.label || '');
    const kind = classify(link.target);

    const broken = structurallyBroken(label);
    if (broken) {
      findings.push({
        ruleId: 'C2-14',
        checkId: 'link-label-fidelity',
        tier: 1,
        file,
        line: link.line,
        message: `Link label is malformed: ${broken}. Label: ${JSON.stringify(label.slice(0, 80))}`,
      });
      continue;
    }

    if (OPAQUE_LABELS.has(label.trim().toLowerCase())) {
      findings.push({
        ruleId: 'C2-14',
        checkId: 'link-label-fidelity',
        tier: 1,
        file,
        line: link.line,
        message:
          `Link label "${label.trim()}" describes the act of following the link, not the destination. ` +
          'Name the page or section instead, so a reader tabbing between links can tell them apart.',
      });
      continue;
    }

    // Only an internal link can be compared against its destination. An
    // external URL's title needs the network, which belongs in the external
    // layer of check-links.js, not in a check that has to run on every commit.
    if (kind !== 'relative' && kind !== 'same-page') continue;

    const [rawPath, fragment] = splitFragment(link.target);
    const targetFile = rawPath === '' ? file : path.resolve(path.dirname(file), rawPath);
    if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) continue;
    if (corpus && !corpus.has(path.resolve(targetFile))) continue;

    const heading = headingForFragment(targetFile, fragment);
    const destinations = heading ? [heading, ...titlesOf(targetFile)] : titlesOf(targetFile);
    if (!destinations.length) continue;

    const labelTokens = tokens(label);
    if (labelTokens.size === 0) continue;

    const overlaps = destinations.some((d) => {
      const dest = tokens(d);
      for (const t of labelTokens) if (dest.has(t)) return true;
      return false;
    });
    if (overlaps) continue;

    // The filename is a third chance to overlap, and it earns its place: many
    // labels name the concept while the H1 names the task, and the slug carries
    // the concept. "Slot props" over slot-props.md is correct and shares no word
    // with an H1 reading "Data-carrying slots".
    const slugTokens = tokens(path.basename(targetFile, '.md').replace(/-/g, ' '));
    let slugOverlap = false;
    for (const t of labelTokens) if (slugTokens.has(t)) slugOverlap = true;
    if (slugOverlap) continue;

    candidates.push({
      candidateId: `C2-14:${path.basename(file)}:${link.line}`,
      ruleId: 'C2-14',
      checkId: 'link-label-fidelity',
      tier: 1,
      file,
      line: link.line,
      label: label.trim(),
      target: link.target,
      destination: destinations[0],
      allDestinations: destinations,
      signal:
        `The label shares no meaningful word with the destination's title, its front-matter title, ` +
        `or its filename.`,
      evidence: [
        `label: ${label.trim()}`,
        `target: ${link.target}`,
        ...destinations.map((d) => `destination title: ${d}`),
      ],
      decide:
        `Would a reader who clicked "${label.trim()}" expecting what the label promises be surprised ` +
        `to land on "${destinations[0]}"? Answer VIOLATION only if the label misdescribes the destination, ` +
        `not merely if it uses different words for the same thing.`,
    });
  }

  return { findings, candidates };
}

module.exports = {
  collectLinkLabelCandidates,
  structurallyBroken,
  titlesOf,
  headingForFragment,
  tokens,
  OPAQUE_LABELS,
  STOP_WORDS,
};
