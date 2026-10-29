'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  collectLinkLabelCandidates,
  structurallyBroken,
  titlesOf,
  headingForFragment,
  OPAQUE_LABELS,
} = require('../checks/link-label-fidelity');
const { linksIn } = require('../lib/markdown-links');

/** A throwaway directory holding the files a test needs to resolve against. */
function withFiles(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-label-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), body);
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- Structurally broken labels ---------------------------------------------

/**
 * This is the shape PR #86 restored 20 of by hand, after a punctuation pass
 * moved a closing bracket across a label boundary. It needs no judgment.
 */
test('an unclosed backtick in a label is broken', () => {
  assert.match(structurallyBroken('`build-repeating-section'), /unclosed backtick/);
});

test('unbalanced brackets in a label are broken', () => {
  assert.match(structurallyBroken('[fragment'), /"\["/);
});

test('an empty label is broken', () => {
  assert.equal(structurallyBroken('   '), 'the label is empty');
});

test('a punctuation-only label is broken', () => {
  assert.equal(structurallyBroken(', '), 'the label is punctuation only');
  assert.equal(structurallyBroken(',,'), 'the label is punctuation only');
});

test('an ordinary label is not broken', () => {
  assert.equal(structurallyBroken('Component shape rules'), null);
  assert.equal(structurallyBroken('`register-component`'), null);
});

// --- The rawLabel fix -------------------------------------------------------

/**
 * check-links blanks code spans before extracting, so a label written in
 * backticks reaches this check as a run of spaces. Reading it from `label`
 * rather than `rawLabel` reported 1,497 empty labels on this corpus, none of
 * which existed.
 */
test('a backticked label reaches the check with its bytes intact', () => {
  withFiles(
    {
      'a.md': '# A\n\n- [`design-component-library`](b.md): does a thing\n',
      'b.md': '# Design component library\n',
    },
    (dir) => {
      const link = linksIn(path.join(dir, 'a.md'))[0];
      assert.equal(link.rawLabel, '`design-component-library`');
      assert.equal(link.label.trim(), '', 'the blanked label is what check-links needs, and is not a label');

      const { findings } = collectLinkLabelCandidates(path.join(dir, 'a.md'));
      assert.equal(findings.length, 0, 'a backticked label is not an empty label');
    }
  );
});

// --- Opaque labels ----------------------------------------------------------

test('"click here" is reported directly, without a judge', () => {
  withFiles({ 'a.md': '# A\n\nSee [click here](b.md).\n', 'b.md': '# B page\n' }, (dir) => {
    const { findings } = collectLinkLabelCandidates(path.join(dir, 'a.md'));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleId, 'C2-14');
    assert.match(findings[0].message, /act of following the link/);
  });
});

/**
 * The first draft of OPAQUE_LABELS held "reference", "docs" and "details", and
 * produced 15 findings on this corpus of which every one was wrong. A product
 * noun mid-sentence takes its subject from the sentence.
 */
test('a product noun used mid-sentence is not an opaque label', () => {
  withFiles(
    {
      'a.md': '# A\n\nA multi-type [Reference](b.md) field pointing at several types.\n',
      'b.md': '# Rendering reference fields\n',
    },
    (dir) => {
      const { findings } = collectLinkLabelCandidates(path.join(dir, 'a.md'));
      assert.equal(findings.length, 0);
    }
  );
});

test('the opaque set holds no ordinary noun', () => {
  for (const word of ['reference', 'docs', 'documentation', 'details', 'guide', 'overview']) {
    assert.ok(!OPAQUE_LABELS.has(word), `"${word}" is an ordinary noun and must not be reported directly`);
  }
});

// --- Overlap, and the three chances a label gets -----------------------------

test('a label sharing a word with the H1 is not a candidate', () => {
  withFiles({ 'a.md': '# A\n\n[Slot props](b.md)\n', 'b.md': '# Slot props reference\n' }, (dir) => {
    assert.equal(collectLinkLabelCandidates(path.join(dir, 'a.md')).candidates.length, 0);
  });
});

/**
 * Many labels name the concept while the H1 names the shape, and the slug
 * carries the concept. Without the filename as a third chance, every one of
 * those becomes a question the judge has to clear.
 */
test('a label sharing a word with the filename is not a candidate', () => {
  withFiles({ 'a.md': '# A\n\n[Slot props](slot-props.md)\n', 'slot-props.md': '# Data-carrying slots\n' }, (dir) => {
    assert.equal(collectLinkLabelCandidates(path.join(dir, 'a.md')).candidates.length, 0);
  });
});

test('a label sharing a word with the front-matter title is not a candidate', () => {
  withFiles(
    {
      'a.md': '# A\n\n[Canvas](b.md)\n',
      'b.md': '---\nseo_title: Canvas configuration | Contentstack\n---\n\n# Setting the base URL\n',
    },
    (dir) => {
      assert.equal(collectLinkLabelCandidates(path.join(dir, 'a.md')).candidates.length, 0);
    }
  );
});

test('a label sharing nothing with its destination is a candidate', () => {
  withFiles({ 'a.md': '# A\n\n[Repeaters](b.md)\n', 'b.md': '# Publishing a component library\n' }, (dir) => {
    const { candidates } = collectLinkLabelCandidates(path.join(dir, 'a.md'));
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].ruleId, 'C2-14');
    assert.equal(candidates[0].destination, 'Publishing a component library');
    assert.ok(candidates[0].decide.includes('VIOLATION'));
  });
});

// --- Fragments --------------------------------------------------------------

test('a fragment is compared against the heading it resolves to', () => {
  withFiles({ 'b.md': '# B\n\n## The nearest slot wins\n' }, (dir) => {
    assert.equal(headingForFragment(path.join(dir, 'b.md'), 'the-nearest-slot-wins'), 'The nearest slot wins');
  });
});

test('an unresolvable fragment falls back to the page title', () => {
  withFiles({ 'b.md': '# B page\n' }, (dir) => {
    assert.equal(headingForFragment(path.join(dir, 'b.md'), 'no-such-heading'), null);
    assert.deepEqual(titlesOf(path.join(dir, 'b.md')), ['B page']);
  });
});

// --- Out of scope -----------------------------------------------------------

test('an external link is not compared, because that needs the network', () => {
  withFiles({ 'a.md': '# A\n\n[Repeaters](https://example.com/publishing)\n' }, (dir) => {
    const r = collectLinkLabelCandidates(path.join(dir, 'a.md'));
    assert.equal(r.candidates.length, 0);
  });
});

test('an image is not a link label', () => {
  withFiles({ 'a.md': '# A\n\n![Some alt text](img.png)\n' }, (dir) => {
    const r = collectLinkLabelCandidates(path.join(dir, 'a.md'));
    assert.equal(r.findings.length, 0);
    assert.equal(r.candidates.length, 0);
  });
});

test('a link to a file outside the corpus is skipped when a corpus is given', () => {
  withFiles({ 'a.md': '# A\n\n[Repeaters](b.md)\n', 'b.md': '# Publishing\n' }, (dir) => {
    const corpus = new Set([path.resolve(dir, 'a.md')]);
    assert.equal(collectLinkLabelCandidates(path.join(dir, 'a.md'), { corpus }).candidates.length, 0);
  });
});
