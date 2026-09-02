#!/usr/bin/env node
'use strict';

const path = require('path');
const { DocModel } = require('./lib/doc-model');
const { buildReport, renderText, makeFinding } = require('./lib/report');

const { checkFrontMatter } = require('./checks/front-matter');
const { checkSectionStructure } = require('./checks/section-structure');
const { checkBannedPhrases } = require('./checks/banned-phrases');
const { checkEmDashSemicolon } = require('./checks/em-dash-semicolon');
const { checkQaHeaders } = require('./checks/qa-headers');
const { checkTroubleshootingFormat } = require('./checks/troubleshooting-format');
const { checkNextStepsLinks } = require('./checks/next-steps-links');
const { checkQuickReferenceTable } = require('./checks/quick-reference-table');
const { checkAcronymFirstUse } = require('./checks/acronym-first-use');
const { checkMigrationSpecific } = require('./checks/migration-specific');
const { checkGettingStartedSpecific } = require('./checks/getting-started-specific');
const { checkHeuristics } = require('./checks/heuristic-flags');
const { checkSentenceConcision } = require('./checks/sentence-concision');
const { checkMetaphors } = require('./checks/metaphor-phrases');
const { checkPeriphrasis } = require('./checks/periphrasis-phrases');
const { checkPassiveVoice } = require('./checks/passive-voice');
const { checkErrorCodeFormat } = require('./checks/error-code-format');
const { checkEmbeddedQuestionPhrases } = require('./checks/embedded-question-phrases');
const { checkRetryAttemptCountBold } = require('./checks/retry-attempt-count-bold');
const { checkOrderedListSequence } = require('./checks/ordered-list-sequence');

const VALID_TYPES = [
  'conceptual-guide',
  'feature-doc',
  'how-to-guide',
  'setup-guide',
  'kickstarter',
  'migration-guide',
  'getting-started',
];

const CHECKS = [
  checkFrontMatter,
  checkSectionStructure,
  checkBannedPhrases,
  checkEmDashSemicolon,
  checkQaHeaders,
  checkTroubleshootingFormat,
  checkNextStepsLinks,
  checkQuickReferenceTable,
  checkAcronymFirstUse,
  checkMigrationSpecific,
  checkGettingStartedSpecific,
  checkHeuristics,
  checkSentenceConcision,
  checkMetaphors,
  checkPeriphrasis,
  checkPassiveVoice,
  checkErrorCodeFormat,
  checkEmbeddedQuestionPhrases,
  checkRetryAttemptCountBold,
  checkOrderedListSequence,
];

function parseArgs(argv) {
  const args = { file: null, type: null, format: 'text', tiers: [1, 2] };
  for (const arg of argv) {
    if (arg.startsWith('--type=')) {
      args.type = arg.slice('--type='.length);
    } else if (arg.startsWith('--format=')) {
      args.format = arg.slice('--format='.length);
    } else if (arg.startsWith('--tiers=')) {
      args.tiers = arg
        .slice('--tiers='.length)
        .split(',')
        .map((n) => parseInt(n.trim(), 10));
    } else if (!arg.startsWith('--')) {
      args.file = arg;
    }
  }
  return args;
}

/** Doc-type detection, mirroring ~/.claude/commands/revamp-doc.md Step 1's priority order. */
function detectDocType(doc) {
  const overviewSection = doc.findSection(['Overview']);
  const overviewText = overviewSection ? doc.sectionOwnBody(overviewSection).toLowerCase() : '';
  const titleHeading = doc.headings.find((h) => h.level === 1);
  const titleText = titleHeading ? titleHeading.text.toLowerCase() : '';
  const hasRoutingTable = Boolean(doc.findSection(['Role-Based Routing Table']));
  const hasQuickStart = Boolean(doc.findSection(['Quick Start']));

  if (titleText.startsWith('get started with') || (hasRoutingTable && hasQuickStart)) {
    return 'getting-started';
  }
  const hasMigrationStructure = Boolean(doc.findSection(['Type Mapping Reference', 'Pre-Upgrade Checklist']));
  if (/\bmigrat|upgrad/.test(titleText) || hasMigrationStructure) {
    return 'migration-guide';
  }
  if (/^(fetch|configure|add|create|delete|update|list|generate|validate|compare)\b/.test(titleText)) {
    return 'how-to-guide';
  }
  if (/\binstall|configur.*(environment|sdk|runtime)/.test(overviewText)) {
    return 'setup-guide';
  }
  if (/\bclone|starter|kickstart/.test(overviewText) || /\bclone|starter|kickstart/.test(titleText)) {
    return 'kickstarter';
  }
  if (doc.findSection(['Commands', 'Command Reference']) || /\bplugin|command\b/.test(titleText)) {
    return 'feature-doc';
  }
  return 'conceptual-guide';
}

/**
 * Lints one file and returns the report object. Split out of main() so the
 * corpus sweep and the gap probe can lint many files in one process and read
 * the findings directly, instead of shelling out per file and parsing stdout.
 * The label argument keeps the reported path as the caller wrote it, since
 * main() reports the relative path the user typed while a sweep wants its own.
 */
function lintFile(filePath, { type = null, tiers = [1, 2], label = null } = {}) {
  const doc = DocModel.fromFile(path.resolve(filePath));
  const docType = type || detectDocType(doc);

  let findings = [];
  for (const check of CHECKS) {
    // A check that throws must not take the whole run down and, more
    // importantly, must not look like a clean file. Surface it as an error, the
    // way lint-api-ref.js already does with AR-00.
    try {
      findings = findings.concat(check(doc, docType));
    } catch (err) {
      findings.push(
        makeFinding({
          tier: 1,
          ruleId: 'LD-00',
          checkId: check.name || 'unknown-check',
          line: 1,
          message: `Check "${check.name || 'anonymous'}" threw: ${err.message}`,
        })
      );
    }
  }
  findings = findings.filter((f) => tiers.includes(f.tier));

  return buildReport(label || filePath, docType, findings);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: lint-doc.js <file> [--type=doc-type] [--format=text|json] [--tiers=1,2]');
    process.exit(2);
  }

  if (args.type && !VALID_TYPES.includes(args.type)) {
    console.error(`Unknown doc type "${args.type}". Valid types: ${VALID_TYPES.join(', ')}`);
    process.exit(2);
  }

  const report = lintFile(args.file, { type: args.type, tiers: args.tiers, label: args.file });

  if (args.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderText(report));
  }

  // Set the code rather than calling process.exit(), which would tear the
  // process down before a large JSON report finishes draining to a pipe.
  process.exitCode = report.summary.errors > 0 ? 1 : 0;
}

if (require.main === module) main();

module.exports = { lintFile, detectDocType, CHECKS, VALID_TYPES };
