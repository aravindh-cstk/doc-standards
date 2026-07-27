#!/usr/bin/env node
'use strict';

const path = require('path');
const { DocModel } = require('./lib/doc-model');
const { buildReport, renderText } = require('./lib/report');

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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: lint-doc.js <file> [--type=doc-type] [--format=text|json] [--tiers=1,2]');
    process.exit(2);
  }

  const filePath = path.resolve(args.file);
  const doc = DocModel.fromFile(filePath);

  const docType = args.type || detectDocType(doc);
  if (!VALID_TYPES.includes(docType)) {
    console.error(`Unknown doc type "${docType}". Valid types: ${VALID_TYPES.join(', ')}`);
    process.exit(2);
  }

  let findings = [];
  for (const check of CHECKS) {
    findings = findings.concat(check(doc, docType));
  }
  findings = findings.filter((f) => args.tiers.includes(f.tier));

  const report = buildReport(args.file, docType, findings);

  if (args.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderText(report));
  }

  process.exit(report.summary.errors > 0 ? 1 : 0);
}

main();
