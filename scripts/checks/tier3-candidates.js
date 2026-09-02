'use strict';

/**
 * Candidate extraction for the 25 tier-3 rules.
 *
 * Tier 3 means the judgment needs reading comprehension: whether a heading
 * names what its section contains, whether a list groups like with like. A
 * script cannot decide any of that. What a script can do, and what this module
 * does, is narrow *where to look*, which is most of the labour. Without it the
 * only tier-3 tooling is lib/report.js printing the same 20-rule checklist
 * under every document it has never read.
 *
 * These are candidates, never findings. They do not enter lint-doc.js's CHECKS
 * array and they never affect an exit code, because a candidate is a question,
 * and a lint failure has to be an answer.
 *
 * Generators are grouped in one module the way heuristic-flags.js groups its
 * seven unrelated heuristics: they share no logic, only a lifecycle.
 */

const { byId } = require('../lib/rules-registry');

const INLINE_CODE_RE = /`[^`]*`/g;
const CODE_SPAN_RE = /`[^`]*`/g;
const MODAL_RE = /\b(must not|must|cannot|never|always|required|do not|you need to)\b/i;
// The subset that reads as a hard instruction rather than a description. "is
// required" and "cannot" describe the system, "must" and "never" command the
// reader, and only the commanding form raises the consequence-ordering question.
const STRONG_MODAL_RE = /\b(must not|must|never|always|do not|you need to)\b/i;
const CONSEQUENCE_RE = /\b(because|otherwise|or else|fails?|breaks?|results? in|leads? to|so that|which means)\b/i;
const PARALLEL_RE = /\b(if|either|whereas|whereas|instead|alternatively|when you|for a)\b/gi;
const ACTOR_RE = /\b(client|runtime|server|browser|agent|user|model|Contentstack|CDN|proxy)\b/g;
const NOTE_RE = /^\s*(>|\*\*Note)/i;
const DIAGRAM_FENCE_RE = /^(```|~~~)/;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'is', 'it', 'its',
  'of', 'on', 'or', 'that', 'the', 'this', 'to', 'what', 'with', 'you', 'your',
]);

function words(text) {
  return String(text || '')
    .toLowerCase()
    .replace(INLINE_CODE_RE, ' ')
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Builds one candidate. `decide` is the question the agent answers, phrased so yes means violation. */
function makeCandidate({ ruleIds, generator, doc, line, endLine, section, signal, evidence, decide }) {
  const primary = byId(ruleIds[0]);
  const base = doc.filePath.split('/').pop();
  return {
    candidateId: `${ruleIds[0]}:${base}:${line}`,
    ruleId: ruleIds[0],
    alsoCovers: ruleIds.slice(1),
    tier: 3,
    generator,
    file: doc.filePath,
    line,
    endLine: endLine || line,
    section: section || null,
    rule: primary ? primary.rule : '(not in registry)',
    why: primary ? primary.why : '',
    exception: primary ? primary.exception : '',
    signal,
    evidence,
    decide,
  };
}

function proseLinesIn(doc, startLine, endLine) {
  const out = [];
  for (let l = startLine; l <= Math.min(endLine, doc.totalLines); l++) {
    if (doc.inFenceMask[l]) continue;
    out.push({ line: l, text: doc.lines[l - 1] });
  }
  return out;
}

/**
 * Conventional sections whose heading is fixed by the standards and is not
 * expected to echo in the body, plus Troubleshooting, whose H3 headings quote
 * an error string and whose bodies are Root Cause and Resolution labels. Judging
 * these against their body vocabulary produces noise, not findings.
 */
const STRUCTURAL_SECTIONS = /^(overview|prerequisites|next steps|limitations|troubleshooting|quick start|quick reference)$/i;

function inTroubleshooting(doc, section) {
  const parent = [...doc.sections].reverse().find((s) => s.level === 2 && s.line < section.line);
  return Boolean(parent && /troubleshooting/i.test(parent.text));
}

/** B1-02, B2-02, C6-01: a heading that shares no vocabulary at all with a substantial body may be naming something else. */
function headingAccuracy(doc) {
  const out = [];
  for (const section of doc.sections) {
    if (section.level < 2) continue;
    if (STRUCTURAL_SECTIONS.test(section.text.trim())) continue;
    if (inTroubleshooting(doc, section)) continue;

    const body = doc.sectionOwnBody(section);
    const bodyWords = new Set(words(body));
    // A short body gives the heading too little to echo for the absence to mean
    // anything. Only a section with real prose can be judged this way.
    if (bodyWords.size < 25) continue;

    const headWords = words(section.text);
    // A one-word heading cannot miss by much, and a heading that shares even
    // one content word with a substantial body is usually naming it correctly.
    // The signal worth a reviewer's time is a heading with no vocabulary in
    // common with what follows.
    if (headWords.length < 2) continue;
    const shared = headWords.filter((w) => bodyWords.has(w)).length;
    const overlap = shared / headWords.length;
    if (shared > 0 || overlap > 0) continue;

    out.push(
      makeCandidate({
        ruleIds: ['C6-01', 'B1-02', 'B2-02'],
        generator: 'headingAccuracy',
        doc,
        line: section.line,
        endLine: section.endLine,
        section: section.text,
        signal: `${Math.round(overlap * 100)}% of the heading's content words appear in its own body`,
        evidence: [`Heading: ${section.text}`, ...sentences(body).slice(0, 2)],
        decide: 'Does this heading name what the section actually contains?',
      })
    );
  }
  return out;
}

