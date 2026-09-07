#!/usr/bin/env node
'use strict';

/**
 * Agentic fixer for C3-07 (sentence-concision) findings.
 *
 * sentence-concision.js only IDENTIFIES candidate wordy sentences (tier 2,
 * non-blocking). It cannot rewrite them: judging whether a stacked clause is
 * genuinely redundant, and producing a crisp replacement, needs reading
 * comprehension. This script is the layer that closes that gap: it shells
 * out to the `claude` CLI in headless print mode (`claude -p`) once per
 * flagged sentence, asks for a rewrite scoped to that sentence only, and
 * (with --apply) writes the result back to the file.
 *
 * Defaults to a dry run that prints proposed before/after pairs. Nothing is
 * written to disk unless --apply is passed.
 *
 * Usage:
 *   node fix/fix-concision.js <file> [--type=<doc-type>] [--apply] [--yes] [--verify]
 */

const path = require('path');
const fs = require('fs');
const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { checkSentenceConcision } = require('../checks/sentence-concision');
const { checkEmDashSemicolon } = require('../checks/em-dash-semicolon');
const { checkBannedPhrases } = require('../checks/banned-phrases');

const CLAUDE_TIMEOUT_MS = 120000;
const MAX_ATTEMPTS = 2;
const DASH_SEMI_RE = /[—–;]/;

function parseArgs(argv) {
  const args = { file: null, apply: false, yes: false, verify: false };
  for (const arg of argv) {
    if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--yes') {
      args.yes = true;
    } else if (arg === '--verify') {
      args.verify = true;
    } else if (!arg.startsWith('--')) {
      args.file = arg;
    }
  }
  return args;
}

function buildPrompt(fullLine, sentence, ruleText, priorAttemptViolation) {
  const lines = [
    'You are fixing exactly one flagged sentence in a technical SDK reference doc.',
    '',
    `Rule to satisfy: ${ruleText}`,
    '',
    'Full line as it currently appears in the file:',
    fullLine,
    '',
    'The flagged sentence within that line:',
    sentence,
    '',
    'Rewrite ONLY the flagged sentence so the line satisfies the rule: split stacked',
    'justification clauses into separate sentences, drop hedges and filler, keep every',
    'technical fact, identifier, inline code span, and link exactly as they are.',
    'Do not change any other part of the line.',
    '',
    'Hard constraints, this doc set enforces these separately from the rule above:',
    '- No em dash, en dash, or semicolon anywhere in the line. Use a period, comma,',
    '  parentheses, or a new sentence instead.',
    '- No casual, marketing, or hedging phrases (for example "just", "seamless",',
    '  "right away", "in practice").',
    '',
    'Reply with ONLY the corrected full line. No explanation, no quotes, no markdown',
    'fences, no leading or trailing whitespace beyond what the line itself needs.',
  ];
  if (priorAttemptViolation) {
    lines.push(
      '',
      `Your previous attempt still violated a hard constraint: ${priorAttemptViolation}`,
      'Fix that specifically this time.'
    );
  }
  return lines.join('\n');
}

/** Blocking single-line stdin read for a y/n prompt. Returns true only on an explicit "y". */
function confirmOnStdin(promptText) {
  process.stdout.write(promptText);
  const buffer = Buffer.alloc(1024);
  let answer = '';
  try {
    const bytesRead = fs.readSync(0, buffer, 0, buffer.length, null);
    answer = buffer.toString('utf8', 0, bytesRead).trim().toLowerCase();
  } catch (err) {
    return false;
  }
  return answer === 'y' || answer === 'yes';
}

