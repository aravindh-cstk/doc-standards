'use strict';

/**
 * Unit tests for checks/paragraph-cohesion.js (C2-09).
 *
 * The rule is about a run of paragraphs, not a single opener, so every test
 * here is really a test of the counted gates. "This grants no extra access" is
 * correct English after the behavior it summarizes, and C3-24's own exception
 * says so, which is why one of them can never produce a finding. Most of these
 * tests exist to prove the correct constructs stay silent.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { DocModel } = require('../lib/doc-model');
const {
  checkParagraphCohesion,
  sectionParagraphs,
  cohesionSignal,
  sentenceCount,
} = require('../checks/paragraph-cohesion');

function loadFixture(name) {
  return DocModel.fromFile(path.join(__dirname, 'fixtures', name));
}

/** A minimal in-memory doc, for gate cases too tight to be worth a fixture. */
function inlineDoc(...bodyLines) {
  return new DocModel('inline.md', ['# T', '', '## Overview', '', ...bodyLines].join('\n'));
}

function sectionsFlagged(doc) {
  return checkParagraphCohesion(doc).map((f) => f.section);
}

test('a wall of flat paragraphs is flagged as C2-09 tier 2', () => {
  const findings = checkParagraphCohesion(loadFixture('paragraph-cohesion-doc.md'));

  assert.ok(findings.length > 0, 'the fixture carries two violations');
  for (const f of findings) {
    assert.equal(f.ruleId, 'C2-09');
    assert.equal(f.tier, 2);
    assert.equal(f.checkId, 'paragraph-cohesion');
    assert.ok(f.falsePositiveNote, 'a tier-2 finding must say what it does not flag');
    assert.ok(f.section, 'the finding names the section a writer has to open');
  }

  const flagged = findings.map((f) => f.section);
  assert.ok(flagged.includes('Violation one, a wall of flat paragraphs'));
  assert.ok(flagged.includes('Violation two, stranded one-liner'));
});

test('the message names both repairs, because the check does not decide which applies', () => {
  const [first] = checkParagraphCohesion(loadFixture('paragraph-cohesion-doc.md'));

  assert.match(first.message, /bolded lead-in label/);
  assert.match(first.message, /connective that carries the logic/);
});

test('the fixture exemptions stay clean, so the gates are doing the work', () => {
  const flagged = sectionsFlagged(loadFixture('paragraph-cohesion-doc.md'));

  // Standalone facts already carry labels.
  assert.ok(!flagged.includes('Clean, bolded lead-ins'));
  // One argument, and most paragraphs signal how they follow the one above.
  assert.ok(!flagged.includes('Clean, connectives carry the logic'));
  // A one-liner after a code block is that block's resolution, not an orphan.
  assert.ok(!flagged.includes('Clean, a one-liner resolving a code block'));
  // One backward demonstrative is correct, and C3-24 governs it.
  assert.ok(!flagged.includes('Clean, one backward demonstrative'));
});

test('a single bare demonstrative never produces a finding', () => {
  const doc = inlineDoc(
    'Contentstack resolves your organization from the session you signed in with. A wrong organization is a sign-in problem.',
    '',
    'This holds for every catalog. A call your account cannot make in the app fails the same way through a tool.',
    '',
    'Reconnect and sign in to the organization you want. Editing the parameter has no effect on a tool call.'
  );

  assert.deepEqual(checkParagraphCohesion(doc), []);
});

test('two paragraphs are never a wall, whatever they open with', () => {
  const doc = inlineDoc(
    'This covers the first case. It applies to every stack in the organization.',
    '',
    'This covers the second case. It applies to every project in the organization.'
  );

  assert.deepEqual(checkParagraphCohesion(doc), []);
});

test('one bolded lead-in exempts the whole section', () => {
  const doc = inlineDoc(
    '**Project UIDs fail loudly.**',
    '',
    'This fails the connection. Your client then lists no tools at all.',
    '',
    'This drops the value. Contentstack uses the profile saved value instead.',
    '',
    'This has no parameter. Change the profile configuration in the app instead.'
  );

  assert.deepEqual(checkParagraphCohesion(doc), []);
});

test('a paragraph accumulator flushes on a fence, so a block never merges two paragraphs', () => {
  const doc = inlineDoc(
    'Register the stack URL with your client:',
    '',
    '```bash',
    'claude mcp add --transport http cms "https://example.invalid/api/mcp"',
    '```',
    '',
    'This skips saving a configuration, not signing in.'
  );

  const paragraphs = sectionParagraphs(doc, doc.sections.find((s) => s.level === 2));
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[1].precededByBlock, true);
});

test('a table row and a list item are structure, not paragraph text', () => {
  const doc = inlineDoc(
    'The table below lists every parameter:',
    '',
    '| Parameter | Sets |',
    '| --- | --- |',
    '| `branch` | The branch |',
    '',
    '- The first item',
    '- The second item'
  );

  const paragraphs = sectionParagraphs(doc, doc.sections.find((s) => s.level === 2));
  assert.equal(paragraphs.length, 1);
  assert.match(paragraphs[0].text, /^The table below/);
});

test('the wall gate stays quiet when most paragraphs carry a connective', () => {
  const paragraphs = [
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: false, precededByBlock: false },
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: true, precededByBlock: false },
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: true, precededByBlock: false },
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: false, precededByBlock: false },
  ];

  assert.equal(cohesionSignal(paragraphs), null);
});

test('the wall gate fires when fewer than half of the run carries a connective', () => {
  const paragraphs = [
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: false, precededByBlock: false },
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: true, precededByBlock: false },
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: false, precededByBlock: false },
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: false, precededByBlock: false },
  ];

  const result = cohesionSignal(paragraphs);
  assert.ok(result);
  assert.equal(result.wall, true);
  assert.equal(result.connectives, 1);
});

test('an opening or closing one-liner is not an orphan', () => {
  const lead = [
    { sentences: 1, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: true, precededByBlock: false },
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: true, precededByBlock: false },
    { sentences: 2, boldLeadIn: false, bareDemonstrative: false, connectiveOpener: true, precededByBlock: false },
  ];

  assert.equal(cohesionSignal(lead), null);
});

test('sentenceCount does not split on a version number or an abbreviation', () => {
  assert.equal(sentenceCount('Contentstack caps the value at 120000 ms and accepts the call.'), 1);
  assert.equal(sentenceCount('The default is 60000 ms. Raise it for a slow stack.'), 2);
});

test('a sentence opening with an identifier still counts as a sentence', () => {
  // stripNonProse blanks a code span, which hid the capital the split looks for.
  // The paragraph below then counted as one sentence and read as an orphan.
  assert.equal(sentenceCount('Importing a system profile appends a suffix. `CMS` imports as `CMS (imported)`.'), 2);
});