/** Classifies a list item by shape, so a list mixing shapes can be surfaced. */
function itemShape(text) {
  const plain = text.replace(/\*\*/g, '').trim();
  if (/^`/.test(plain)) return 'code';
  if (/^\[/.test(plain)) return 'link';
  if (/^[A-Z][a-z]+ [a-z]/.test(plain) && /^[A-Z][a-z]+(s|es)?\b/.test(plain)) return 'nounPhrase';
  if (/^[a-z]+\b/.test(plain)) return 'lowercase';
  return 'other';
}

/** B1-03, B2-05, C6-02: a list whose items are different shapes often groups unlike things as peers. */
function categoryCoherence(doc) {
  const out = [];
  const groups = [];
  let current = null;

  for (const item of doc.listItems) {
    if (item.ordered || item.indent !== 0) continue;
    if (current && item.line - current[current.length - 1].line <= 2) current.push(item);
    else {
      current = [item];
      groups.push(current);
    }
  }

  for (const group of groups) {
    if (group.length < 3) continue;
    const shapes = new Set(group.map((i) => itemShape(i.text)));
    if (shapes.size < 2) continue;

    const section = [...doc.sections].reverse().find((s) => s.line < group[0].line);
    out.push(
      makeCandidate({
        ruleIds: ['C6-02', 'B1-03', 'B2-05'],
        generator: 'categoryCoherence',
        doc,
        line: group[0].line,
        endLine: group[group.length - 1].line,
        section: section ? section.text : null,
        signal: `${group.length} items across ${shapes.size} shapes (${[...shapes].join(', ')})`,
        evidence: group.map((i) => `L${i.line}: ${i.text.slice(0, 90)}`),
        decide: 'Are all of these items genuinely the same kind of thing?',
      })
    );
  }
  return out;
}

/** B1-04, B2-03, C4-01: an obligation stated with no nearby consequence leaves the reader unable to diagnose failures. */
function consequenceOrder(doc) {
  const out = [];
  for (const { line, text } of proseLinesIn(doc, doc.bodyStartLine, doc.totalLines)) {
    if (!STRONG_MODAL_RE.test(text)) continue;
    // Look both ways. A consequence stated just after the rule is still a
    // C4-01 ordering question, but a consequence in neither direction is the
    // stronger signal, and the weaker case is not worth a reviewer's time.
    const window = doc.lines.slice(Math.max(0, line - 3), line + 2).join(' ');
    if (CONSEQUENCE_RE.test(window)) continue;

    const section = [...doc.sections].reverse().find((s) => s.line < line);
    out.push(
      makeCandidate({
        ruleIds: ['C4-01', 'B1-04', 'B2-03'],
        generator: 'consequenceOrder',
        doc,
        line,
        section: section ? section.text : null,
        signal: `obligation "${text.match(MODAL_RE)[0]}" with no consequence language in the preceding two lines`,
        evidence: proseLinesIn(doc, Math.max(doc.bodyStartLine, line - 2), line).map((l) => `L${l.line}: ${l.text.trim().slice(0, 100)}`),
        decide: 'Does the reader learn what breaks before being told the rule?',
      })
    );
  }
  return out;
}

/** B1-05, C2-01, C2-02: parallel items buried in prose are harder to scan than a table or list. */
function proseShouldBeTableOrList(doc) {
  const out = [];
  for (const section of doc.sections) {
    if (section.level < 2) continue;
    const hasTable = doc.tablesInRange(section.line, section.endLine).length > 0;
    const hasList = doc.listItemsInRange(section.line, section.endLine).length > 0;
    if (hasTable || hasList) continue;

    let paraStart = null;
    let para = [];
    const flush = () => {
      if (paraStart && para.length) {
        const text = para.join(' ');
        const sents = sentences(text);
        const parallels = (text.match(PARALLEL_RE) || []).length;
        if (sents.length >= 3 && parallels >= 2) {
          out.push(
            makeCandidate({
              ruleIds: ['C2-01', 'B1-05', 'C2-02'],
              generator: 'proseShouldBeTableOrList',
              doc,
              line: paraStart,
              endLine: paraStart + para.length - 1,
              section: section.text,
              signal: `${sents.length}-sentence paragraph, ${parallels} parallel markers, section has no table and no list`,
              evidence: sents.slice(0, 4),
              decide: 'Does this paragraph compare two or more options across two or more dimensions?',
            })
          );
        }
      }
      paraStart = null;
      para = [];
    };

    for (const { line, text } of proseLinesIn(doc, section.line + 1, section.endLine)) {
      if (text.trim() === '' || /^#{1,6} /.test(text)) flush();
      else {
        if (!paraStart) paraStart = line;
        para.push(text.trim());
      }
    }
    flush();
  }
  return out;
}

/** B1-11: a procedure that never says what skipping costs leaves the reader unable to judge which steps are safe to skip. */
function skipConsequences(doc) {
  const out = [];
  const blocks = [];
  let current = null;
  for (const item of doc.listItems) {
    if (!item.ordered || item.indent !== 0) continue;
    if (current && item.line - current[current.length - 1].line <= 2) current.push(item);
    else {
      current = [item];
      blocks.push(current);
    }
  }

  for (const block of blocks) {
    if (block.length < 2) continue;
    const text = block.map((i) => i.text).join(' ');
    if (CONSEQUENCE_RE.test(text)) continue;

    const section = [...doc.sections].reverse().find((s) => s.line < block[0].line);
    out.push(
      makeCandidate({
        ruleIds: ['B1-11'],
        generator: 'skipConsequences',
        doc,
        line: block[0].line,
        endLine: block[block.length - 1].line,
        section: section ? section.text : null,
        signal: `${block.length}-step procedure with no consequence language in any step`,
        evidence: block.map((i) => `${i.marker} ${i.text.slice(0, 90)}`),
        decide: 'Would a reader know what happens if they skip or misapply one of these steps?',
      })
    );
  }
  return out;
}

/** C2-03: a multi-actor or multi-step flow described only in prose is where a diagram earns its place. */
function diagramNeeded(doc) {
  const out = [];
  for (const section of doc.sections) {
    if (section.level < 2) continue;
    const body = doc.sectionOwnBody(section);
    if (DIAGRAM_FENCE_RE.test(body) || body.includes('![')) continue;

    const actors = new Set((body.match(ACTOR_RE) || []).map((a) => a.toLowerCase()));
    const orderedItems = doc.listItemsInRange(section.line, section.endLine).filter((i) => i.ordered).length;
    // Two actor nouns appear in almost any paragraph about a client and a
    // server, so that alone is noise. A diagram earns its place when several
    // actors AND a multi-step flow are described together in prose.
    if (actors.size < 3 || orderedItems < 3) continue;

    out.push(
      makeCandidate({
        ruleIds: ['C2-03'],
        generator: 'diagramNeeded',
        doc,
        line: section.line,
        endLine: section.endLine,
        section: section.text,
        signal: `${actors.size} distinct actors, ${orderedItems} ordered steps, no diagram and no image`,
        evidence: [`Actors: ${[...actors].join(', ')}`, ...sentences(body).slice(0, 2)],
        decide: 'Would a diagram show this flow more clearly than the prose does?',
      })
    );
  }
  return out;
}

/** C2-06: a list of values maintained elsewhere goes stale silently unless it points at the source. */
function externalValueListNote(doc) {
  const out = [];
  for (const section of doc.sections) {
    if (section.level < 2) continue;
    const body = doc.sectionOwnBody(section);
    const codeSpans = (body.match(CODE_SPAN_RE) || []).length;
    if (codeSpans < 4) continue;
    if (doc.linksInRange(section.line, section.endLine).length > 0) continue;
    if (body.split('\n').some((l) => NOTE_RE.test(l))) continue;

    out.push(
      makeCandidate({
        ruleIds: ['C2-06'],
        generator: 'externalValueListNote',
        doc,
        line: section.line,
        endLine: section.endLine,
        section: section.text,
        signal: `${codeSpans} literal values, no outbound link and no Note callout in the section`,
        evidence: [`Section: ${section.text}`, ...sentences(body).slice(0, 2)],
        decide: 'Is this list maintained outside the docs, so it needs an authoritative-source note?',
      })
    );
  }
  return out;
}

/** C4-04: required values and flags belong in a snippet the reader can copy, not in a sentence they must parse. */
function optionsInCode(doc) {
  const out = [];
  for (const section of doc.sections) {
    if (section.level < 2) continue;
    if (doc.sectionOwnBody(section).match(DIAGRAM_FENCE_RE)) continue;

    for (const { line, text } of proseLinesIn(doc, section.line + 1, section.endLine)) {
      const spans = (text.match(CODE_SPAN_RE) || []).length;
      if (spans < 2 || !MODAL_RE.test(text)) continue;
      out.push(
        makeCandidate({
          ruleIds: ['C4-04'],
          generator: 'optionsInCode',
          doc,
          line,
          section: section.text,
          signal: `${spans} inline-code identifiers plus an obligation, stated as prose`,
          evidence: [`L${line}: ${text.trim().slice(0, 140)}`],
          decide: 'Should these values be shown as a code snippet instead of described in a sentence?',
        })
      );
    }
  }
  return out;
}

/** C5-02: a cross-reference with no inline summary makes the reader leave the page to learn one fact. */
function crossRefInlineSummary(doc) {
  const out = [];
  for (const link of doc.links) {
    const text = doc.lines[link.line - 1];
    if (!text) continue;
    // Next Steps bare links are already reported by the bare-links check.
    const section = [...doc.sections].reverse().find((s) => s.line < link.line);
    if (section && /next steps/i.test(section.text)) continue;

    // Only a link that stands as its own bullet is making the reader leave the
    // page for a fact. A link inside a sentence already has its context around
    // it, and flagging those buries the real cases.
    if (!/^\s*[-*]\s/.test(text)) continue;

    const after = text.slice(text.indexOf(')') + 1).trim();
    const wordCount = after.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 8) continue;

    out.push(
      makeCandidate({
        ruleIds: ['C5-02'],
        generator: 'crossRefInlineSummary',
        doc,
        line: link.line,
        section: section ? section.text : null,
        signal: `${wordCount} words of context follow the link`,
        evidence: [`L${link.line}: ${text.trim().slice(0, 140)}`],
        decide: 'Does the reader need the linked page to act, or is the critical fact summarized here?',
      })
    );
  }
  return out;
}

/** C9-04: a page with no Limitations section either has no gaps, or has undocumented ones. */
function limitationsCoverage(doc) {
  if (doc.findSection(['Limitations'])) return [];
  const title = doc.headings.find((h) => h.level === 1);
  return [
    makeCandidate({
      ruleIds: ['C9-04'],
      generator: 'limitationsCoverage',
      doc,
      line: title ? title.line : doc.bodyStartLine,
      section: title ? title.text : null,
      signal: 'no Limitations section in the document',
      evidence: [`Sections: ${doc.topLevelSections().map((s) => s.text).join(', ')}`],
      decide: 'Does this page have known coverage gaps or caps that a reader would hit?',
    }),
  ];
}

/**
 * Rules with no usable deterministic signal.
 *
 * For these the script contributes routing only, scoping the right text to the
 * right rule ID, and no detection whatsoever. Saying so here rather than
 * inventing a weak heuristic keeps the candidate list honest: a reviewer should
 * know which candidates were narrowed and which are just the whole section.
 */
const ROUTING_ONLY = [
  { ruleId: 'C4-06', decide: 'Does each SDK error entry give a bad value, a corrective action, and a help link?' },
  { ruleId: 'C7-03', decide: 'Is shared setup stated once here and pointed at elsewhere, rather than duplicated?' },
];

function routingOnly(doc) {
  const out = [];
  const title = doc.headings.find((h) => h.level === 1);
  for (const entry of ROUTING_ONLY) {
    const rule = byId(entry.ruleId);
    if (!rule) continue;
    out.push(
      makeCandidate({
        ruleIds: [entry.ruleId],
        generator: 'routingOnly',
        doc,
        line: title ? title.line : doc.bodyStartLine,
        section: title ? title.text : null,
        signal: 'routing only, no deterministic signal exists for this rule',
        evidence: [`Sections: ${doc.topLevelSections().map((s) => s.text).join(', ')}`],
        decide: entry.decide,
      })
    );
  }
  return out;
}

const GENERATORS = [
  headingAccuracy,
  categoryCoherence,
  consequenceOrder,
  proseShouldBeTableOrList,
  skipConsequences,
  diagramNeeded,
  externalValueListNote,
  optionsInCode,
  crossRefInlineSummary,
  limitationsCoverage,
  routingOnly,
];

function collectTier3Candidates(doc) {
  const out = [];
  for (const gen of GENERATORS) {
    try {
      out.push(...gen(doc));
    } catch (err) {
      out.push({
        candidateId: `GEN-ERROR:${doc.filePath}:${gen.name}`,
        ruleId: null,
        generator: gen.name,
        file: doc.filePath,
        line: 1,
        signal: `generator threw: ${err.message}`,
        evidence: [],
        decide: 'Ignore this entry, it is a tooling failure rather than a document issue.',
      });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

module.exports = { collectTier3Candidates, GENERATORS };
