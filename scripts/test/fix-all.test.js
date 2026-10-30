'use strict';

/**
 * fix/fix-all.js is the script behind /fix-docs. Its promise is that a run is
 * not finished while any finding is unresolved, so these tests hold it to that:
 * the ledger lists every lint finding, judge candidate and checklist, reconcile
 * fails while one is open, a resolution that cannot be audited is rejected, and
 * reconcile passes once every item is settled. Every run here uses --no-llm, so
 * the suite never calls the claude CLI.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { validateResolution, renderNeedsInput, isApiRef } = require('../fix/fix-all');
const { byId } = require('../lib/rules-registry');
const { checkHandoff } = require('../lint/check-handoff');

const SCRIPT = path.join(__dirname, '..', 'fix', 'fix-all.js');
const FIXTURES = path.join(__dirname, 'fixtures');

function corpus(names) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-all-'));
  const docs = path.join(dir, 'docs');
  fs.mkdirSync(docs);
  for (const name of names) fs.cpSync(path.join(FIXTURES, name), path.join(docs, name), { recursive: true });
  return { docs, run: path.join(dir, 'run') };
}

function fixAll(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

const ledgerOf = (run) => JSON.parse(fs.readFileSync(path.join(run, 'ledger.json'), 'utf8'));

test('a run applies the deterministic fixers and lists everything left', () => {
  const { docs, run } = corpus(['broken-feature-doc.md', 'api-ref-broken']);
  const method = path.join(docs, 'api-ref-broken', 'Broken', 'methods', 'broken.md');
  const before = fs.readFileSync(method, 'utf8');

  const r = fixAll([docs, '--apply', '--no-llm', `--run-dir=${run}`]);
  assert.equal(r.status, 0, r.stderr);

  // The broken method page has a dash in an empty table cell, a shape fix-dashes settles without the model.
  assert.notEqual(fs.readFileSync(method, 'utf8'), before, 'fix-dashes did not rewrite the empty-cell dash');

  const ledger = ledgerOf(run);
  const kinds = new Set(ledger.items.map((i) => i.kind));
  for (const k of ['lint', 'judge', 'manual']) assert.ok(kinds.has(k), `the ledger has no ${k} items`);
  assert.ok(ledger.counts.open > 0);
  // The api-ref pages route to their own linter, so their findings carry its family.
  const apiItems = ledger.items.filter((i) => i.kind === 'lint' && isApiRef(i.file));
  assert.ok(apiItems.length > 0, 'no findings from the api-ref fixture');
  assert.ok(apiItems.every((i) => i.family === 'api-ref'));
});

test('a run without --apply edits nothing', () => {
  const { docs, run } = corpus(['broken-feature-doc.md']);
  const before = fs.readFileSync(path.join(docs, 'broken-feature-doc.md'), 'utf8');
  assert.equal(fixAll([docs, '--no-llm', `--run-dir=${run}`]).status, 0);
  assert.equal(fs.readFileSync(path.join(docs, 'broken-feature-doc.md'), 'utf8'), before);
});

test('reconcile fails while items are open and passes once every item is settled', () => {
  const { docs, run } = corpus(['clean-feature-doc.md']);
  assert.equal(fixAll([docs, '--apply', '--no-llm', `--run-dir=${run}`]).status, 0);
  assert.equal(fixAll(['--reconcile', `--run-dir=${run}`]).status, 1, 'reconcile passed with open items');

  const resolutions = ledgerOf(run).items.map((item) => {
    if (item.kind === 'manual') return { key: item.key, status: 'checked', checked: item.rules, reason: 'Read the page against each rule.' };
    if (item.kind === 'judge') return { key: item.key, status: 'compliant', reason: 'The line already does what the rule asks.' };
    const exception = (byId(item.ruleId) || {}).exception || '';
    if (item.tier === 1 && exception) {
      return { key: item.key, status: 'false-positive', reason: 'The exception covers this line.', exceptionQuoted: exception.slice(0, 20) };
    }
    if (item.tier === 1) return { key: item.key, status: 'needs-input', reason: 'No exception applies.', question: 'Should this line change?' };
    return { key: item.key, status: 'false-positive', reason: 'The flagged wording is correct here.' };
  });
  fs.writeFileSync(path.join(run, 'resolutions.json'), JSON.stringify({ resolutions }));

  const r = fixAll(['--reconcile', `--run-dir=${run}`]);
  assert.equal(r.status, 0, r.stdout);
  assert.equal(ledgerOf(run).counts.open, 0);
});

test('a resolution that cannot be audited is rejected', () => {
  const tier1 = { kind: 'lint', tier: 1, ruleId: 'C3-05' };
  assert.match(validateResolution(tier1, { status: 'false-positive', reason: 'fine' }), /exceptionQuoted/);
  assert.match(validateResolution(tier1, { status: 'false-positive' }), /reason/);
  assert.equal(validateResolution({ kind: 'lint', tier: 2, ruleId: 'C3-07' }, { status: 'false-positive', reason: 'Reads fine.' }), null);
  assert.match(validateResolution({ kind: 'judge', ruleId: 'C6-05' }, { status: 'maybe', reason: 'x' }), /not one of/);
  assert.match(validateResolution({ kind: 'judge', ruleId: 'C6-05' }, { status: 'needs-input', reason: 'x' }), /question/);
  const manual = { kind: 'manual', rules: ['B1-02', 'B1-03'] };
  assert.match(validateResolution(manual, { status: 'checked', checked: ['B1-02'], reason: 'x' }), /B1-03/);
});

test('every needs-input question links to its line', () => {
  const file = path.join(FIXTURES, 'clean-feature-doc.md');
  const out = path.join(os.tmpdir(), 'NEEDS-YOUR-INPUT.md');
  const ledger = { items: [{ status: 'needs-input', kind: 'lint', ruleId: 'C3-05', file, line: 3, resolution: { question: 'Should this sentence keep its semicolon?' } }] };
  const text = renderNeedsInput(ledger, out);
  assert.match(text, /#L3\)/);
  assert.deepEqual(checkHandoff(text), []);
});
