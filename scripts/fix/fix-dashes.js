#!/usr/bin/env node
'use strict';

/**
 * Fixer for em dash, en dash and semicolon findings (C3-05).
 *
 * C3-05 is 78 percent of every tier-1 finding in this corpus: 4,497 flagged
 * lines across 169 files. The other fixers in this directory make one `claude`
 * CLI call per flagged line with a 120 second timeout, which at that volume is
 * about 150 hours of serial work. So this one is built the other way round.
 *
 *   1. A deterministic pass handles the shapes where the correct replacement is
 *      decidable from punctuation alone. Those never reach the model.
 *   2. Whatever is left is batched, many lines per call, and only then judged.
 *
 * The deterministic rules are deliberately narrow. A rule that guesses whether
 * the clause after a dash is independent gets it wrong often enough to produce
 * ungrammatical prose at scale, and a wrong fix is worse than no fix here
 * because the diff still looks like progress. Anything not obviously decidable
 * is handed to the model instead.
 *
 * Protected regions, none of which are ever rewritten: fenced code blocks,
 * inline code spans, link and image targets, HTML attribute values, and YAML
 * front matter. Dashes and semicolons are legal and meaningful in all of them,
 * and `style="max-width: 680px; width: 100%"` is the common case.
 *
 * Usage:
 *   node fix/fix-dashes.js <file|dir>... --report        # classify, change nothing
 *   node fix/fix-dashes.js <file|dir>... --apply         # deterministic only
 *   node fix/fix-dashes.js <file|dir>... --apply --llm   # deterministic, then batched
 *   node fix/fix-dashes.js <file|dir>... --apply --llm --batch=20 --max-calls=20
 */

const fs = require('fs');
const path = require('path');

const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { collectDocs } = require('../sweep-docs');
const { maskProse, isProtectedAt, proseMatches } = require('../lib/prose-mask');
const { isTableRow, rowShapeOk, separatorCount } = require('../lib/table-shape');

const DASH_SEMI_RE = /[—–;]/;
const DASH_SEMI_G = /[—–;]/g;
const DEFAULT_BATCH_SIZE = 10;
const CLAUDE_TIMEOUT_MS = 240000;

// ---------------------------------------------------------------------------
// Protection
// ---------------------------------------------------------------------------

/**
 * Replace every protected span with a placeholder of the same length, so
 * offsets stay stable and no protected character can be matched or rewritten.
 *
 * Same length matters: the deterministic rules below work on the masked string
 * and then splice the original, so a placeholder that changed the length would
 * shift every later match.
 */
// Protection lives in lib/prose-mask.js so this fixer and checks/em-dash-
// semicolon.js cannot disagree about what counts as prose. They did once, and
// the check reported 296 findings this fixer put at zero.
const maskProtected = maskProse;

/** Every unprotected dash or semicolon position on a line. */
function offendingPositions(line) {
  return proseMatches(line, DASH_SEMI_RE);
}

// ---------------------------------------------------------------------------
// Deterministic rules
// ---------------------------------------------------------------------------

/**
 * A heading's dash separates a label from a description, which is exactly what
 * a colon does. "## Step 1 — Open the Campaign Template" becomes
 * "## Step 1: Open the Campaign Template".
 *
 * Skipped when the heading already has a colon, because "## A: B — C" would
 * become "## A: B: C", which reads worse than the dash did.
 */
function fixHeading(line) {
  const m = line.match(/^(#{1,6}\s+)(.*)$/);
  if (!m) return null;
  const [, hashes, text] = m;
  const masked = maskProtected(text);
  if (masked.includes(':')) return null;
  const dashes = [...masked.matchAll(/\s+[—–]\s+/g)].filter((d) => !isProtectedAt(masked, d.index + 1));
  if (dashes.length !== 1) return null;
  const d = dashes[0];
  const before = text.slice(0, d.index);
  const after = text.slice(d.index + d[0].length);
  if (!before.trim() || !after.trim()) return null;
  return { line: `${hashes}${before}: ${after}`, rule: 'heading-colon' };
}

/**
 * A bold label followed by a dash is the same label-and-description shape.
 * "- **Rule 1** — deck style only." becomes "- **Rule 1**: deck style only."
 */
function fixBoldLabel(line) {
  const m = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)?(\*\*[^*]+\*\*)(\s+[—–]\s+)(\S.*)$/);
  if (!m) return null;
  const [, marker = '', label, , rest] = m;
  return { line: `${marker}${label}: ${rest}`, rule: 'bold-label-colon' };
}

