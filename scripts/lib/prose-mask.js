'use strict';

/**
 * One definition of "which characters on this line are prose".
 *
 * Checks and fixers both need this, and when they each carried their own copy
 * they disagreed. C3-05 reported 296 findings that its own fixer said were
 * zero: 151 semicolons inside `style="max-width: 680px; width: 100%"` on
 * diagram images, 143 inside indented code, and 2 inside other HTML tags. Every
 * one was legal syntax that the rule cannot ask anyone to remove, and a
 * reviewer chasing that list would have had to break markup to clear it.
 *
 * Masking replaces each protected span with spaces of the same length, so
 * offsets into the masked string still index the original. A rule can locate a
 * character in the mask and then splice the real line at that index.
 */

const BARE_URL_RE = /https?:\/\/[^\s`<>"']+/g;

/**
 * An HTML entity, whose trailing semicolon is required syntax.
 *
 * Named separately from the pattern list because it is needed twice: once as a
 * protected span, and again to re-protect entities inside an attribute value
 * that has just been uncovered as prose.
 */
const ENTITY_RE = /&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});/g;

/**
 * Order matters. Entities are consumed first so a later pattern cannot take
 * half of one, and inline code is consumed before HTML tags so that a tag
 * written inside backticks as an example stays a code span.
 */
const PROTECTED_PATTERNS = [
  // An entity's trailing semicolon is required syntax: "&lt;", "&quot;".
  ENTITY_RE,
  // Inline code.
  /`[^`]*`/g,
  // HTML tags, which carry style="...; ..." and multi-clause attributes.
  /<[^>]+>/g,
  // Link and image targets, where a semicolon can be part of the URL.
  /\]\([^)]*\)/g,
  // A continuation line of a multi-line HTML tag. Every diagram in this corpus
  // is written as an <img> split over several lines, so the src, alt, style,
  // width and height attributes land on their own lines and the single-line tag
  // pattern above never sees them. `style="max-width: 900px; width: 100%"` is
  // the common case, and its semicolons are CSS.
  //
  // One or more attributes per line: 8 lines pair them up as
  // `width="480" height="688"`, which a single-attribute pattern missed.
  /^\s*(?:[a-zA-Z-]+\s*=\s*"[^"]*"\s*)+\/?>?\s*$/g,
  // Bare URLs, meaning ones not already inside a code span or a link target.
  //
  // `\S+` was too greedy in both directions. A URL written inside backticks,
  // "(e.g. `https://yoursite.com`)", is already covered by the inline-code
  // pattern, but `\S+` ran past the closing backtick and took the paren that
  // closed the sentence with it. Because the patterns union their spans, that
  // paren then counted as protected, which is how five table cells read as
  // having an unbalanced paren when they were fine.
  //
  // A URL never contains a backtick or an angle bracket, so those end the
  // match. Trailing sentence punctuation is trimmed separately, below, since a
  // URL legitimately can contain "." and ")" in the middle.
  BARE_URL_RE,
];

/**
 * Punctuation that ends a sentence rather than belonging to the URL that
 * precedes it. "(see https://example.com)" and "at https://example.com." both
 * close a construct the URL is only sitting inside.
 */
const URL_TRAILING_RE = /[.,;:!?)\]}]+$/;

/**
 * Indentation no longer protects anything, and the corpus is why.
 *
 * The rule used to be "a line indented four spaces is a code block, unless it
 * looks like a list, table or quote". It was narrowed once already, after
 * blanket protection hid 38 findings behind nested bullets. Narrowing was not
 * enough, because the case it could never see is a continuation paragraph: an
 * indented line under a list item, carrying no marker of its own, which is
 * ordinary prose that happens to be indented.
 *
 * Counted over every indented, non-list line outside a fence in this corpus:
 *
 *   293  HTML attribute continuation lines, an <img> split over several lines
 *    46  continuation paragraphs under a list item, all prose
 *     8  `width="480" height="688"`, also attribute continuations
 *     0  anything else
 *
 * So there is no genuinely indented code here at all. The 143 semicolons this
 * rule was originally added for were `style="max-width: 900px; width: 100%"`
 * on continuation lines, which the attribute pattern above now covers directly
 * and more precisely. Meanwhile the rule was hiding 46 real prose lines, two of
 * which carried an em dash and an arrow that three separate reviewers found by
 * reading and no check could report.
 *
 * Fenced code is protected by `inFenceMask`, which every check already
 * consults, and this corpus fences its samples. If indented code ever appears,
 * the honest fix is a document-level detector that knows list nesting, not a
 * per-line guess.
 */
function indentedCodeSpan() {
  return null;
}

