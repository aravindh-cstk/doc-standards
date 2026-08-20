#!/usr/bin/env node
'use strict';

/**
 * Batch metaphor scan across a directory of markdown docs.
 *
 * lint-doc.js only takes one file and prints to the console. This script walks
 * a whole directory tree, runs the tier-2 metaphor check (checks/metaphor-phrases.js)
 * on every .md file, and writes one aggregated document (markdown by default,
 * or JSON) so a reviewer can read every hit in one place instead of running
 * lint-doc.js file by file.
 *
 * Usage:
 *   node scan-metaphors-report.js [directory] [--out=<path>] [--format=md|json]
 *
 * Defaults: directory = ../python-delivery-pr-217/Taxonomy/methods (relative to
 * this script), --out=metaphor-scan-report.md, --format=md.
 */

const fs = require('fs');
const path = require('path');
const { DocModel } = require('./lib/doc-model');
const { checkMetaphors } = require('./checks/metaphor-phrases');

const DEFAULT_DIR = path.join(__dirname, '..', '..', 'python-delivery-pr-217', 'Taxonomy', 'methods');
const DEFAULT_OUT = 'metaphor-scan-report.md';

function parseArgs(argv) {
  const args = { dir: null, out: DEFAULT_OUT, format: 'md' };
  for (const arg of argv) {
    if (arg.startsWith('--out=')) {
      args.out = arg.slice('--out='.length);
    } else if (arg.startsWith('--format=')) {
      args.format = arg.slice('--format='.length);
    } else if (!arg.startsWith('--')) {
      args.dir = arg;
    }
  }
  if (!args.dir) args.dir = DEFAULT_DIR;
  return args;
}

/** Every .md file under dir, recursive, sorted for stable report ordering. */
function findMarkdownFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results.sort();
}

function scan(dir) {
  const files = findMarkdownFiles(dir);
  const perFile = [];
  for (const file of files) {
    const doc = DocModel.fromFile(file);
    const findings = checkMetaphors(doc);
    if (findings.length > 0) {
      perFile.push({
        file: path.relative(dir, file),
        findings: findings.map((f) => ({
          line: f.line,
          quote: doc.lines[f.line - 1].trim(),
          message: f.message,
        })),
      });
    }
  }
  return { dir, filesScanned: files.length, filesWithFindings: perFile.length, perFile };
}

function renderMarkdown(result) {
  const totalFindings = result.perFile.reduce((sum, f) => sum + f.findings.length, 0);
  const lines = [];
  lines.push('# Metaphor Scan Report');
  lines.push('');
  lines.push(`Directory: \`${result.dir}\``);
  lines.push('');
  lines.push(
    `Files scanned: ${result.filesScanned}. Files with findings: ${result.filesWithFindings}. Total findings: ${totalFindings}.`
  );
  lines.push('');

  if (result.perFile.length === 0) {
    lines.push('No figurative-language findings in this directory.');
    return lines.join('\n') + '\n';
  }

  for (const entry of result.perFile) {
    lines.push(`## ${entry.file}`);
    lines.push('');
    lines.push('| Line | Quoted text | Note |');
    lines.push('| --- | --- | --- |');
    for (const f of entry.findings) {
      const quote = f.quote.replace(/\|/g, '\\|');
      const note = f.message.replace(/\|/g, '\\|');
      lines.push(`| ${f.line} | ${quote} | ${note} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dirPath = path.resolve(args.dir);
  const result = scan(dirPath);

  const output = args.format === 'json' ? JSON.stringify(result, null, 2) : renderMarkdown(result);

  fs.writeFileSync(args.out, output);
  console.log(`Scanned ${result.filesScanned} file(s), ${result.filesWithFindings} with findings. Report written to ${args.out}.`);
}

main();
