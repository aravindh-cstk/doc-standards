#!/usr/bin/env node
'use strict';

/**
 * Corpus sweep: lints every prose doc under one or more targets and aggregates
 * the findings by rule.
 *
 * lint-doc.js answers "is this file clean". The question that drives a rule
 * change is different: "how often does this fire, and where else". Answering it
 * one file at a time hides the ranking, and the ranking is the whole point,
 * since it says which single wordlist entry or widened pattern buys the most.
 *
 * Not merged into lint-doc.js because that script is a one-file contract with a
 * documented CLI, a per-file report shape, and an exit code other tooling reads.
 */

const fs = require('fs');
const path = require('path');
const { lintFile } = require('./lint-doc');
const { byId } = require('../lib/rules-registry');

// Directories that never hold reviewable prose. Walking them wastes time and,
// worse, would report findings against vendored or generated markdown.
const SKIP_DIRS = new Set(['node_modules', 'images', 'img', 'assets']);

/**
 * Recursively collects markdown files under a target.
 *
 * Deliberately not lint-api-ref.js's collectFiles: that one filters to
 * class_reference.md plus methods/*.md and sorts class pages ahead of their
 * methods, which is API-reference page semantics. A prose corpus wants every
 * .md in plain path order so two runs diff cleanly.
 */
function collectDocs(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];

  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.name.endsWith('.md')) {
        out.push(full);
      }
    }
  })(target);
  return out.sort();
}

/**
 * Inverts the per-file reports into a by-rule index. Each entry carries the
 * registry text alongside the hits so a reader does not have to look the rule
 * up separately to judge whether the hits are real.
 */
function rollUpByRule(fileReports) {
  const byRule = {};
  for (const report of fileReports) {
    for (const finding of [...report.automatedFindings, ...report.flagged]) {
      if (!byRule[finding.ruleId]) {
        const rule = byId(finding.ruleId);
        byRule[finding.ruleId] = {
          count: 0,
          tier: finding.tier,
          checkId: finding.checkId,
          rule: rule ? rule.rule : '(not in registry)',
          hits: [],
        };
      }
      byRule[finding.ruleId].count += 1;
      byRule[finding.ruleId].hits.push({
        file: report.file,
        line: finding.line,
        message: finding.message,
      });
    }
  }
  return byRule;
}

function sweep(targets, { type = null, tiers = [1, 2] } = {}) {
  const files = targets.flatMap((t) => collectDocs(t));
  const fileReports = files.map((file) => lintFile(file, { type, tiers, label: file }));

  const errors = fileReports.reduce((n, r) => n + r.summary.errors, 0);
  const warnings = fileReports.reduce((n, r) => n + r.summary.warnings, 0);

  return {
    generatedAt: new Date().toISOString(),
    corpus: targets,
    files: fileReports,
    byRule: rollUpByRule(fileReports),
    summary: {
      files: fileReports.length,
      clean: fileReports.filter((r) => r.summary.errors + r.summary.warnings === 0).length,
      errors,
      warnings,
    },
  };
}

function renderText(result) {
  const lines = [];
  const s = result.summary;
  lines.push(`Doc-standards sweep: ${result.corpus.join(', ')}`);
  lines.push(`Files: ${s.files}   Clean: ${s.clean}   Errors: ${s.errors}   Flagged: ${s.warnings}`);
  lines.push('');

  const ranked = Object.entries(result.byRule).sort((a, b) => b[1].count - a[1].count);
  if (ranked.length === 0) {
    lines.push('No findings.');
    return lines.join('\n');
  }

  lines.push('By rule (most frequent first)');
  lines.push('-'.repeat(60));
  for (const [ruleId, entry] of ranked) {
    lines.push(`${ruleId}  x${entry.count}  [tier ${entry.tier}] ${entry.checkId}`);
    lines.push(`  ${entry.rule}`);
    for (const hit of entry.hits) {
      lines.push(`    ${hit.file}:${hit.line}  ${hit.message.slice(0, 110)}`);
    }
    lines.push('');
  }

  const clean = result.files.filter((r) => r.summary.errors + r.summary.warnings === 0);
  if (clean.length) {
    lines.push(`clean (${clean.length}): ${clean.map((r) => path.basename(r.file)).join(', ')}`);
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = { targets: [], type: null, format: 'text', tiers: [1, 2], out: null };
  for (const arg of argv) {
    if (arg.startsWith('--type=')) args.type = arg.slice(7);
    else if (arg.startsWith('--format=')) args.format = arg.slice(9);
    else if (arg.startsWith('--out=')) args.out = arg.slice(6);
    else if (arg.startsWith('--tiers=')) {
      args.tiers = arg.slice(8).split(',').map((n) => parseInt(n.trim(), 10));
    } else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.targets.length === 0) {
    console.error('Usage: sweep-docs.js <dir-or-file>... [--type=] [--tiers=1,2] [--format=text|json] [--out=path]');
    process.exit(2);
  }

  const result = sweep(args.targets, { type: args.type, tiers: args.tiers });
  const rendered = args.format === 'json' ? JSON.stringify(result, null, 2) : renderText(result);

  if (args.out) {
    fs.writeFileSync(args.out, `${rendered}\n`);
    console.log(`Wrote ${args.out}`);
  } else {
    console.log(rendered);
  }

  // Set the code rather than calling process.exit(). process.exit() tears the
  // process down before an async stdout write drains, which silently truncates
  // a large JSON report at the pipe buffer boundary.
  process.exitCode = result.summary.errors > 0 ? 1 : 0;
}

if (require.main === module) main();

module.exports = { sweep, collectDocs, rollUpByRule };