/** Any dash/semicolon or banned-phrase violation on a single candidate line, or null if clean. */
function findLineViolation(candidateLine) {
  if (DASH_SEMI_RE.test(candidateLine.replace(/`[^`]*`/g, ''))) {
    return 'contains an em dash, en dash, or semicolon';
  }
  const probeDoc = { bodyStartLine: 1, totalLines: 1, lines: [candidateLine], inFenceMask: { 1: false } };
  const phraseHits = checkBannedPhrases(probeDoc);
  if (phraseHits.length > 0) {
    return `contains a banned phrase (${phraseHits[0].message})`;
  }
  return null;
}

/** Ask the claude CLI, headless, for one rewritten line. Retries once if the reply violates a hard rule. */
function askForRewrite(fullLine, sentence, ruleText) {
  return askClaude({
    attempts: MAX_ATTEMPTS,
    timeoutMs: CLAUDE_TIMEOUT_MS,
    buildPrompt: (priorViolation) => buildPrompt(fullLine, sentence, ruleText, priorViolation),
    validate: (candidate) => {
      if (!candidate || candidate.includes('\n')) return 'the reply must be exactly one line of text';
      const ratio = candidate.length / Math.max(fullLine.length, 1);
      if (ratio < 0.4 || ratio > 1.6) {
        return 'the reply length looked wrong (too short or too long for a single-sentence fix)';
      }
      return findLineViolation(candidate);
    },
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: fix-concision.js <file> [--apply] [--yes] [--verify]');
    process.exit(2);
  }

  const filePath = path.resolve(args.file);
  const doc = DocModel.fromFile(filePath);

  const findings = checkSentenceConcision(doc).filter((f) => f.checkId === 'sentence-concision');
  if (findings.length === 0) {
    console.log(`No C3-07 candidates in ${args.file}.`);
    return;
  }

  console.log(`${findings.length} candidate(s) in ${args.file}${args.apply ? ', asking claude for rewrites' : ' (dry run, pass --apply to write and fix)'}.`);
  console.log('');

  const lines = doc.lines.slice();
  let changedCount = 0;

  for (const finding of findings) {
    const lineNo = finding.line;
    const originalLine = lines[lineNo - 1];
    const sentenceMatch = finding.message.match(/: "(.+?)(\.\.\.)?"$/);
    const sentence = sentenceMatch ? sentenceMatch[1] : originalLine.trim();
    const ruleText =
      'Write one idea per sentence. Cut hedging qualifiers and redundant justification clauses ' +
      '("in practice", "which means", "rather than letting X decide", stacking two "because/so" ' +
      'clauses in one sentence). A single subordinate clause stating the direct cause of the ' +
      'preceding fact is fine, only stacked or redundant justification is the target.';

    console.log(`L${lineNo}: ${finding.message}`);

    if (!args.apply) {
      console.log('  (dry run, no rewrite requested)');
      console.log('');
      continue;
    }

    const rewritten = askForRewrite(originalLine, sentence, ruleText);
    if (!rewritten) {
      console.log('  Skipped: no usable rewrite returned.');
      console.log('');
      continue;
    }
    if (rewritten === originalLine) {
      console.log('  Skipped: rewrite identical to original.');
      console.log('');
      continue;
    }

    console.log(`  - ${originalLine.trim()}`);
    console.log(`  + ${rewritten.trim()}`);

    if (!args.yes && !confirmOnStdin('  Write this change? [y/N] ')) {
      console.log('  Skipped: not confirmed.');
      console.log('');
      continue;
    }

    lines[lineNo - 1] = rewritten;
    changedCount += 1;
    console.log('');
  }

  if (args.apply && changedCount > 0) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Wrote ${changedCount} rewritten line(s) to ${args.file}.`);

    if (args.verify) {
      const reDoc = DocModel.fromFile(filePath);
      const remaining = checkSentenceConcision(reDoc).filter((f) => f.checkId === 'sentence-concision');
      console.log(`Verification: ${remaining.length} C3-07 candidate(s) remain after fixing.`);
      for (const f of remaining) console.log(`  L${f.line}: ${f.message}`);
    }
  } else if (args.apply) {
    console.log('No lines were changed.');
  }
}

main();
