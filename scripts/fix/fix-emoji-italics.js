#!/usr/bin/env node
'use strict';

/**
 * Fixer for the emoji, italics and typographic-substitute rules (C3-27, C3-28,
 * C3-30).
 *
 * Built the same way as fix-dashes.js and for the same reason: 3,100 findings
 * across 300 files is too many for one model call each. A deterministic pass
 * takes the shapes where the replacement is decidable from the text alone, and
 * only the remainder is batched and judged.
 *
 * The deterministic set here is much narrower than it first looks, and the
 * corpus is why. Italics are mechanical everywhere: dropping the markers never
 * changes what a sentence says. Emoji are not, because a good half of them
 * carry meaning:
 *
 *   - "- ✅ `Grid.columns: 2 | 3 | 4`" against "- ❌ `Section.padding: 96`" is a
 *     good example against a bad one. Deleting both marks makes the two bullets
 *     say the same thing.
 *   - "| ⚠️ unverified |" is a status, not decoration.
 *   - One line is a legend: "⚠️ means untested. ❌ means measured and refused."
 *     Strip the symbols and it describes nothing.
 *
 * So the rules below only fire where the mark is provably ornamental: an arrow
 * inside a link label, a lone tick or cross in a table cell, and a decorative
 * pictograph sitting in front of a heading or a bold label that already says
 * what the line is about. Everything else goes to the model or to a human.
 *
 * Usage:
 *   node fix/fix-emoji-italics.js <file|dir>... --report
 *   node fix/fix-emoji-italics.js <file|dir>... --apply
 *   node fix/fix-emoji-italics.js <file|dir>... --apply --llm --batch=10
 *   node fix/fix-emoji-italics.js <file|dir>... --apply --rules=italics
 *   node fix/fix-emoji-italics.js <file|dir>... --apply --llm --rules=typography
 *
 * After ANY --llm run over a corpus that keeps a mirror, resync it:
 * `node sync-mirror.js <source-dir> <mirror-dir> --apply`.
 * `skills/src/` and `docs/prompts/` hold the same 84 files and lint-skills.ts
 * requires them byte-identical. A deterministic pass keeps that true for free.
 * A model pass does not: it reaches docs/prompts/ at file 185 and skills/src/
 * at file 272, rewrites the two copies of one line in two separate calls, and
 * two calls do not have to return the same sentence.
 *
 * The typography family (C3-30) has almost no deterministic half, and the
 * corpus is why. Reading all 261 prose occurrences on published pages, exactly
 * one shape replaces itself: a middle dot with a space on each side, which is
 * always a separator between list items and is always a comma. Every other
 * character stands for a different word depending on where it sits. "Node >= 18"
 * wants "or later", a schema row's "<= 256 chars" wants "at most", and a
 * cross-reference "Page S Step 3" wants "section". Guessing between those is
 * what the model call is for.
 */

const fs = require('fs');
const path = require('path');

const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { collectDocs } = require('../sweep-docs');
const { maskProse, maskForEmphasis } = require('../lib/prose-mask');
const { EMOJI_RE } = require('../checks/no-emoji');
const { AST_RE, UND_RE, HTML_ITALIC_RE } = require('../checks/no-italics');
const { BANNED_RE: TYPO_RE, HINTS: TYPO_HINTS } = require('../checks/typographic-substitutes');
const {
  isTableRow,
  isAlignmentRow,
  cellSpans,
  splitCells,
  separatorCount,
  rowShapeOk,
} = require('../lib/table-shape');

const EMOJI_G = new RegExp(EMOJI_RE.source, 'gu');
const DEFAULT_BATCH_SIZE = 10;
const CLAUDE_TIMEOUT_MS = 240000;

/**
 * Pictographs that are purely ornamental in this corpus, verified by reading
 * every occurrence. A tick, a cross, a warning triangle and a no-entry sign are
 * deliberately NOT here: each of those is load-bearing somewhere.
 */
const DECORATIVE = new Set([
  '🎯', '🧭', '🚀', '🎨', '🧠', '💡', '📋', '🔨', '👔', '🔗',
  '✍', '💼', '📦', '🤖', '🔁', '⚙', '🔑', '▶', 'ℹ', '⚡',
]);

