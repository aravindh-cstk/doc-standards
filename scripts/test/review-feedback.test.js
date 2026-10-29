'use strict';

/**
 * Regression proof for the MCP Profile Hub review (October 2026).
 *
 * fixtures/review-feedback-before.md holds the sentences the reviewer rejected,
 * taken from the docs history and from the review itself. Every one must be
 * reported, under its own rule. fixtures/review-feedback-after.md holds the
 * accepted rewrites, and none of these rules may fire on it. If either half of
 * this file fails, a mistake the reviewer already corrected can ship again.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { DocModel } = require('../lib/doc-model');
const { lintFile } = require('../lint/lint-doc');
const { statusCodesIn } = require('../checks/error-code-format');
const { checkHeadingLength } = require('../checks/heading-length');
const { checkThirdPartyUi } = require('../checks/third-party-ui');
const { checkBareDomain } = require('../checks/bare-domain');
const { checkAnchorHeadingLevel } = require('../checks/anchor-heading-level');
const { checkTroubleshootingHubPointer } = require('../checks/troubleshooting-hub-pointer');
const { checkOverPromise } = require('../checks/over-promise');
const { checkSkimmableSentence } = require('../checks/skimmable-sentence');
const { checkBannedPhrases } = require('../checks/banned-phrases');
const { checkHandoff } = require('../lint/check-handoff');
const { generateEditorial, renderEscalation, buildEditorialPrompt } = require('../judges/judge-editorial');
const { reconcile } = require('../judges/review-candidates');
const { anchorLevelsIn } = require('../lib/markdown-links');

const BEFORE = path.join(__dirname, 'fixtures', 'review-feedback-before.md');
const AFTER = path.join(__dirname, 'fixtures', 'review-feedback-after.md');
const NEW_RULES = ['C1-07', 'C2-08', 'C2-16', 'C3-01', 'C3-11', 'C3-31', 'C3-32', 'C4-09', 'C5-07', 'C5-08', 'C5-09', 'C8-10'];

const doc = (lines) => new DocModel('inline.md', lines.join('\n'));
const findingsOf = (file) => {
  const report = lintFile(file, { type: 'feature-doc' });
  return [...report.automatedFindings, ...report.flagged];
};

// --- The fixtures ---------------------------------------------------------------

test('every rejected sentence in the before-fixture is reported under its rule', () => {
  const found = findingsOf(BEFORE);
  const has = (ruleId, tier, re) => found.some((f) => f.ruleId === ruleId && f.tier === tier && re.test(f.message));
  assert.ok(has('C3-31', 1, /This page covers/), 'F2: Overview narrates the page');
  assert.ok(has('C3-01', 1, /needs nothing else/), 'F2.2: casual phrasing');
  assert.ok(has('C3-32', 1, /organization role/), 'F3.6: retired term');
  assert.ok(has('C3-11', 1, /403/), 'F3.4: status code outside code');
  assert.ok(has('C2-08', 1, /uses a secure HTTP trigger/), 'F3.5: heading opens mid-sentence');
  assert.ok(has('C5-07', 1, /help\.openai\.com/), 'F1: link to a vendor help page');
  assert.ok(has('C5-07', 1, /Settings > Connectors/), 'F1: vendor menu path');
  assert.ok(has('C4-09', 2, /Add custom connector/), 'F1: vendor button label');
  assert.ok(has('C4-09', 2, /ChatGPT Plus/), 'F1: vendor plan name');
  assert.ok(has('C8-10', 2, /no setup required/), 'F2.1: over-promise');
  assert.ok(has('C2-16', 2, /44 words/), 'F3.1: 44-word Limitations sentence');
  assert.ok(has('C2-16', 2, /chaining/), 'F3.1: chained Root Cause sentence');
  assert.ok(has('C5-08', 1, /H4/), 'E1: link to an H4 heading');
  assert.ok(has('C5-09', 1, /claude\.ai/), 'E2: bare domain');
  assert.ok(has('C1-07', 1, /troubleshooting/), 'E3: entries kept on a page under a hub');
});

test('the accepted rewrites in the after-fixture pass every new rule', () => {
  const found = findingsOf(AFTER).filter((f) => NEW_RULES.includes(f.ruleId));
  assert.deepEqual(found.map((f) => `${f.ruleId} L${f.line}: ${f.message}`), []);
});

// --- C3-11 status codes ------------------------------------------------------------

test('C3-11 reports a status code and leaves counts alone', () => {
  assert.deepEqual(statusCodesIn('Contentstack returned 403.'), ['403']);
  assert.deepEqual(statusCodesIn('Requests return 404 / 401 errors.'), ['404', '401']);
  assert.deepEqual(statusCodesIn('The call fails with a 401 error.'), ['401']);
  assert.deepEqual(statusCodesIn('The server answers 403 Forbidden.'), ['403']);
  assert.deepEqual(statusCodesIn('A profile can hold up to 200 tools.'), []);
  assert.deepEqual(statusCodesIn('Organization profile limit of 500 reached.'), []);
  assert.deepEqual(statusCodesIn('The view loads 100 executions at a time.'), []);
  assert.deepEqual(statusCodesIn('Contentstack returned `403`.'), []);
  assert.deepEqual(statusCodesIn('Pin version 0.2.5 and port 3000.'), []);
});

// --- C2-08 headings ----------------------------------------------------------------

test('C2-08 catches a lowercase fragment and a conjunction opener, and leaves identifiers alone', () => {
  const f = checkHeadingLength(doc(['# T', '', '## uses a secure HTTP trigger', '', '## Because the URL changes', '', '## authorization_required error with reason no_token', '', '## mcp-remote fails to start', '', '## Before you begin']))
    .filter((x) => x.ruleId === 'C2-08');
  assert.deepEqual(f.map((x) => x.line), [3, 5]);
  assert.ok(f.every((x) => x.tier === 1 && /complete symptom/.test(x.message)));
});

// --- C5-07 and C4-09 third-party UI -------------------------------------------------

test('C5-07 and C4-09 report vendor UI, and leave Contentstack tabs and stable references alone', () => {
  const f = checkThirdPartyUi(doc([
    '# T', '', '## Claude Desktop', '',
    'Use the **Claude Desktop Manual** installation tab instead.',
    'Install Node.js from [nodejs.org](https://nodejs.org/en/download).',
    'Read the [MCP specification](https://modelcontextprotocol.io/).',
    '', '## Cursor', '',
    'Open **Settings** > **MCP** and add the server.',
    'Choose **Add new server**.',
    'Your Cursor Pro plan can limit this.',
    'Add a custom connector in the client\'s settings.',
  ]));
  assert.deepEqual(f.map((x) => `${x.ruleId}:${x.line}`), ['C5-07:11', 'C4-09:12', 'C4-09:13']);
});

test('C5-07 reports a vendor help link anywhere, with no vendor name nearby', () => {
  const f = checkThirdPartyUi(doc(['# T', '', 'See [connector setup](https://help.openai.com/en/articles/123).']));
  assert.equal(f.length, 1);
  assert.equal(f[0].tier, 1);
});

// --- C5-09 bare domains -------------------------------------------------------------

test('C5-09 reports a bare domain and leaves code, links, emails and file names alone', () => {
  const f = checkBareDomain(doc([
    '# T', '',
    'Sign in at claude.ai first.',
    'Sign in at `claude.ai` first.',
    'Open [claude.ai](https://claude.ai) first.',
    'Email support@contentstack.com for help.',
    'Install Node.js and edit package.json or README.md.',
    'Visit https://www.contentstack.com/docs for more.',
  ]));
  assert.deepEqual(f.map((x) => x.line), [3]);
});

// --- C5-08 anchor levels ------------------------------------------------------------

test('C5-08 reports a link to an H4 and passes a link to an H3', () => {
  const f = checkAnchorHeadingLevel(doc([
    '# T', '', 'See [one](#entry-three) and [two](#entry-four).', '',
    '## Section', '', '### Entry three', '', '#### Entry four',
  ]));
  assert.deepEqual(f.map((x) => x.line), [3]);
  assert.match(f[0].message, /H4/);
});

test('anchorLevelsIn gives check-links the heading level behind each anchor', () => {
  const file = path.join(os.tmpdir(), `anchor-levels-${process.pid}.md`);
  fs.writeFileSync(file, '# Title\n\n## Section\n\n#### Deep entry\n\n```\n## not a heading\n```\n');
  const levels = anchorLevelsIn(file);
  fs.unlinkSync(file);
  assert.equal(levels.get('section'), 2);
  assert.equal(levels.get('deep-entry'), 4);
  assert.equal(levels.has('not-a-heading'), false);
});

// --- C1-07 troubleshooting hubs --------------------------------------------------------

test('C1-07 passes a pointer, and skips pages outside a hub scope and the hub itself', () => {
  const pointer = ['---', 'url: /developers/mcp-profile-hub-manage-profiles', '---', '# T', '', '## Troubleshooting', '',
    '> **Additional Resource:** For more information on import errors, refer to the [Profile Hub Import](/contentstack-mcp-troubleshooting/faqs#profile-hub-import) section of the Contentstack MCP Troubleshooting Guides documentation.'];
  assert.equal(checkTroubleshootingHubPointer(doc(pointer)).length, 0);
  const outside = ['---', 'url: /headless-cms/entries', '---', '# T', '', '## Troubleshooting', '', '### Something fails'];
  assert.equal(checkTroubleshootingHubPointer(doc(outside)).length, 0);
  const hub = ['---', 'url: /contentstack-mcp-troubleshooting/faqs', '---', '# T', '', '## Troubleshooting', '', '### Something fails'];
  assert.equal(checkTroubleshootingHubPointer(doc(hub)).length, 0);
});

// --- C8-10, C2-16, C3-31, C3-32 -------------------------------------------------------

test('C8-10 reports an absolute and leaves a negated guarantee alone', () => {
  const f = checkOverPromise(doc(['# T', '', 'It works with any MCP client.', 'Contentstack does not guarantee the order of results.']));
  assert.deepEqual(f.map((x) => x.line), [3]);
});

test('C2-16 leaves a short sentence alone', () => {
  assert.equal(checkSkimmableSentence(doc(['# T', '', 'The view loads 50 executions at a time, and filters apply only to loaded rows.'])).length, 0);
});

test('C3-31 and C3-32 leave the current terms alone', () => {
  const f = checkBannedPhrases(doc(['# T', '', 'Assign organization-level product roles in Administration.', 'Duplicate a profile to copy it.']))
    .filter((x) => ['C3-31', 'C3-32'].includes(x.ruleId));
  assert.equal(f.length, 0);
});

// --- F0: the hand-back ------------------------------------------------------------------

test('check-handoff fails the original hand-back, which asked questions without line links', () => {
  const original = [
    '## What needs you', '',
    '1. **OpenAI link:** the ChatGPT section says "check OpenAI\'s current connector documentation" with no link. Send me the URL and I\'ll add it.',
    '2. **"No app needed" fact:** please confirm with the developer before this ships.',
  ].join('\n');
  assert.equal(checkHandoff(original).length, 2);
  const fixed = [
    '## What needs you', '',
    '1. **OpenAI link:** [connect-a-client-to-profile-hub.md:147](profile-hub/connect-a-client-to-profile-hub.md#L147). Send me the URL?',
    '2. **"No app needed" fact:** [mcp-url-parameters.md:82](profile-hub/mcp-url-parameters.md#L82). Please confirm with the developer.',
  ].join('\n');
  assert.equal(checkHandoff(fixed).length, 0);
});

// --- The editorial judge ------------------------------------------------------------------

test('judge-editorial collects the fuzzy cases with the reviewer examples attached', () => {
  const result = generateEditorial([BEFORE]);
  const rules = new Set(result.candidates.map((c) => c.ruleId));
  for (const r of ['C2-16', 'C3-33', 'C4-09', 'C8-10']) assert.ok(rules.has(r), `no ${r} candidate`);
  const skim = result.candidates.find((c) => c.ruleId === 'C2-16');
  assert.ok(skim.examples.length >= 2 && skim.focus);
  const prompt = buildEditorialPrompt(skim);
  assert.match(prompt, /Worked example 1/);
  assert.ok(prompt.indexOf('Worked example 1') < prompt.indexOf('Reply with ONLY'));
});

test('judge-editorial refuses an unjudged review and escalates open questions with line links', () => {
  const candidatesDoc = generateEditorial([BEFORE]);
  assert.ok(reconcile(candidatesDoc, { verdicts: [] }).problems.length > 0);
  const verdicts = candidatesDoc.candidates.map((c, i) => ({
    candidateId: c.candidateId,
    verdict: i === 0 ? 'UNCLEAR' : 'COMPLIANT',
    reason: i === 0 ? 'Needs the developer to confirm the behavior.' : 'Checked against the source.',
  }));
  assert.deepEqual(reconcile(candidatesDoc, { verdicts }).problems, []);
  const out = path.join(path.dirname(BEFORE), 'NEEDS-YOUR-INPUT.md');
  const { text, count } = renderEscalation(candidatesDoc, { verdicts }, out);
  assert.equal(count, 1);
  assert.match(text, /\(review-feedback-before\.md#L\d+\)/);
  assert.deepEqual(checkHandoff(text), []);
});