/**
 * The line with every protected span blanked out, same length as the input.
 *
 * Every pattern is matched against the ORIGINAL line and the spans are unioned
 * afterwards. Applying them in sequence to a progressively blanked string lets
 * one pattern manufacture a match for another: blanking an `<img …>` tag leaves
 * the line starting with a run of spaces, which the indented-code pattern then
 * matched, swallowing the real prose that followed the tag.
 */
function maskProse(line, { proseAttributes = true, fill = ' ' } = {}) {
  const covered = new Uint8Array(line.length);
  for (const re of PROTECTED_PATTERNS) {
    re.lastIndex = 0;
    const isUrl = re === BARE_URL_RE;
    for (const m of line.matchAll(re)) {
      let length = m[0].length;
      if (isUrl) length -= (m[0].match(URL_TRAILING_RE) || [''])[0].length;
      for (let i = m.index; i < m.index + length; i++) covered[i] = 1;
    }
  }
  const code = indentedCodeSpan(line);
  if (code) for (let i = code[0]; i < code[1]; i++) covered[i] = 1;

  // Runs last, so it wins over whichever pattern covered the tag.
  if (proseAttributes) {
    PROSE_ATTR_RE.lastIndex = 0;
    for (const m of line.matchAll(PROSE_ATTR_RE)) {
      const start = m.index + m[0].indexOf(m[1]);
      for (let i = start; i < start + m[1].length; i++) covered[i] = 0;

      // Except the entities inside it. Uncovering the whole value also
      // uncovered the required trailing semicolon of `&quot;`, `&lt;` and
      // `&gt;`, which alt text uses to describe markup, and reported four of
      // them as prose semicolons no edit could clear.
      ENTITY_RE.lastIndex = 0;
      for (const e of m[1].matchAll(ENTITY_RE)) {
        for (let i = start + e.index; i < start + e.index + e[0].length; i++) covered[i] = 1;
      }
    }
  }

  let out = '';
  for (let i = 0; i < line.length; i++) out += covered[i] ? fill : line[i];
  return out;
}

/**
 * The same mask, filled with a word character instead of a space.
 *
 * A space is right for punctuation rules: a dash inside a code span should read
 * as absent. It is wrong for emphasis, because the markers care what sits next
 * to them. `*\`fetchCompositionData\` does not return "not found"*` masks to
 * `*                       does not ...*`, and the emphasis pattern refuses an
 * opener followed by whitespace, so the whole span went unseen. Filling with a
 * word character keeps the adjacency the author actually wrote.
 */
function maskForEmphasis(line) {
  return maskProse(line, { fill: 'x' });
}

/**
 * Attributes whose value is text a human reads, so it is prose.
 *
 * Protecting the whole HTML tag was too broad. `style="max-width: 680px; width:
 * 100%"` is CSS and its semicolons are required syntax, which is why tags are
 * protected at all. But `alt` is the text a screen reader speaks, and this
 * corpus had 90 em dashes and semicolons plus 6 arrows sitting in `alt` values
 * where no rule could see them. Five separate reviewers reported the same gap
 * independently, each having noticed a diagram caption that reads correctly on
 * screen and breaks the house style when spoken.
 *
 * The value span is uncovered after every pattern has run, so it survives both
 * the single-line tag pattern and the continuation-line pattern that catches
 * the three-line `<img>` form this corpus uses for every diagram.
 */
const PROSE_ATTR_RE = /\b(?:alt|title|aria-label|placeholder)\s*=\s*"([^"]*)"/gi;

/** True when the character at `index` sits inside a protected span. */
function isProtectedAt(masked, index) {
  return masked[index] === ' ';
}

/**
 * Every index on the line where one of `chars` appears in prose.
 *
 * `chars` is a character-class regex tested one character at a time, so a
 * caller passing /[—–;]/ gets back the positions of real prose dashes and
 * semicolons and nothing else.
 */
function proseMatches(line, charRe) {
  const masked = maskProse(line);
  const out = [];
  for (let i = 0; i < masked.length; i++) {
    if (charRe.test(masked[i]) && !isProtectedAt(masked, i)) out.push(i);
  }
  return out;
}

/**
 * The mask for structural questions rather than prose ones.
 *
 * "Is this em dash prose?" and "is this pipe a table cell separator?" are two
 * different questions about the same character, and `alt` text is where they
 * diverge. The words in an alt value are prose, so a dash there is a finding.
 * A pipe there is still markup: it sits inside an attribute and cannot separate
 * table cells. Answering both from one mask made a pipe inside alt text split a
 * row.
 *
 * So this covers every HTML tag whole, attributes included, and the table
 * splitter uses it while the punctuation rules use `maskProse`.
 */
function maskMarkup(line) {
  return maskProse(line, { proseAttributes: false });
}

module.exports = {
  maskProse,
  maskMarkup,
  maskForEmphasis,
  isProtectedAt,
  proseMatches,
  PROTECTED_PATTERNS,
  PROSE_ATTR_RE,
};