const TICKS = new Set(['✅', '✔', '✓']);
const CROSSES = new Set(['❌', '✗', '✘']);

/** A line's line-start furniture: heading hashes, list marker, blockquote. */
const PREFIX_RE = /^(\s*(?:>\s*)*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)?)/;

function hasEmoji(line) {
  EMOJI_G.lastIndex = 0;
  return EMOJI_G.test(maskProse(line));
}

function hasItalics(line) {
  const m = maskForEmphasis(line);
  AST_RE.lastIndex = 0;
  UND_RE.lastIndex = 0;
  HTML_ITALIC_RE.lastIndex = 0;
  return AST_RE.test(m) || UND_RE.test(m) || HTML_ITALIC_RE.test(line);
}

function hasTypography(line) {
  TYPO_RE.lastIndex = 0;
  const found = TYPO_RE.test(maskProse(line));
  TYPO_RE.lastIndex = 0;
  return found;
}

function offends(line) {
  return hasEmoji(line) || hasItalics(line) || hasTypography(line);
}

// ---------------------------------------------------------------------------
// Deterministic rules
// ---------------------------------------------------------------------------

/**
 * Drop every italic marker, keeping the text between them.
 *
 * Mechanical in every case the corpus contains. Single-word contrastive
 * emphasis loses nothing a reader can act on, and a wrapped quotation keeps its
 * quotation marks, which is what was carrying the meaning.
 *
 * Matched against the mask and spliced into the raw line at the same offsets,
 * because an asterisk inside inline code is not a marker.
 */