/**
 * True when a span opens and closes every grouping it contains.
 *
 * Counted on the mask, so a paren inside inline code or a style attribute does
 * not count. Quotes are counted for parity rather than nesting, which is what
 * a quote actually does.
 */
function isSelfContained(span) {
  const m = maskProtected(span);
  const count = (ch) => (m.split(ch).length - 1);
  if (m.includes('|')) return false;
  if (count('(') !== count(')')) return false;
  if (count('[') !== count(']')) return false;
  if (count('"') % 2 !== 0) return false;
  if (count("'") % 2 !== 0) return false;
  if ((m.match(/\*\*/g) || []).length % 2 !== 0) return false;
  return true;
}

/**
 * A balanced pair of spaced dashes brackets an aside, which is what parentheses
 * do. "the last element — a descender, say — must clear the edge" becomes
 * "the last element (a descender, say) must clear the edge".
 *
 * Requires exactly two, and requires the text after the closing dash to
 * continue the sentence. Two dashes where the second ends the line are two
 * separate appositives, not a pair, and bracketing them would be wrong.
 */
function fixPairedDashes(line) {
  // A table row is not one text, and this rule inserts its two parens at
  // arbitrary distance from each other. Given
  //   | Does it render multiple things AND arrange them? | **Compound — decompose** | — |
  // it found two spaced dashes, could not see the `|` between them, and emitted
  //   | Does it render multiple things AND arrange them? | **Compound (decompose** |) |
  // putting the open paren mid cell 2 and the close paren in a new cell 3. That
  // corrupted 19 rows in this corpus and reported `clean: true` while doing it.
  //
  // Rows belong to fixTableRow, which splits into cells first. A row it cannot
  // clean must go to the model, not to a rule that reads the row as one line.
  if (isTableRow(line)) return null;

  const masked = maskProtected(line);
  const dashes = [...masked.matchAll(/\s+[—–]\s+/g)].filter((d) => !isProtectedAt(masked, d.index + 1));
  if (dashes.length !== 2) return null;
  const [open, close] = dashes;
  const inner = line.slice(open.index + open[0].length, close.index);
  const tail = line.slice(close.index + close[0].length);
  if (!inner.trim() || !tail.trim()) return null;
  // An aside is short. A long span between two dashes is more likely two
  // unrelated clauses that happen to sit on one line.
  if (inner.length > 60) return null;
  if (DASH_SEMI_RE.test(maskProtected(inner))) return null;

  // The span has to be a unit, or the parens land on either side of a boundary
  // instead of around an aside.
  //
  // The table-row guard above was the first version of this check and it was
  // too narrow: a pipe is only one of the boundaries that matters. Inside an
  // alt attribute this rule turned
  //   real entry data — 'Summer Sale — 40% off' with a Shop now button
  // into
  //   real entry data ('Summer Sale) 40% off' with a Shop now button
  // because the two dashes sat on opposite sides of a quoted phrase. Same
  // failure as the table cell, different container.
  //
  // So the span must open and close everything it contains. An unbalanced
  // quote, paren or bracket means the first dash and the second belong to
  // different units, and bracketing them together is wrong however short the
  // span is.
  if (!isSelfContained(inner)) return null;

  const head = line.slice(0, open.index);
  return { line: `${head} (${inner}) ${tail}`, rule: 'paired-dash-parens' };
}

