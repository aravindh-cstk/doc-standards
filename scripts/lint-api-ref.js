#!/usr/bin/env node
'use strict';

// Lints API reference pages (class_reference.md and methods/*.md).
//
// Why this exists rather than a flag on lint-doc.js: lint-doc.js resolves a doc
// type from VALID_TYPES and drives section-structure.js off section-order.json,
// both of which assume a prose doc with an H1 title and H2 sections. An api-ref
// method page has neither, so detectDocType falls through to conceptual-guide
// and the run fills with findings for a missing Overview, missing Prerequisites,
// and missing title/description/url front matter. None of that applies here.
//
// So this runner keeps the content checks, which are doc-type agnostic, drops
// the four that need a doc type, and adds the AR-01..AR-10 structural checks.
//
// Usage:
//   node scripts/lint-api-ref.js <file-or-dir> [--format=text|json] [--tiers=1,2]
//                                 [--baseline=<canonical doc-set root>]
//
//   <file-or-dir>  a single .md file, or a directory scanned recursively for
//                  usage_guide.md, class_reference.md and methods/*.md
//   --format       text (default) or json
//   --tiers        comma-separated tiers to report, default 1,2
//   --baseline     canonical doc-set root. Links that do not resolve inside a
//                  partial review folder are resolved against this tree before
//                  being reported as dead.
//
// Exit codes: 0 clean, 1 at least one tier-1 finding, 2 usage error.

const fs = require('fs');
const path = require('path');

const { DocModel } = require('./lib/doc-model');
const registry = require('./lib/rules-registry');

const { checkBannedPhrases } = require('./checks/banned-phrases');
const { checkEmDashSemicolon } = require('./checks/em-dash-semicolon');
const { checkQaHeaders } = require('./checks/qa-headers');
const { checkAcronymFirstUse } = require('./checks/acronym-first-use');
const { checkSentenceConcision } = require('./checks/sentence-concision');
const { checkMetaphors } = require('./checks/metaphor-phrases');
const { checkPeriphrasis } = require('./checks/periphrasis-phrases');
const { checkPassiveVoice } = require('./checks/passive-voice');
const { checkErrorCodeFormat } = require('./checks/error-code-format');
const { checkEmbeddedQuestionPhrases } = require('./checks/embedded-question-phrases');
const { checkRetryAttemptCountBold } = require('./checks/retry-attempt-count-bold');
const {
  checkApiRefStructure,
  checkIndexCompleteness,
  checkClassOverviewCompleteness,
  isClassPage,
  isUsageGuidePage,
} = require('./checks/api-ref-structure');

// Deliberately excluded, all four need a doc type this linter does not have:
// front-matter (wants title/description/url), section-structure (wants an H2
// section order), migration-specific and getting-started-specific (no-ops).
// Also excluded: next-steps-links, quick-reference-table and
// troubleshooting-format, which look for prose sections an api-ref page has no
// reason to carry, and heuristic-flags, whose try/catch and section-length
// heuristics are tuned for guides and misfire on reference fragments.
const CONTENT_CHECKS = [
  checkBannedPhrases,
  checkEmDashSemicolon,
  checkQaHeaders,
  checkAcronymFirstUse,
  checkSentenceConcision,
  checkMetaphors,
  checkPeriphrasis,
  checkPassiveVoice,
  checkErrorCodeFormat,
  checkEmbeddedQuestionPhrases,
  checkRetryAttemptCountBold,
];

function parseArgs(argv) {
  const args = { target: null, format: 'text', tiers: [1, 2] };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--format=')) args.format = a.slice('--format='.length);
    else if (a.startsWith('--baseline=')) {
      process.env.API_REF_BASELINE = a.slice('--baseline='.length);
    } else if (a.startsWith('--tiers=')) {
      args.tiers = a.slice('--tiers='.length).split(',').map((t) => Number(t.trim())).filter(Boolean);
    } else if (!a.startsWith('--')) args.target = a;
  }
  return args;
}

/**
 * Every api-ref page under a directory, ordered the way the CMS renders the
 * reference chain: the usage guide, then class pages, then their methods.
 */
function pageRank(filePath) {
  if (isUsageGuidePage(filePath)) return 0;
  if (isClassPage(filePath)) return 1;
  return 2;
}

function collectFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (isUsageGuidePage(entry.name)) out.push(full);
      else if (entry.name === 'class_reference.md') out.push(full);
      else if (entry.name.endsWith('.md') && path.basename(dir) === 'methods') out.push(full);
    }
  })(target);
  return out.sort((a, b) => {
    const ra = pageRank(a);
    const rb = pageRank(b);
    // The usage guide sits above the class folders, so it sorts before them
    // rather than alongside them by directory name.
    if (ra === 0 || rb === 0) return ra - rb || a.localeCompare(b);
    return path.dirname(a).localeCompare(path.dirname(b)) || ra - rb || a.localeCompare(b);
  });
}

function lintFile(filePath, tiers) {
  const doc = DocModel.fromFile(filePath);
  let findings = [];
  for (const check of CONTENT_CHECKS) {
    try {
      findings = findings.concat(check(doc, 'api-ref') || []);
    } catch (err) {
      findings.push({
        tier: 1, ruleId: 'AR-00', checkId: check.name,
        message: `Check ${check.name} threw: ${err.message}`, line: 1,
      });
    }
  }
  findings = findings.concat(checkApiRefStructure(doc));
  if (isClassPage(filePath)) findings = findings.concat(checkIndexCompleteness(doc));
  if (isUsageGuidePage(filePath)) findings = findings.concat(checkClassOverviewCompleteness(doc));
  return findings
    .filter((f) => tiers.includes(f.tier))
    .sort((a, b) => a.tier - b.tier || (a.line || 0) - (b.line || 0));
}

function ruleText(ruleId) {
  const rule = registry.byId ? registry.byId(ruleId) : null;
  return rule && rule.rule ? rule.rule : null;
}

function renderText(results, root) {
  const lines = [];
  let errors = 0;
  let flagged = 0;
  const clean = [];

  for (const { filePath, findings } of results) {
    const rel = path.relative(root, filePath) || path.basename(filePath);
    if (!findings.length) { clean.push(rel); continue; }
    lines.push('');
    lines.push(rel);
    lines.push('-'.repeat(rel.length));
    for (const f of findings) {
      const label = f.tier === 1 ? 'ERROR  ' : 'FLAGGED';
      lines.push(`  ${label} ${f.ruleId.padEnd(7)} line ${String(f.line || '?').padStart(4)}  ${f.message}`);
      if (f.falsePositiveNote) lines.push(`          note: ${f.falsePositiveNote}`);
      if (f.tier === 1) errors++; else flagged++;
    }
  }

  const header = [];
  header.push('api-ref lint report');
  header.push('===================');
  header.push(`files: ${results.length}   clean: ${clean.length}   errors: ${errors}   flagged: ${flagged}`);

  const byRule = new Map();
  for (const { findings } of results) {
    for (const f of findings) byRule.set(f.ruleId, (byRule.get(f.ruleId) || 0) + 1);
  }
  if (byRule.size) {
    header.push('');
    header.push('by rule:');
    for (const [id, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
      const text = ruleText(id);
      header.push(`  ${id.padEnd(7)} ${String(n).padStart(3)}  ${text ? text.slice(0, 96) : ''}`);
    }
  }

  const footer = [];
  if (clean.length) {
    footer.push('');
    footer.push(`clean (${clean.length}): ${clean.join(', ')}`);
  }
  return [...header, ...lines, ...footer].join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.target) {
    console.error('Usage: lint-api-ref.js <file-or-dir> [--format=text|json] [--tiers=1,2] [--baseline=<root>]');
    process.exit(2);
  }
  if (!fs.existsSync(args.target)) {
    console.error(`Not found: ${args.target}`);
    process.exit(2);
  }

  const files = collectFiles(args.target);
  if (!files.length) {
    console.error(`No api-ref pages found under ${args.target}. Expected usage_guide.md, class_reference.md or methods/*.md.`);
    process.exit(2);
  }

  const results = files.map((filePath) => ({ filePath, findings: lintFile(filePath, args.tiers) }));
  const errors = results.reduce((n, r) => n + r.findings.filter((f) => f.tier === 1).length, 0);

  const root = fs.statSync(args.target).isFile() ? path.dirname(args.target) : args.target;
  if (args.format === 'json') {
    console.log(JSON.stringify({
      target: args.target,
      summary: {
        files: results.length,
        errors,
        flagged: results.reduce((n, r) => n + r.findings.filter((f) => f.tier === 2).length, 0),
      },
      results: results.map((r) => ({ file: path.relative(root, r.filePath), findings: r.findings })),
    }, null, 2));
  } else {
    console.log(renderText(results, root));
  }
  process.exit(errors > 0 ? 1 : 0);
}

if (require.main === module) main();

module.exports = { lintFile, collectFiles, CONTENT_CHECKS };