function dropItalics(line) {
  // The emphasis mask, not the prose mask. Blanking a code span to spaces makes
  // `*`fetchCompositionData` does not return "not found"*` look like an opener
  // followed by whitespace, which the pattern refuses, so 27 spans went unseen.
  const masked = maskForEmphasis(line);
  const spans = [];
  for (const re of [AST_RE, UND_RE]) {
    re.lastIndex = 0;
    for (const m of masked.matchAll(re)) {
      spans.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  if (!spans.length) return null;

  spans.sort((a, b) => b.start - a.start);
  let out = line;
  for (const s of spans) {
    const inner = out.slice(s.start + 1, s.end - 1);
    out = out.slice(0, s.start) + inner + out.slice(s.end);
  }
  return out === line ? null : { line: out, rule: 'drop-italics' };
}

/** Remove an HTML italic tag, keeping its content. */
function dropHtmlItalics(line) {
  HTML_ITALIC_RE.lastIndex = 0;
  if (!HTML_ITALIC_RE.test(line)) return null;
  const out = line.replace(HTML_ITALIC_RE, '');
  return out === line ? null : { line: out, rule: 'drop-html-italics' };
}

/**
 * An arrow at the end of a link label is decoration on the link, not a
 * relation. "[Hero from primitives →](../recipes/hero.md)" reads identically
 * without it, and 30 rows use it as a "read more" flourish.
 */
function dropLinkLabelArrow(line) {
  const out = line.replace(/(\[[^\]]*?)\s*[←-⇿]\s*(\]\()/gu, '$1$2');
  return out === line ? null : { line: out, rule: 'link-label-arrow' };
}

/**
 * A table cell holding nothing but a tick or a cross is a yes or a no.
 *
 * Only fires when the mark is the cell's entire content. A cell reading
 * "⚠️ unverified" or "❌ measured and refused" is a sentence, and its mark is
 * part of what it says.
 */
function statusOnlyCells(line) {
  if (!isTableRow(line) || isAlignmentRow(line)) return null;
  const spans = cellSpans(line);
  let out = line;
  let changed = false;

  // Right to left, so an earlier replacement cannot shift a later span.
  for (const [start, end] of [...spans].reverse()) {
    const raw = out.slice(start, end);
    const cell = raw.trim();
    const bare = cell.replace(/️/g, '');
    const word = TICKS.has(bare) ? 'Yes' : CROSSES.has(bare) ? 'No' : null;
    if (!word) continue;
    out = out.slice(0, start) + raw.replace(cell, word) + out.slice(end);
    changed = true;
  }
  if (!changed) return null;
  // Never reshape a table to fix a cell.
  if (separatorCount(out) !== separatorCount(line)) return null;
  return { line: out, rule: 'status-cell-word' };
}

/**
 * A decorative pictograph in front of a heading, a bullet or a bold label.
 *
 * "> 🎯 **This is a read-before-you-register doc**" and
 * "> ⛔ **Auth preflight: settle the credential first.**" both state their point
 * in the bold text. The mark adds nothing, and 341 lines use one this way.
 *
 * The no-entry sign is included HERE, and only here, because in front of a bold
 * label it is ornamental. Standing alone in a table cell it means forbidden, so
 * it is not in DECORATIVE and no other rule touches it.
 */
function dropDecorativePrefix(line) {
  const prefix = line.match(PREFIX_RE)[0];
  const rest = line.slice(prefix.length);

  const m = rest.match(/^((?:\p{Extended_Pictographic}️?\s*)+)(?=\S)/u);
  if (!m) return null;

  const marks = [...m[1].matchAll(/\p{Extended_Pictographic}/gu)].map((x) => x[0]);
  const after = rest.slice(m[1].length);

  const ornamental = marks.every((c) => DECORATIVE.has(c) || (c === '⛔' && after.startsWith('**')));
  if (!ornamental || !marks.length) return null;

  return { line: `${prefix}${after}`, rule: 'drop-decorative-prefix' };
}

/**
 * A middle dot with a space on each side is a separator, and a separator is a
 * comma.
 *
 * The only deterministic shape in the whole typography family. Every one of the
 * 116 prose occurrences on published pages does the same job: it joins list
 * items that share a line. Navigation links in a blockquote, bold column names
 * in a sentence, allowed values in a table cell, and the two halves of a
 * workshop heading. A comma carries all four, and a screen reader reads it.
 *
 * The spaces are load-bearing in the pattern. A dot with no space around it is
 * not a separator: it appears inside version strings and identifiers, and this
 * rule must not touch those. The prose mask already excludes code spans, so
 * this is belt and braces on a rule that edits many lines.
 */
function dotSeparatorToComma(line) {
  const masked = maskProse(line);

  // The dot is LOCATED in the mask, so a dot inside a code span or a link
  // target is invisible. The span to replace is then measured on the RAW line.
  //
  // Measuring it on the mask is a bug that the integrity verifier caught on its
  // first run: masking blanks a protected span to spaces of the same length, so
  // "[`a`](a.md) · [`b`](b.md)" masks to a dot with fifteen spaces on each side.
  // A `\s+` around the dot then swallowed both link targets, and splicing those
  // offsets into the raw line produced "- [, [, [". The mask says WHERE, never
  // HOW MUCH.
  const spans = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== '\u00b7') continue;
    let start = i;
    let end = i + 1;
    while (start > 0 && /[ \t]/.test(line[start - 1])) start -= 1;
    while (end < line.length && /[ \t]/.test(line[end])) end += 1;
    // A separator has whitespace on both sides and content on both sides. A
    // dot with no space around it sits inside an identifier or a version.
    if (start === i || end === i + 1) continue;
    if (!/\S/.test(line.slice(0, start)) || !/\S/.test(line.slice(end))) continue;
    spans.push({ start, end });
  }
  if (!spans.length) return null;

  spans.sort((a, b) => b.start - a.start);
  let out = line;
  for (const s of spans) out = `${out.slice(0, s.start)}, ${out.slice(s.end)}`;
  return out === line ? null : { line: out, rule: 'dot-separator-comma' };
}

/**
 * A trailing ellipsis that ends a lead-in phrase, deleted.
 *
 * The commonest shape in this corpus and the one the model got wrong most
 * often. A table header reading "You want to…" is a stem that the next column
 * completes, and the ellipsis is typographic throat-clearing. The first model
 * pass returned "You want to, and so on", "Goes on, and so on" and "You're
 * starting with, and so on", which say nothing. So this shape never reaches the
 * model.
 *
 * An enumeration is the shape it must NOT touch. "Hero, Card, Button…" also
 * ends its cell, and there the ellipsis stands for members the line stopped
 * listing, so "and so on" is right. Two or more commas before the character in
 * the same cell is what separates them, because a lead-in is one clause and an
 * enumeration is a list.
 *
 * A quoted ellipsis is left alone too. Inside quotation marks it usually
 * reproduces what the product shows, such as a truncated entry title in a
 * screenshot caption, and that is not prose to rewrite.
 */