/**
 * An en dash between two short alphanumeric tokens is a range. "10–20" becomes
 * "10 to 20", and so do "Q1–Q4", "B–D" and "3–4".
 *
 * Both sides are capped at three characters and must be alphanumeric, which
 * keeps it to things that read as range endpoints. A dash between two words is
 * a sentence construction, not a range, and belongs to the other rules.
 */
function fixNumericRange(line) {
  const masked = maskProtected(line);
  let out = line;
  let changed = false;
  // No trailing \b: a range endpoint often carries a unit, as in "6–10px",
  // and a word boundary there would refuse the match. The leading lookbehind
  // is what stops a token being taken out of the middle of a word.
  const RANGE = /(?<![\w])([0-9]{1,3}|[A-Za-z][0-9]{0,2})\s*–\s*([0-9]{1,3}|[A-Za-z][0-9]{0,2})/g;
  for (const m of [...masked.matchAll(RANGE)].reverse()) {
    if (isProtectedAt(masked, m.index)) continue;
    // A single letter either side has to match in kind, so "B–D" is a range but
    // "a–3" is not.
    const bothDigits = /^\d+$/.test(m[1]) && /^\d+$/.test(m[2]);
    const bothAlpha = /^[A-Za-z]/.test(m[1]) && /^[A-Za-z]/.test(m[2]);
    if (!bothDigits && !bothAlpha) continue;
    out = `${out.slice(0, m.index)}${m[1]} to ${m[2]}${out.slice(m.index + m[0].length)}`;
    changed = true;
  }
  return changed ? { line: out, rule: 'range-to' } : null;
}

/**
 * A semicolon between two independent clauses is a sentence boundary. This only
 * fires when what follows is clearly a new clause: a space, then a lowercase
 * word, then more text. The following word is capitalized as the new sentence's
 * first word.
 *
 * A semicolon separating list items inside one sentence ("red; green; blue") is
 * left alone, because splitting it into sentences would be wrong. More than one
 * semicolon is the signal for that.
 */
function fixSemicolonClause(line) {
  const masked = maskProtected(line);
  const semis = [...masked.matchAll(/;/g)].filter((m) => !isProtectedAt(masked, m.index));
  if (semis.length !== 1) return null;
  const at = semis[0].index;
  const after = line.slice(at + 1);
  const m = after.match(/^ ([a-z])(\w*\s+\S+.*)$/);
  if (!m) return null;
  const before = line.slice(0, at);
  // Needs a real clause on the left too, not a fragment.
  if (before.trim().split(/\s+/).length < 3) return null;
  return {
    line: `${before}. ${m[1].toUpperCase()}${m[2]}`,
    rule: 'semicolon-sentence',
  };
}

/**
 * A markdown table row is several independent texts sharing a line, and the
 * other rules all anchor on line start or line end, so none of them can see
 * inside a cell. That left 595 table rows untouched purely because of where
 * their punctuation happened to sit.
 *
 * This splits the row on unescaped pipes, runs the cell-safe rules on each cell
 * as if it were its own line, and reassembles. The pipe count is asserted
 * afterwards, because a rule that introduced or swallowed one would silently
 * reshape the table.
 */
const CELL_RULES = [fixBoldLabel, fixPairedDashes, fixNumericRange, fixSemicolonClause];

function fixTableRow(line) {
  if (!/^\s*\|/.test(line)) return null;

  // Split on pipes that are not escaped and not inside inline code, using the
  // mask so a pipe inside `a|b` stays part of its cell.
  const masked = maskProtected(line);
  const bounds = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === '|' && line[i] === '|' && line[i - 1] !== '\\') bounds.push(i);
  }
  if (bounds.length < 2) return null;

  const applied = [];
  let out = '';
  let cursor = 0;
  for (const at of bounds) {
    const cell = line.slice(cursor, at);
    out += rewriteCell(cell, applied);
    out += '|';
    cursor = at + 1;
  }
  out += rewriteCell(line.slice(cursor), applied);

  if (!applied.length || out === line) return null;

  // The table's shape is not negotiable.
  const pipesBefore = (line.match(/\|/g) || []).length;
  const pipesAfter = (out.match(/\|/g) || []).length;
  if (pipesBefore !== pipesAfter) return null;

  // Counting raw pipes is not enough on its own. The corruption that got
  // through kept the pipe count identical and still moved a paren across a cell
  // boundary, so the cell that lost its opening paren and the cell that gained
  // the closing one both ended up unbalanced. Checking the separator count and
  // the per-cell shape catches that, and catches whatever the next rule added
  // to CELL_RULES gets wrong, without anyone having to anticipate it.
  if (separatorCount(out) !== separatorCount(line)) return null;
  if (rowShapeOk(line) && !rowShapeOk(out)) return null;

  return { line: out, rule: `table-cell(${[...new Set(applied)].join('+')})` };
}

