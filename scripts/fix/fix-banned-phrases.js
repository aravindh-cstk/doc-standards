#!/usr/bin/env node
'use strict';

/**
 * Agentic fixer for banned-phrases (casual/marketing/buzzword) findings.
 *
 * banned-phrases.js only IDENTIFIES a flagged phrase and a suggested fix
 * word/phrase (tier 1, blocking). Swapping the phrase in verbatim can break
 * grammar or sentence flow, so this script shells out to the `claude` CLI in
 * headless print mode (`claude -p`) once per flagged line, asks for a
 * rewrite scoped to that line only, and (with --apply) writes the result
 * back to the file.
 *
 * Defaults to a dry run that prints proposed before/after pairs. Nothing is
 * written to disk unless --apply is passed.
 *
 * Usage:
 *   node fix/fix-banned-phrases.js <file> [--apply] [--yes] [--verify]
 */

const path = require('path');
const fs = require('fs');
const { askClaude } = require('../lib/claude-runner');
const { DocModel } = require('../lib/doc-model');
const { checkBannedPhrases } = require('../checks/banned-phrases');
const { checkEmDashSemicolon } = require('../checks/em-dash-semicolon');

const CLAUDE_TIMEOUT_MS = 120000;
const MAX_ATTEMPTS = 2;

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

function buildPrompt(fullLine, phrase, suggestedFix, priorAttemptViolation) {
  const lines = [
    'You are fixing exactly one flagged line in a technical SDK reference doc.',
    '',
    `The line contains a banned casual/informal phrase: "${phrase}"`,
    `Suggested replacement: ${suggestedFix}`,
    '',
    'Full line as it currently appears in the file:',
    fullLine,
    '',
    'Rewrite the line so the flagged phrase is replaced with the suggested replacement',
    '(or an equally formal alternative if the suggestion does not fit the grammar).',
    'Keep every technical fact, identifier, inline code span, markdown link, and list',
    'marker exactly as they are. Do not change any other wording in the line.',
    '',
    'Hard constraints, this doc set enforces these separately from the rule above:',
    '- No em dash, en dash, or semicolon anywhere in the line. Use a period, comma,',
    '  parentheses, or a new sentence instead.',
    '- Do not introduce any other casual, marketing, or hedging phrase.',
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

/** Any dash/semicolon or banned-phrase violation on a single candidate line, or null if clean. */
function findLineViolation(candidateLine) {
  const probeDoc = { bodyStartLine: 1, totalLines: 1, lines: [candidateLine], inFenceMask: { 1: false } };
  if (checkEmDashSemicolon(probeDoc).length > 0) {
    return 'contains an em dash, en dash, or semicolon';
  }
  const phraseHits = checkBannedPhrases(probeDoc);
  if (phraseHits.length > 0) {
    return `contains a banned phrase (${phraseHits[0].message})`;
  }
  return null;
}

/** Ask the claude CLI, headless, for one rewritten line. Retries once if the reply violates a hard rule. */
function askForRewrite(fullLine, phrase, suggestedFix) {
  return askClaude({
    attempts: MAX_ATTEMPTS,
    timeoutMs: CLAUDE_TIMEOUT_MS,
    buildPrompt: (priorViolation) => buildPrompt(fullLine, phrase, suggestedFix, priorViolation),
    validate: (candidate) => {
      if (!candidate || candidate.includes('\n')) return 'the reply must be exactly one line of text';
      const ratio = candidate.length / Math.max(fullLine.length, 1);
      if (ratio < 0.4 || ratio > 1.6) {
        return 'the reply length looked wrong (too short or too long for a single-line fix)';
      }
      return findLineViolation(candidate);
    },
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: fix-banned-phrases.js <file> [--apply] [--yes] [--verify]');
    process.exit(2);
  }

  const filePath = path.resolve(args.file);
  const doc = DocModel.fromFile(filePath);

  const findings = checkBannedPhrases(doc).filter((f) => f.checkId === 'banned-phrases');
  if (findings.length === 0) {
    console.log(`No banned-phrase findings in ${args.file}.`);
    return;
  }

  console.log(
    `${findings.length} candidate(s) in ${args.file}${args.apply ? ', asking claude for rewrites' : ' (dry run, pass --apply to write and fix)'}.`
  );
  console.log('');

  const lines = doc.lines.slice();
  let changedCount = 0;

  for (const finding of findings) {
    const lineNo = finding.line;
    const originalLine = lines[lineNo - 1];
    const messageMatch = finding.message.match(/phrase "(.+?)" found\. Fix: (.+)$/);
    const phrase = messageMatch ? messageMatch[1] : null;
    const suggestedFix = messageMatch ? messageMatch[2] : null;

    console.log(`L${lineNo}: ${finding.message}`);

    if (!phrase || !suggestedFix) {
      console.log('  Skipped: could not parse finding message.');
      console.log('');
      continue;
    }

    if (!args.apply) {
      console.log('  (dry run, no rewrite requested)');
      console.log('');
      continue;
    }

    const rewritten = askForRewrite(originalLine, phrase, suggestedFix);
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
      const remaining = checkBannedPhrases(reDoc).filter((f) => f.checkId === 'banned-phrases');
      console.log(`Verification: ${remaining.length} banned-phrase finding(s) remain after fixing.`);
      for (const f of remaining) console.log(`  L${f.line}: ${f.message}`);
    }
  } else if (args.apply) {
    console.log('No lines were changed.');
  }
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

main();
