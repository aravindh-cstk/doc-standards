'use strict';

const { makeFinding } = require('../lib/report');
const { maskProse, maskForEmphasis } = require('../lib/prose-mask');

/**
 * Tier 1: no italics in prose (C3-28).
 *
 * Italics carry no meaning of their own. Where this corpus uses them, the
 * emphasis is either already carried by the sentence ("it is a *stateful
 * compound*", where "stateful compound" is the term being defined) or it is
 * doing a job another convention owns: bold for a visible UI element name
 * (C4-07), inline code for an identifier, quotation marks for reported speech.
 * A reader cannot act on slanted text, and it survives neither the CMS rich
 * text round trip nor translation reliably.
 *
 * Two usage patterns exist here and they want different fixes, so the finding
 * names which one it found:
 *
 *   - Single-token contrastive emphasis, "*and*", "*without*", "*real*". The
 *     markers come off and nothing replaces them.
 *   - Quoted speech or a sample prompt wrapped whole, *"Register a new
 *     component X"*. The markers come off and the quotation marks stay, which
 *     is what was carrying the meaning.
 */

/**
 * Asterisk emphasis, excluding bold and bold italic.
 *
 * The lookarounds do the exclusion. `(?<![*\w])` refuses an opener that follows
 * another asterisk or a word character, which rules out the second asterisk of
 * a `**` run and rules out intra-word `foo*bar*`. `(?!\*)` on the opener and
 * `(?!\*)` on the closer refuse a marker that is part of a longer run, so
 * `**bold**` and `***both***` never match.
 *
 * `(?!\s)` after the opener and `(?<!\s)` before the closer are what keep a
 * list marker and an arithmetic asterisk out: "* item" and "2 * 3" both have
 * whitespace where emphasis content would be.
 */
const AST_RE = /(?<![*\w])\*(?!\s)(?!\*)([^*\n]+?)(?<!\s)\*(?!\*)/g;

/**
 * Underscore emphasis.
 *
 * The character-class lookarounds are the whole rule: an underscore inside an
 * identifier always has a word character on at least one side, so `snake_case`,
 * `article_section.heading` and `__init__` are all refused. This corpus has
 * exactly two underscore italics against several hundred identifiers, so a
 * looser pattern here would be almost entirely false positives.
 */
const UND_RE = /(?<![A-Za-z0-9_\\])_(?!\s)(?!_)([^_\n]+?)(?<!\s)_(?![A-Za-z0-9_])/g;

/**
 * The HTML equivalents.
 *
 * There are none in the Markdown source today, but the CMS holds 591 `<em>`
 * elements produced from this Markdown, so the tag is what the rule is
 * ultimately about. Scanned against the raw line rather than the mask, since
 * the mask blanks HTML tags by design.
 */
const HTML_ITALIC_RE = /<\/?(?:em|i)(?:\s[^>]*)?>/gi;

/**
 * Emphasis that a line-by-line scan cannot see.
 *
 * Two shapes in this corpus escaped `AST_RE`, and the CMS payload gate found
 * both by reporting `<em>` tags on pages the source check called clean:
 *
 *   *An empty placeholder the **template** fills.*
 *       The span contains `**`, and `[^*\n]+?` cannot cross an asterisk.
 *
 *   *When a template places a section, repoint the scope with `x` on the
 *   `section-composition` node.*
 *       The span crosses a newline, and the markdown renderer joins the
 *       paragraph before it looks for emphasis.
 *
 * So this runs over a whole paragraph, allowing `**` inside the span and a
 * single newline but not a blank line, which is where a paragraph ends. Bold,
 * bold italic, list markers and arithmetic asterisks are all still refused by
 * the same lookarounds.
 */
const PARAGRAPH_AST_RE = /(?<![*\w])\*(?!\s)(?!\*)((?:[^*\n]|\*\*|\n(?!\n))+?)(?<!\s)\*(?!\*)/g;

/** A wrapped quotation keeps its quotes, so the fix differs. */
const QUOTED_RE = /^["'“”].*["'“”]$/;

function describe(text) {
  const inner = text.slice(1, -1);
  if (QUOTED_RE.test(inner)) {
    return `${text} (a wrapped quotation: drop the markers, keep the quotation marks)`;
  }
  if (!/\s/.test(inner)) {
    return `${text} (single-word emphasis: drop the markers)`;
  }
  return `${text} (drop the markers, or use inline code if it names an identifier)`;
}

/**
 * Paragraph spans, as [startLine, text] pairs, with code spans blanked and
 * fenced lines dropped. Offsets are not needed: a multi-line span is reported
 * at the line it opens on.
 */
function paragraphs(doc) {
  const out = [];
  let start = null;
  let buf = [];
  const flush = () => {
    if (start !== null && buf.join('').trim()) out.push([start, buf.join('\n')]);
    start = null;
    buf = [];
  };
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) {
      flush();
      continue;
    }
    const raw = doc.lines[lineNo - 1];
    if (raw.trim() === '') {
      flush();
      continue;
    }
    if (start === null) start = lineNo;
    buf.push(maskForEmphasis(raw));
  }
  flush();
  return out;
}

function checkNoItalics(doc) {
  const findings = [];
  const reportedLines = new Set();
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = doc.lines[lineNo - 1];

    // Markers are matched against the mask so an asterisk or underscore inside
    // inline code, an HTML attribute or a link target is not emphasis. The mask
    // leaves `*` and `_` alone, which is why it is safe here where
    // judge-tone's normalizeSentence and phrase-list's stripNonProse are not:
    // both of those strip the very characters this rule is about.
    const masked = maskForEmphasis(raw);

    const found = [];
    // Matched on the mask, but quoted from the raw line at the same offsets.
    // The mask blanks inline code to spaces, so quoting it turned
    //   *"Was `<XyzComponent>` removed on purpose?"*
    // into a run of whitespace the reader could not find in the file.
    for (const re of [AST_RE, UND_RE]) {
      for (const m of masked.matchAll(re)) {
        found.push(describe(raw.slice(m.index, m.index + m[0].length)));
      }
    }
    for (const m of raw.matchAll(HTML_ITALIC_RE)) {
      found.push(`${m[0]} (an HTML italic tag: remove it)`);
    }
    if (found.length === 0) continue;

    reportedLines.add(lineNo);
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'C3-28',
        checkId: 'no-italics',
        line: lineNo,
        message: `Italics in prose: ${found.join('; ')}`,
      })
    );
  }

  // Then the spans only a paragraph-wide scan can see.
  for (const [startLine, text] of paragraphs(doc)) {
    PARAGRAPH_AST_RE.lastIndex = 0;
    for (const m of text.matchAll(PARAGRAPH_AST_RE)) {
      const span = m[0];
      // Skip what the line scan already reported: a span with no newline and no
      // bold inside it is exactly what AST_RE matches.
      if (!span.includes('\n') && !span.includes('**')) continue;
      if (reportedLines.has(startLine)) continue;
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'C3-28',
          checkId: 'no-italics',
          line: startLine,
          message:
            `Italics spanning more than one line or wrapping bold: ` +
            `${span.replace(/\n/g, ' ').slice(0, 110)}. Drop the markers.`,
        })
      );
      reportedLines.add(startLine);
    }
  }

  return findings;
}

module.exports = { checkNoItalics, AST_RE, UND_RE, HTML_ITALIC_RE, PARAGRAPH_AST_RE };