function trailingLeadInEllipsis(line) {
  const masked = maskProse(line);
  const spans = [];

  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== '\u2026') continue;

    // Must end its cell or its line, allowing trailing spaces before a pipe.
    const after = line.slice(i + 1);
    if (!/^\s*(\||$)/.test(after)) continue;

    // The cell, or the line, that the character closes.
    const cellStart = line.lastIndexOf('|', i) + 1;
    const cell = line.slice(cellStart, i);

    // Inside quotation marks: product output, not prose.
    if ((cell.match(/"/g) || []).length % 2 === 1) continue;
    // An enumeration, not a lead-in.
    if ((cell.match(/,/g) || []).length >= 2) continue;
    // Nothing to lead in from.
    if (!/\S/.test(cell)) continue;

    let start = i;
    while (start > cellStart && /\s/.test(line[start - 1])) start -= 1;
    spans.push({ start, end: i + 1 });
  }
  if (!spans.length) return null;

  spans.sort((a, b) => b.start - a.start);
  let out = line;
  for (const s of spans) out = out.slice(0, s.start) + out.slice(s.end);
  return out === line ? null : { line: out, rule: 'trailing-lead-in-ellipsis' };
}

/**
 * Which rule belongs to which family, so `--rules=italics` can run the safe,
 * fully mechanical half on its own. Italics are decidable everywhere. Emoji
 * are not, so being able to land the italics pass separately keeps that diff
 * reviewable on its own.
 */
const FAMILIES = {
  italics: [dropHtmlItalics, dropItalics],
  emoji: [dropLinkLabelArrow, statusOnlyCells, dropDecorativePrefix],
  typography: [dotSeparatorToComma, trailingLeadInEllipsis],
};

const DETERMINISTIC = [...FAMILIES.italics, ...FAMILIES.emoji];

function rulesFor(families) {
  if (!families) return DETERMINISTIC;
  return families.flatMap((f) => FAMILIES[f] || []);
}

/** True when `line` satisfies the families being run, not necessarily both. */
const FAMILY_TESTS = {
  italics: hasItalics,
  emoji: hasEmoji,
  typography: hasTypography,
};

function satisfiesFamilies(line, families) {
  if (!families) return !offends(line);
  return families.every((f) => !(FAMILY_TESTS[f] || (() => false))(line));
}

/** Apply the deterministic rules until the line stops changing or comes clean. */
function fixDeterministic(line, families = null) {
  let current = line;
  const applied = [];
  const rules = rulesFor(families);
  for (let pass = 0; pass < 4; pass++) {
    if (satisfiesFamilies(current, families)) break;
    let progressed = false;
    for (const rule of rules) {
      const r = rule(current);
      if (r && r.line !== current) {
        // No rule here is allowed to reshape a table.
        if (isTableRow(current)) {
          if (separatorCount(r.line) !== separatorCount(current)) continue;
          if (rowShapeOk(current) && !rowShapeOk(r.line)) continue;
        }
        current = r.line;
        applied.push(r.rule);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  return { line: current, applied, clean: satisfiesFamilies(current, families) };
}

// ---------------------------------------------------------------------------
// Batched model pass
// ---------------------------------------------------------------------------

function buildBatchPrompt(items, priorViolation) {
  const lines = [
    'You are editing technical documentation. This doc set forbids emoji,',
    'arrows, italics, and typographic characters standing in for words, in prose.',
    '',
    `Below are ${items.length} numbered lines. Rewrite each to remove every emoji,`,
    'arrow, italic marker and banned typographic character, keeping the meaning',
    'those marks were carrying.',
    '',
    'How to replace them:',
    '- An arrow stands for a different relation each time. Name the relation.',
    '  A UI path becomes "then": "Settings then Advanced".',
    '  A range becomes "to". A mapping becomes "becomes" or "maps to".',
    '  A consequence becomes a clause: "which produces", "so".',
    '- A tick or cross that means yes or no becomes "Yes" or "No".',
    '- A tick or cross marking a good against a bad example becomes a word that',
    '  says which: "Good:" and "Avoid:", or "Supported" and "Not supported".',
    '- A warning sign becomes nothing when a callout already says Warning, or',
    '  the word the row needs ("unverified", "untested").',
    '- An italic marker comes off. A quoted phrase keeps its quotation marks.',
    '- A typographic character stands for a different word in each place it sits,',
    '  so write the word the sentence needs:',
    '  ·  a separator between items: use a comma, or "and"',
    '  §  a cross-reference between a page name and a section name: use a comma.',
    '     "[Section Slots § Slot vs Section Slot]" becomes',
    '     "[Section Slots, Slot vs Section Slot]". Never just delete it: the two',
    '     names run together and the label stops making sense.',
    '  …  depends entirely on what it stands for, so read the line first:',
    '     - A trailing lead-in that the next column or the next line completes.',
    '       A table header "You want to…" or "Goes on…", a stem like "You would',
    '       have to…". DELETE the character and change nothing else. It becomes',
    '       "You want to". Do NOT write "and so on" here: the phrase is not a',
    '       list and "You want to, and so on" says nothing.',
    '     - Omitted members of a list that the line has begun enumerating.',
    '       "Hero, Card, Button…" becomes "Hero, Card, Button, and so on".',
    '     - Inside quotation marks reproducing what the product SHOWS, such as a',
    '       truncated entry title in a screenshot caption: "Welcome to Studio…".',
    '       LEAVE IT EXACTLY AS IT IS. It is the product output, not prose.',
    '  ×  dimensions: write "by" ("1440 by 900")',
    '  ≥  write "or later", "at least", or "or more"',
    '  ≤  write "or earlier", "at most", or "or fewer"',
    '  ≠  write "is not" or "differs from"',
    '  •  a bullet: use a Markdown list item, or a comma in a sentence',
    '  ±  write "plus or minus"',
    '  ≈  write "about" or "approximately"',
    '- A heading that reads "A · B: C" becomes "A, B: C". Do not add a second colon.',
    '- Leave box-drawing characters alone. They draw diagrams and are not in scope.',
    '- Leave ©, ®, ™ and ° alone. Those are legal marks and units, not decoration.',
    '',
    'Rules you must not break:',
    '- Return the COMPLETE line, from its first character to its last, including',
    '  any list marker, heading hashes, blockquote marker, table pipes, or',
    '  leading whitespace.',
    '- Keep the number of table cell separators ("|") exactly as it is.',
    '- Never change text inside backticks or inside a link target. Leave those',
    '  byte-identical.',
    '- An alt, title, aria-label or placeholder attribute value IS prose, because a',
    '  screen reader reads it aloud, so replace the marks inside it. Keep the',
    '  attribute name, both quote marks, and every other attribute byte-identical.',
    '  A style attribute is CSS: leave it exactly as it is.',
    '- Keep every identifier, parameter name, flag, URL, file path and version',
    '  number byte-identical.',
    '- Do not reword anything the mark removal does not require.',
    '- Do not introduce a new emoji, arrow, italic, em dash, en dash, semicolon,',
    '  or banned typographic character.',
    '',
    'Reply with one line per input, in this exact format and nothing else:',
    '',
    '<number>|<the corrected full line>',
    '',
    'Do not add explanation, headers, blank lines, or markdown fences.',
    '',
    'Lines to fix:',
  ];
  items.forEach((item, i) => lines.push(`${i + 1}|${item.text}`));
  if (priorViolation) {
    lines.push('', `Your previous reply was rejected: ${priorViolation}`, 'Fix that specifically.');
  }
  return lines.join('\n');
}

function parseBatchReply(reply, items) {
  const out = new Map();
  for (const raw of String(reply).split('\n')) {
    const m = raw.match(/^\s*(\d+)\s*\|(.*)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    if (idx >= 1 && idx <= items.length) out.set(idx - 1, m[2]);
  }
  return out;
}

/** Every inline code span and link target, which must survive verbatim. */
function preserved(text) {
  return [
    ...[...text.matchAll(/`[^`\n]+`/g)].map((m) => m[0]),
    ...[...text.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1]),
  ];
}

function findViolation(text, original) {
  // An ellipsis kept because it reproduces product output is the one case where
  // a line may legitimately come back still carrying a banned character. Only
  // that character, only inside quotation marks, and only when the original had
  // it there too: everything else still has to go.
  const quotedEllipsisOnly = (s) => {
    const stripped = s.replace(/"[^"]*\u2026[^"]*"/g, (m) => m.replace(/\u2026/g, ''));
    return !hasTypography(stripped) && !hasEmoji(stripped) && !hasItalics(stripped);
  };
  if (offends(text)) {
    const originalHadQuotedEllipsis = /"[^"]*\u2026[^"]*"/.test(original);
    if (!(originalHadQuotedEllipsis && quotedEllipsisOnly(text))) {
      return 'still contains an emoji, arrow, italic marker, or one of the banned typographic characters';
    }
  }
  if (/[—–;]/.test(maskProse(text))) return 'introduced an em dash, en dash or semicolon';

  for (const item of preserved(original)) {
    if (!text.includes(item)) return `dropped ${item}, which must survive verbatim`;
  }

  // An attribute value is prose, but the attribute itself is markup.
  const shape = (s) => (s.match(/[a-zA-Z-]+\s*=\s*"/g) || []).join(',');
  if (shape(text) !== shape(original)) {
    return 'changed the HTML attribute structure, which must stay byte-identical';
  }
  if ((text.match(/"/g) || []).length !== (original.match(/"/g) || []).length) {
    return 'changed the number of quote marks, so an attribute is unbalanced';
  }
  const styleOf = (s) => (s.match(/style\s*=\s*"[^"]*"/g) || []).join('|');
  if (styleOf(text) !== styleOf(original)) {
    return 'altered a style attribute, which is CSS and out of scope';
  }

  // Bold is not in scope for any of these three rules, and the model dropped a
  // pair anyway: '**"SDK Not Initialized"**' came back unbolded while the
  // section sign two clauses later was being replaced. One line in eighteen, so
  // not systematic, but a silent emphasis change is exactly the class of damage
  // PR #86 spent a pass undoing. A retry that names it is visible. A skip is
  // visible. A quiet edit is not.
  if ((text.match(/\*\*/g) || []).length !== (original.match(/\*\*/g) || []).length) {
    return 'changed the bold markers, which none of these rules covers';
  }

  if (isTableRow(original)) {
    if (separatorCount(text) !== separatorCount(original)) {
      return `is a table row and came back with ${separatorCount(text)} cell separators instead of ${separatorCount(original)}`;
    }
    if (rowShapeOk(original) && !rowShapeOk(text)) {
      return 'is a table row whose cells were balanced and now are not';
    }
  }

  // Wider than the dash fixer's band on purpose. Naming a relation an arrow was
  // standing in for lengthens a line: "A → B" becomes "A then B", and a
  // five-hop UI path grows by four words.
  const ratio = text.length / Math.max(original.length, 1);
  if (ratio < 0.6 || ratio > 2.2) {
    return `changed length too much (${original.length} to ${text.length}), which usually means a fragment was returned instead of the whole line`;
  }
  return null;
}

function askForBatch(items) {
  const reply = askClaude({
    attempts: 2,
    timeoutMs: CLAUDE_TIMEOUT_MS,
    buildPrompt: (prior) => buildBatchPrompt(items, prior),
    validate: (candidate) => {
      const parsed = parseBatchReply(candidate, items);
      if (parsed.size !== items.length) {
        return `expected ${items.length} numbered lines, parsed ${parsed.size}`;
      }
      for (const [i, text] of parsed) {
        const v = findViolation(text, items[i].text);
        if (v) return `line ${i + 1} ${v}`;
      }
      return null;
    },
  });
  return reply ? parseBatchReply(reply, items) : null;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    targets: [],
    apply: false,
    llm: false,
    report: false,
    maxCalls: 0,
    batch: DEFAULT_BATCH_SIZE,
    rules: null,
  };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--llm') args.llm = true;
    else if (arg === '--report') args.report = true;
    else if (arg.startsWith('--max-calls=')) args.maxCalls = parseInt(arg.split('=')[1], 10) || 0;
    else if (arg.startsWith('--batch=')) args.batch = parseInt(arg.split('=')[1], 10) || DEFAULT_BATCH_SIZE;
    else if (arg.startsWith('--rules=')) args.rules = arg.split('=')[1].split(',');
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

/**
 * Flagged lines in one file, with the deterministic outcome already computed.
 *
 * `clean` means the line now satisfies the families being run, not that it
 * satisfies both rules. An italics-only pass over a line carrying an arrow too
 * reports clean once the markers are gone, and leaves the arrow to the emoji
 * pass, rather than holding the whole line back.
 */
function analyzeFile(filePath, families) {
  const doc = DocModel.fromFile(filePath);
  const lines = doc.lines.slice();
  const flagged = [];

  const satisfied = (line) => satisfiesFamilies(line, families);

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = lines[lineNo - 1];
    if (satisfied(raw)) continue;

    const result = fixDeterministic(raw, families);
    flagged.push({ lineNo, text: raw, ...result, clean: satisfied(result.line) });
  }
  return { doc, lines, flagged };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.targets.length) {
    console.error('Usage: fix-emoji-italics.js <file|dir>... [--report] [--apply] [--llm] [--batch=N] [--max-calls=N] [--rules=emoji,italics]');
    process.exit(2);
  }

  const files = [...new Set(args.targets.flatMap((t) => collectDocs(path.resolve(t))))].sort();
  const stats = { files: 0, flagged: 0, deterministic: 0, llm: 0, unresolved: 0, calls: 0 };
  const byRule = {};
  const unresolved = [];

  for (const file of files) {
    const { lines, flagged } = analyzeFile(file, args.rules);
    if (!flagged.length) continue;
    stats.files += 1;
    stats.flagged += flagged.length;

    let dirty = false;
    const pending = [];

    for (const item of flagged) {
      if (item.clean && item.line !== item.text) {
        lines[item.lineNo - 1] = item.line;
        stats.deterministic += 1;
        for (const r of item.applied) byRule[r] = (byRule[r] || 0) + 1;
        dirty = true;
      } else {
        pending.push(item);
      }
    }

    if (args.llm && pending.length) {
      for (let i = 0; i < pending.length; i += args.batch) {
        if (args.maxCalls && stats.calls >= args.maxCalls) break;
        const batch = pending.slice(i, i + args.batch);
        stats.calls += 1;
        const replies = askForBatch(batch);
        if (!replies) continue;
        for (const [idx, text] of replies) {
          const item = batch[idx];
          lines[item.lineNo - 1] = text;
          stats.llm += 1;
          byRule['model'] = (byRule['model'] || 0) + 1;
          dirty = true;
        }
      }
    }

    // Write partial progress, so a run that stops early is not lost.
    if (dirty && args.apply) fs.writeFileSync(file, lines.join('\n'));

    for (const item of pending) {
      if (lines[item.lineNo - 1] === item.text) {
        stats.unresolved += 1;
        unresolved.push(`${path.relative(process.cwd(), file)}:${item.lineNo}  ${item.text.trim().slice(0, 110)}`);
      }
    }
  }

  console.log(`mode              ${args.apply ? 'apply' : 'dry run'}${args.llm ? ' + model' : ''}`);
  console.log(`files with issues ${stats.files}`);
  console.log(`lines flagged     ${stats.flagged}`);
  console.log(`fixed by rule     ${stats.deterministic}`);
  if (args.llm) console.log(`fixed by model    ${stats.llm} in ${stats.calls} call(s)`);
  console.log(`left for a human  ${stats.unresolved}`);
  if (Object.keys(byRule).length) {
    console.log('');
    for (const [r, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${r}`);
    }
  }
  if (args.report && unresolved.length) {
    console.log('');
    console.log('needs judgment:');
    for (const u of unresolved.slice(0, 60)) console.log(`  ${u}`);
    if (unresolved.length > 60) console.log(`  ... and ${unresolved.length - 60} more`);
  }
}

if (require.main === module) main();

module.exports = {
  fixDeterministic,
  satisfiesFamilies,
  dropItalics,
  dropHtmlItalics,
  dropLinkLabelArrow,
  statusOnlyCells,
  dropDecorativePrefix,
  dotSeparatorToComma,
  trailingLeadInEllipsis,
  findViolation,
  parseBatchReply,
  hasEmoji,
  hasItalics,
  hasTypography,
  DECORATIVE,
};