function rewriteCell(cell, applied) {
  if (!cell.trim() || offendingPositions(cell).length === 0) return cell;

  // An em dash alone in a cell is an empty-value placeholder. A hyphen reads
  // the same and is not banned.
  if (/^\s*[—–]\s*$/.test(cell)) {
    applied.push('empty-cell');
    return cell.replace(/[—–]/, '-');
  }

  // A cell is a fragment, not a line, so the leading and trailing spaces that
  // give a table its padding are held aside before the line-anchored rules run.
  const lead = cell.match(/^\s*/)[0];
  const trail = cell.match(/\s*$/)[0];
  let body = cell.slice(lead.length, cell.length - trail.length);

  for (let pass = 0; pass < 3; pass++) {
    if (offendingPositions(body).length === 0) break;
    let progressed = false;
    for (const rule of CELL_RULES) {
      const r = rule(body);
      if (r && r.line !== body) {
        body = r.line;
        applied.push(r.rule);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }

  return `${lead}${body}${trail}`;
}

const DETERMINISTIC = [
  fixHeading,
  fixTableRow,
  fixBoldLabel,
  fixPairedDashes,
  fixNumericRange,
  fixSemicolonClause,
];

/** Apply deterministic rules repeatedly until the line stops changing or is clean. */
function fixDeterministic(line) {
  let current = line;
  const applied = [];
  for (let pass = 0; pass < 4; pass++) {
    if (offendingPositions(current).length === 0) break;
    let progressed = false;
    for (const rule of DETERMINISTIC) {
      const result = rule(current);
      if (result && result.line !== current) {
        current = result.line;
        applied.push(result.rule);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  return { line: current, applied, clean: offendingPositions(current).length === 0 };
}

// ---------------------------------------------------------------------------
// Batched model pass
// ---------------------------------------------------------------------------

function buildBatchPrompt(items, priorViolation) {
  const lines = [
    'You are fixing punctuation in technical documentation. This doc set forbids',
    'em dashes, en dashes and semicolons in prose.',
    '',
    `Below are ${items.length} numbered lines. Rewrite each one to remove every em dash,`,
    'en dash and semicolon, using a period, comma, parentheses, or colon instead.',
    'Choose based on the sentence: a period when both sides are independent clauses,',
    'a comma when one side is a fragment, parentheses for an aside, a colon when the',
    'dash introduces a definition or a list.',
    '',
    'Rules you must not break:',
    '- Return the COMPLETE line, from its first character to its last, including any',
    '  list marker ("- ", "1. "), bold label, table pipes, or leading whitespace.',
    '- Never change text inside backticks or inside a link target. Dashes and',
    '  semicolons are legal there and must stay exactly as they are.',
    '- An alt, title, aria-label or placeholder attribute value IS prose, because a',
    '  screen reader reads it aloud, so fix the punctuation inside it. Keep the',
    '  attribute name, both quote marks, and every other attribute byte-identical.',
    '  A style attribute is CSS: leave it exactly as it is, semicolons included.',
    '- Keep every technical fact, identifier, parameter name, flag, URL, file path and',
    '  version number byte-identical.',
    '- Do not reword anything the punctuation change does not require.',
    '- Do not introduce a new em dash, en dash or semicolon.',
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
        if (offendingPositions(text).length > 0) {
          return `line ${i + 1} still contains an em dash, en dash or semicolon in prose`;
        }
        const original = items[i].text;
        const ratio = text.length / Math.max(original.length, 1);
        if (ratio < 0.6 || ratio > 1.6) {
          return `line ${i + 1} changed length too much (${original.length} to ${text.length}), which usually means a fragment was returned instead of the whole line`;
        }
        // An attribute value is prose, but the attribute itself is markup. The
        // model is asked to rewrite inside alt text and to leave the structure
        // alone, so check the structure rather than trusting that it did.
        const shape = (s) => (s.match(/[a-zA-Z-]+\s*=\s*"/g) || []).join(',');
        if (shape(text) !== shape(original)) {
          return `line ${i + 1} changed the HTML attribute structure, which must stay byte-identical`;
        }
        if ((text.match(/"/g) || []).length !== (original.match(/"/g) || []).length) {
          return `line ${i + 1} changed the number of quote marks, so an attribute is unbalanced`;
        }
        const styleOf = (s) => (s.match(/style\s*=\s*"[^"]*"/g) || []).join('|');
        if (styleOf(text) !== styleOf(original)) {
          return `line ${i + 1} altered a style attribute, which is CSS and out of scope`;
        }

        // The model gets the same table rows the deterministic rules refused,
        // so it has the same opportunity to bracket across a cell boundary. It
        // also has to reproduce the row's pipes exactly, and the reply format
        // is itself pipe-delimited, so a dropped pipe is a plausible slip.
        if (isTableRow(original)) {
          if (separatorCount(text) !== separatorCount(original)) {
            return `line ${i + 1} is a table row and came back with ${separatorCount(text)} cell separators instead of ${separatorCount(original)}`;
          }
          if (rowShapeOk(original) && !rowShapeOk(text)) {
            return `line ${i + 1} is a table row whose cells were balanced and now are not, which means punctuation was moved across a cell boundary`;
          }
        }
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
  };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--llm') args.llm = true;
    else if (arg === '--report') args.report = true;
    else if (arg.startsWith('--max-calls=')) args.maxCalls = parseInt(arg.split('=')[1], 10) || 0;
    else if (arg.startsWith('--batch=')) args.batch = parseInt(arg.split('=')[1], 10) || DEFAULT_BATCH_SIZE;
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

/** Flagged lines in one file, with the deterministic outcome already computed. */
function analyzeFile(filePath) {
  const doc = DocModel.fromFile(filePath);
  const lines = doc.lines.slice();
  const flagged = [];

  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const raw = lines[lineNo - 1];
    if (offendingPositions(raw).length === 0) continue;
    const det = fixDeterministic(raw);
    flagged.push({
      lineNo,
      text: raw,
      deterministic: det.clean ? det.line : null,
      partial: !det.clean && det.applied.length ? det.line : null,
      applied: det.applied,
    });
  }

  return { doc, lines, flagged };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.targets.length) {
    console.error(
      'Usage: fix-dashes.js <file|dir>... [--report] [--apply] [--llm] [--batch=N] [--max-calls=N]'
    );
    process.exit(2);
  }

  // collectDocs takes one target at a time. Deduplicated because two targets
  // can overlap, and fixing the same line twice would double-count it.
  const files = [
    ...new Set(args.targets.flatMap((t) => collectDocs(path.resolve(t)))),
  ].sort();
  const stats = { files: 0, flagged: 0, deterministic: 0, partial: 0, needsLlm: 0, fixedByLlm: 0, written: 0 };
  const byRule = new Map();
  const remaining = [];

  for (const file of files) {
    const { lines, flagged } = analyzeFile(file);
    if (!flagged.length) continue;
    stats.files += 1;
    stats.flagged += flagged.length;

    let dirty = false;
    for (const item of flagged) {
      if (item.deterministic) {
        stats.deterministic += 1;
        for (const r of item.applied) byRule.set(r, (byRule.get(r) || 0) + 1);
        if (args.apply) {
          lines[item.lineNo - 1] = item.deterministic;
          dirty = true;
        }
      } else {
        stats.needsLlm += 1;
        // A partial result is written too. Each deterministic rule is safe on
        // its own, so a line where one rule fired and another shape remains is
        // still better off for having had the first applied. Discarding it,
        // which this used to do, meant a line carrying "15–20" and an em dash
        // kept both, and every mixed-punctuation line went to the model
        // carrying work the rules had already solved.
        if (item.partial) {
          stats.partial += 1;
          for (const r of item.applied) byRule.set(r, (byRule.get(r) || 0) + 1);
          if (args.apply) {
            lines[item.lineNo - 1] = item.partial;
            dirty = true;
          }
        }
        remaining.push({ file, lineNo: item.lineNo, text: item.partial || item.text });
      }
    }

    if (args.apply && dirty) {
      fs.writeFileSync(file, lines.join('\n'));
      stats.written += 1;
    }
  }

  console.log(`files with findings   ${stats.files}`);
  console.log(`flagged lines         ${stats.flagged}`);
  console.log(`deterministic         ${stats.deterministic}  ` +
    `(${((stats.deterministic / Math.max(stats.flagged, 1)) * 100).toFixed(1)}%)`);
  console.log(`partly fixed          ${stats.partial}  (a rule fired, another shape remains)`);
  console.log(`needs the model       ${stats.needsLlm}`);
  if (byRule.size) {
    console.log('\nby deterministic rule');
    for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${rule.padEnd(24)} ${n}`);
    }
  }
  const calls = Math.ceil(stats.needsLlm / args.batch);
  console.log(`\nbatched model calls needed for the rest: ${calls} at ${args.batch} lines each`);

  if (args.report || !args.apply) {
    if (remaining.length) {
      console.log('\nsample of what the model would get:');
      for (const r of remaining.slice(0, 8)) {
        console.log(`  ${path.basename(r.file)}:${r.lineNo}  ${r.text.trim().slice(0, 110)}`);
      }
    }
    if (!args.apply) console.log('\nPass --apply to write the deterministic fixes.');
    return;
  }

  if (stats.written) console.log(`\nwrote ${stats.written} file(s)`);

  if (!args.llm || !remaining.length) {
    if (remaining.length) {
      console.log(`\n${remaining.length} line(s) still need the model. Rerun with --llm.`);
    }
    return;
  }

  // Group by file so each file is read and written once.
  const batches = [];
  for (let i = 0; i < remaining.length; i += args.batch) {
    batches.push(remaining.slice(i, i + args.batch));
  }
  const limit = args.maxCalls ? Math.min(args.maxCalls, batches.length) : batches.length;
  console.log(`\nasking the model for ${limit} batch(es) of up to ${args.batch}`);

  const pending = new Map();
  for (let b = 0; b < limit; b++) {
    const batch = batches[b];
    process.stdout.write(`  batch ${b + 1}/${limit} ... `);
    const fixes = askForBatch(batch);
    if (!fixes) {
      console.log('skipped');
      continue;
    }
    let n = 0;
    for (const [i, text] of fixes) {
      const item = batch[i];
      if (text === item.text) continue;
      if (!pending.has(item.file)) pending.set(item.file, []);
      pending.get(item.file).push({ lineNo: item.lineNo, text });
      n += 1;
    }
    stats.fixedByLlm += n;
    console.log(`${n} fixed`);
  }

  for (const [file, fixes] of pending) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const f of fixes) lines[f.lineNo - 1] = f.text;
    fs.writeFileSync(file, lines.join('\n'));
  }

  console.log(`\nmodel fixed ${stats.fixedByLlm} line(s) across ${pending.size} file(s)`);
}

if (require.main === module) main();

module.exports = {
  maskProtected,
  offendingPositions,
  fixDeterministic,
  fixHeading,
  fixBoldLabel,
  fixPairedDashes,
  fixNumericRange,
  fixSemicolonClause,
  fixTableRow,
  parseBatchReply,
};
