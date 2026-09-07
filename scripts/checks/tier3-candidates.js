'use strict';

/**
 * Candidate extraction for the 26 tier-3 rules.
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

const path = require('path');
const { byId } = require('../lib/rules-registry');
const { loadPhraseList, entryRegex, stripNonProse } = require('../lib/phrase-list');
const { shingles, jaccard } = require('../lib/similarity');
const { sectionParagraphs, cohesionSignal } = require('./paragraph-cohesion');

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

// Words that frame a limit as a failing in some sentences and state a plain
// fact in others. The tier-2 wordlist deliberately excludes them, because
// "silently" in "Contentstack silently caps the value" is criticism while
// "the view shows no error" may be the fact the reader must act on.
const DEFECT_FRAMING_RE =
  /\b(silently|quietly|misleading|does nothing|has no effect|not supported yet|no warning|without warning|no counter)\b/i;

/** C8-09: is a real limit stated neutrally, or framed as the product failing? */
function defectFraming(doc) {
  const out = [];
  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const hit = DEFECT_FRAMING_RE.exec(text);
      if (!hit) continue;
      out.push(
        makeCandidate({
          ruleIds: ['C8-09'],
          generator: 'defectFraming',
          doc,
          line,
          section: section.text,
          signal: `defect-framing word "${hit[1]}"`,
          evidence: [text.trim().slice(0, 220)],
          decide:
            'Does this sentence frame a real limit as the product failing the reader, rather than stating the boundary neutrally?',
        })
      );
    }
  }
  return out;
}

// Surfaces that belong to the product's insides, not to a reader's task.
const INTERNAL_DISCLOSURE_RE =
  /\b(internal to the app|fails? open|serves every|short-lived token|POST\s+\/api\/|PUT\s+\/api\/|\.ts:\d+|\.tsx:\d+|lib\/[a-z-]+\/)\b/i;

/** C6-04: does this passage expose internals a customer has no use for? */
function internalDisclosure(doc) {
  const out = [];
  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const hit = INTERNAL_DISCLOSURE_RE.exec(text);
      if (!hit) continue;
      out.push(
        makeCandidate({
          ruleIds: ['C6-04'],
          generator: 'internalDisclosure',
          doc,
          line,
          section: section.text,
          signal: `internal-surface phrase "${hit[1]}"`,
          evidence: [text.trim().slice(0, 220)],
          decide:
            'Does this passage expose internal implementation, an internal endpoint and its credential, or fail-open behavior that no reader needs to finish a task?',
        })
      );
    }
  }
  return out;
}

/**
 * C2-07: the deterministic check exempts a long heading only when it both sits
 * on a Root Cause entry and looks like product output. Whether it really is
 * product output, rather than the author's own wording of a symptom, is the
 * judgement a regex cannot make, so every exempted heading comes here.
 */
function headingProductOutput(doc) {
  const out = [];
  for (const heading of doc.headings) {
    if (heading.level === 1 || doc.inFenceMask[heading.line]) continue;
    const wordCount = heading.text.replace(INLINE_CODE_RE, 'X').split(/\s+/).filter(Boolean).length;
    if (wordCount <= 4) continue;
    if (!isRootCauseEntry(doc, heading.line)) continue;
    out.push(
      makeCandidate({
        ruleIds: ['C2-07'],
        generator: 'headingProductOutput',
        doc,
        line: heading.line,
        section: heading.text,
        signal: `${wordCount}-word heading on a Root Cause entry, claiming the product-output exception`,
        evidence: [heading.text],
        decide:
          "Is this heading the author's own description of a symptom rather than text the product emits verbatim?",
      })
    );
  }
  return out;
}

function isRootCauseEntry(doc, headingLine) {
  for (let n = headingLine + 1; n <= doc.totalLines; n++) {
    if (doc.inFenceMask[n]) continue;
    const raw = doc.lines[n - 1];
    if (raw.trim() === '') continue;
    return /^\s*\*\*Root Cause\*\*/.test(raw);
  }
  return false;
}

const TABLE_CALLOUT_RE = /^\s*>\s*\*\*(Warning|Note|Tip)\s*:\*\*/;
const TABLE_BOLD_LEADIN_RE = /^\s*\*\*[^*]+\*\*\s+\S/;

/**
 * C7-05: a block beside a table that repeats a row's meaning without its words.
 *
 * C7-04's shingle overlap catches a literal copy. Measured on this corpus it
 * scores 0.00 against the block it was written for, because the restatement is
 * semantic: the callout and the row share a fact and no vocabulary. Only a
 * reader can see that, so the structure is the signal and the judgement is the
 * agent's.
 */
function tableAdjacentBlock(doc) {
  const out = [];
  for (const table of doc.tables || []) {
    const last = Math.min(table.endLine + 12, doc.totalLines);
    for (let n = table.endLine + 1; n <= last; n++) {
      if (doc.inFenceMask[n]) continue;
      const raw = doc.lines[n - 1];
      if (raw.trim() === '') continue;
      if (/^#{1,6}\s/.test(raw)) break;
      if (raw.trim().startsWith('|')) continue;
      if (!TABLE_CALLOUT_RE.test(raw) && !TABLE_BOLD_LEADIN_RE.test(raw)) continue;

      const section = doc.topLevelSections().find((s) => n >= s.line && n <= s.endLine);
      out.push(
        makeCandidate({
          ruleIds: ['C7-05'],
          generator: 'tableAdjacentBlock',
          doc,
          line: n,
          section: section ? section.text : null,
          signal: `callout or bolded paragraph ${n - table.endLine} line(s) after the table at ${table.startLine}`,
          evidence: [
            `Block: ${raw.trim().slice(0, 180)}`,
            `Table rows: ${table.rows.map((r) => r.join(' / ')).join(' || ').slice(0, 320)}`,
          ],
          decide:
            'Does this block repeat the meaning of a row in the table above it, without adding a fact the table does not carry?',
        })
      );
    }
  }
  return out;
}

// An edit verb governing a short coordinated noun list. The list is what reads
// as the complete set of what the product allows, so the verb plus the "or"/"and"
// join is the whole signal. Nothing here can tell a complete list from a partial
// one, which is exactly why this is tier 3.
const ENUMERATION_RE =
  /\b(change|edit|update|modify|configure|set|adjust|rename)\s+(?:its|the|your|their)?\s*([a-z][\w-]*(?:,\s*[a-z][\w-]*)*\s+(?:or|and)\s+[a-z][\w-]*)\b/i;
// A list already marked illustrative carries no false completeness claim.
const ILLUSTRATIVE_RE = /\b(for example|such as|among (?:them|others)|including)\b/i;

/** C3-16: does a coordinated list after an edit verb name everything the reader can change? */
function enumerationCompleteness(doc) {
  const out = [];
  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      if (ILLUSTRATIVE_RE.test(text)) continue;
      const hit = ENUMERATION_RE.exec(text.replace(INLINE_CODE_RE, ' '));
      if (!hit) continue;
      out.push(
        makeCandidate({
          ruleIds: ['C3-16'],
          generator: 'enumerationCompleteness',
          doc,
          line,
          section: section.text,
          signal: `edit verb "${hit[1]}" governing the coordinated list "${hit[2].trim()}"`,
          evidence: [text.trim().slice(0, 220)],
          decide:
            'Is this the complete set of what the reader can change here, or does the product allow more than the sentence names?',
        })
      );
    }
  }
  return out;
}

// Quantifiers and frequency words that stand in for a figure or a condition.
// "some" and "most" describe a real distribution in some sentences and hide an
// unresearched fact in others, which no regex can separate.
// "at most 200" and "at least one" are exact bounds that happen to contain a
// quantifier word. Consuming the "at" prevents the alternation from matching
// the bound as if it were a hedge.
const VAGUE_QUANTIFIER_RE =
  /\b(?:at (?:most|least)\b)|\b(most|some|several|a few|many|occasionally|usually|often|typically|generally)\b/i;
// The sentence has to be about what the product does. A quantifier inside an
// instruction to the reader ("select some tools") is a different problem.
const BEHAVIOR_RE =
  /\b(client|clients|runtime|server|profile|profiles|tool|tools|call|calls|Contentstack|the app|the wizard|the view|catalog|catalogs|model|models|agent|agents)\b/;

/** C3-17: can a vague quantifier be replaced with the figure or the deciding condition? */
function vagueQuantifier(doc) {
  const out = [];
  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const trimmed = text.trim();
      // Table rows and callouts get their own rules, and a heading is judged by
      // headingAccuracy. Only running prose is in scope here.
      if (trimmed.startsWith('|') || trimmed.startsWith('>') || /^#{1,6}\s/.test(trimmed)) continue;
      const stripped = trimmed.replace(INLINE_CODE_RE, ' ');
      const hit = VAGUE_QUANTIFIER_RE.exec(stripped);
      // A match with no capture is an exact bound ("at most 200"), which the
      // alternation consumes precisely so it cannot be reported as a hedge.
      if (!hit || !hit[1] || !BEHAVIOR_RE.test(stripped)) continue;
      out.push(
        makeCandidate({
          ruleIds: ['C3-17'],
          generator: 'vagueQuantifier',
          doc,
          line,
          section: section.text,
          signal: `quantifier "${hit[1]}" in a sentence stating product behavior`,
          evidence: [trimmed.slice(0, 220)],
          decide:
            'Can this quantifier be replaced with the actual figure, or with the condition that decides which cases it covers?',
        })
      );
    }
  }
  return out;
}

// Clauses that put something else in front of the topic. "Beyond creating a
// profile, you can duplicate one" spends its opening on the page next door.
const DEPENDENT_OPENER_RE =
  /^(Beyond|In addition to|Apart from|Aside from|Besides|Unlike|Rather than|Instead of|As well as|While|Although|Though|Once|After|Before|Because|Since)\b/i;
// A result clause reached late in the sentence: the background came first and
// the topic arrives only as its consequence. Only ", so" qualifies. A trailing
// ", and" usually continues a list rather than deferring the subject.
const RESULT_PIVOT_RE = /,\s+so\s/;
const MIN_WORDS_BEFORE_PIVOT = 8;

/** C6-05: does the Overview's first sentence state what this page covers? */
function overviewOpenerTopicFirst(doc) {
  const section = doc.findSection(['Overview']) || doc.topLevelSections()[0];
  if (!section) return [];

  const prose = proseLinesIn(doc, section.line + 1, section.endLine)
    .filter(({ text }) => text.trim() && !/^[|>#\-*\d]/.test(text.trim()));
  if (!prose.length) return [];

  const first = prose[0];
  const opener = sentences(first.text.trim())[0];
  if (!opener) return [];

  let signal = null;
  const dependent = DEPENDENT_OPENER_RE.exec(opener);
  if (dependent) {
    signal = `the sentence opens on "${dependent[1]}", a clause about something other than this page`;
  } else {
    const pivot = RESULT_PIVOT_RE.exec(opener);
    if (pivot && opener.slice(0, pivot.index).split(/\s+/).length >= MIN_WORDS_BEFORE_PIVOT) {
      signal = 'the topic arrives in a result clause after "so", behind the background that precedes it';
    }
  }
  if (!signal) return [];

  const heading = doc.sections.find((s) => s.level === 1);
  return [
    makeCandidate({
      ruleIds: ['C6-05'],
      generator: 'overviewOpenerTopicFirst',
      doc,
      line: first.line,
      section: section.text,
      signal,
      evidence: [`Page: ${heading ? heading.text : '(no H1)'}`, opener],
      decide:
        'Does the reader have to get past a clause about something else before learning what this page covers?',
    }),
  ];
}

// The narrow cue that a line is talking about a hover-revealed control. The
// wider UI vocabulary in ui-element-bold.js includes "button" and "click",
// which every correctly bolded label sits beside, so borrowing it whole would
// nominate the entire corpus.
const HOVER_CUE_RE = /\b(hovers?|hovering|icons?|reveals?)\b/i;
const BOLD_SPAN_RE = /\*\*([^*]+)\*\*/g;

/** C4-08: is this bolded name an icon with no visible label, which belongs in quotes? */
function hoverIconBoldLabel(doc) {
  const out = [];
  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const trimmed = text.trim();
      // A table documenting tooltip strings quotes UI text rather than naming
      // an icon, which the rule's own exception covers.
      if (trimmed.startsWith('|') || /^#{1,6}\s/.test(trimmed)) continue;
      if (!HOVER_CUE_RE.test(trimmed)) continue;

      const labels = [];
      BOLD_SPAN_RE.lastIndex = 0;
      let m;
      while ((m = BOLD_SPAN_RE.exec(trimmed)) !== null) {
        const label = m[1].trim();
        if (label && !labels.includes(label)) labels.push(label);
      }
      if (!labels.length) continue;

      // Rows elsewhere in the file naming the same label are how a reviewer
      // tells a hover-only icon from a control that carries a visible name.
      // The header travels with the row, because a row under a Tooltip column
      // is evidence the app shows that text only on hover, and the same row
      // without its header reads as proof of a visible label.
      const rows = [];
      for (const table of doc.tables || []) {
        const header = table.headerCells.join(' | ');
        for (const row of table.rows) {
          const joined = row.join(' | ');
          if (labels.some((l) => joined.includes(l))) {
            rows.push(`Table row (columns: ${header}): ${joined}`);
          }
        }
      }

      out.push(
        makeCandidate({
          ruleIds: ['C4-08'],
          generator: 'hoverIconBoldLabel',
          doc,
          line,
          section: section.text,
          signal: `bold label(s) ${labels.map((l) => `"${l}"`).join(', ')} on a line about a hover or icon control`,
          evidence: [trimmed.slice(0, 220), ...rows.slice(0, 4)],
          decide:
            'Is this bolded name an icon that shows its name only as a hover tooltip, with no label visible on the screen?',
        })
      );
    }
  }
  return out;
}

// A gerund holding the subject slot, in the two positions that produced real
// defects: at the start of a sentence, and after a pivot conjunction.
const GERUND_SUBJECT_RE = /^([A-Z][a-z]+ing)\b/;
const PIVOT_GERUND_RE = /,\s+(?:so|and|but)\s+([a-z]+ing)\b/;

/** C3-20: does a gerund subject hide an actor the sentence already names? */
function gerundSubjectActor(doc) {
  const out = [];
  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const trimmed = text.trim();
      if (!trimmed || trimmed.startsWith('|') || trimmed.startsWith('>') || /^#{1,6}\s/.test(trimmed)) continue;

      // A list marker or an ordered-step number precedes the sentence itself.
      const body = trimmed.replace(/^(?:[-*+]|\d+\.)\s+/, '').replace(/^\*\*[^*]+\*\*:?\s*/, '');
      const found = sentences(body).map((sentence) => {
        const initial = GERUND_SUBJECT_RE.exec(sentence);
        if (initial) return { sentence, gerund: initial[1], position: 'opens the sentence' };
        const pivot = PIVOT_GERUND_RE.exec(sentence);
        if (pivot) return { sentence, gerund: pivot[1], position: 'follows a pivot conjunction' };
        return null;
      });

      const hit = found.find(Boolean);
      if (!hit) continue;

      // The actor is often named in the sentence before, which is the fact that
      // separates a concept-naming gerund from one hiding somebody.
      const previous = proseLinesIn(doc, section.line, line - 1)
        .map((l) => l.text.trim())
        .filter((t) => t && !t.startsWith('|') && !/^#{1,6}\s/.test(t))
        .pop();

      out.push(
        makeCandidate({
          ruleIds: ['C3-20'],
          generator: 'gerundSubjectActor',
          doc,
          line,
          section: section.text,
          signal: `"${hit.gerund}" holds the subject slot and ${hit.position}`,
          evidence: [hit.sentence.slice(0, 220), ...(previous ? [`Preceding line: ${previous.slice(0, 220)}`] : [])],
          decide:
            'Does this gerund subject hide an actor that the sentence, or the one before it, already names or implies?',
        })
      );
    }
  }
  return out;
}

// --- C3-21: house verbs ------------------------------------------------------

const HOUSE_VERB_DIR = path.join(__dirname, '..', 'data', 'house-verbs');

/**
 * Splits a line into sentences on terminal punctuation followed by a space.
 * Deliberately naive: a wrong split costs one extra candidate, and the judge
 * reads the text either way. What it must not do is split on a decimal or an
 * abbreviation mid-identifier, which the space requirement already prevents.
 */
function sentencesOf(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * C3-21: is a general house verb standing in for an exact mechanism verb?
 *
 * Grouped by sentence rather than by line, and capped at one candidate per
 * sentence, because the judge is billed per sentence. A sentence carrying both
 * "holds" and "carries" is one question, not two, and the matched verbs travel
 * together in the evidence so the judge sees the whole picture.
 *
 * This is tier 3 rather than a check because the decision needs the sentence
 * read: "holds a lock" is right and "holds an enabled flag" is not, and no
 * pattern separates them. C3-18 covers what a pattern CAN decide.
 */
function houseVerbTone(doc) {
  const entries = loadPhraseList(HOUSE_VERB_DIR);
  const bySentence = new Map();

  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const trimmed = text.trim();
      // Table rows, callouts, and headings have their own rules. A house verb
      // in a table cell is a column label, not a sentence to rewrite.
      if (!trimmed || trimmed.startsWith('|') || trimmed.startsWith('>') || /^#{1,6}\s/.test(trimmed)) continue;

      // Split and report the RAW sentence, but match against the stripped one.
      // The evidence is what a judge is asked to rewrite, so it has to keep the
      // inline code spans and link targets a rewrite must preserve. Handing
      // over the stripped text produced fixes that silently deleted an
      // identifier and emptied a markdown link.
      const withoutMarker = trimmed.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
      for (const sentence of sentencesOf(withoutMarker)) {
        const forMatching = stripNonProse(sentence);
        for (const entry of entries) {
          let re;
          try {
            re = entryRegex(entry);
          } catch (err) {
            continue;
          }
          if (!re.test(forMatching)) continue;

          const key = `${line}:${sentence.slice(0, 60)}`;
          if (!bySentence.has(key)) {
            bySentence.set(key, { line, section: section.text, sentence, verbs: [], fixes: [] });
          }
          const group = bySentence.get(key);
          group.verbs.push(entry.label || entry.phrase);
          group.fixes.push(entry.fix);
        }
      }
    }
  }

  const out = [];
  for (const group of bySentence.values()) {
    out.push(
      makeCandidate({
        ruleIds: ['C3-21'],
        generator: 'houseVerbTone',
        doc,
        line: group.line,
        section: group.section,
        signal: `house verb ${group.verbs.map((v) => `"${v}"`).join(', ')} in running prose`,
        evidence: [group.sentence.slice(0, 300), ...group.fixes],
        decide:
          'Does this sentence use a general house verb where an exact mechanism verb is available, or attribute intent to a component?',
      })
    );
  }
  return out;
}

// --- C5-06: an instruction with no destination -------------------------------

/**
 * A destination the reader can act on. Inline code is deliberately NOT one.
 *
 * A first attempt at this as a tier-2 check counted inline code as a
 * destination, which silently vetoed "ask IT to allowlist the package" because
 * that line happens to contain `npx`. A command tells you what to run, not
 * where to go or whom to ask.
 */
const DESTINATION_RE = /\]\([^)]*\)|https?:\/\/|mailto:|\*\*[^*]+\*\*/;

/** Lines that are an instruction rather than a description or a symptom. */
const RESOLUTION_LABEL_RE = /^\s*\*\*(Resolution|Fix|Workaround)\*\*/i;
const STEP_RE = /^\s*(?:\d+[.)]|[-*+])\s+/;

/**
 * Verbs that hand the reader off somewhere else. Inflected from the start,
 * because "one member of a verb family listed and the sibling not" is the
 * failure this whole pass exists to stop repeating.
 */
const HANDOFF_RE =
  /\b(ask(s|ed|ing)?|rais(e|es|ed|ing)|contact(s|ed|ing)?|consult(s|ed|ing)?|check(s|ed|ing)?|confirm(s|ed|ing)?|refer|wait)\b/i;

/**
 * C5-06: does this instruction route the reader somewhere without saying where?
 *
 * Tier 3 rather than a check, and the reason is worth recording. The tier-2
 * version of this signal was dry-run over the corpus before being written: it
 * flagged 4 lines where an agentic read found 19, and half of the 4 were wrong
 * (a symptom heading, "### The client asks you to authorize repeatedly", and a
 * descriptive sentence, "a wider selection asks the user to approve more
 * access"). The misses were the informative part. "Check for a corporate proxy,
 * VPN, firewall, or TLS-inspecting middlebox" is a list of suspects with no
 * action, and no wordlist reaches that. So the signal narrows and the judge
 * decides.
 */
function missingDestination(doc) {
  const out = [];
  for (const section of doc.topLevelSections()) {
    let inResolution = false;
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const trimmed = text.trim();

      // A Resolution or Fix label opens an instruction block; the next heading
      // or a Root Cause label closes it.
      if (RESOLUTION_LABEL_RE.test(trimmed)) inResolution = true;
      else if (/^\s*\*\*Root Cause/i.test(trimmed) || /^#{1,6}\s/.test(trimmed)) inResolution = false;

      if (!trimmed) continue;
      // A heading states a symptom, and a table row is judged as a table.
      if (/^#{1,6}\s/.test(trimmed)) continue;

      // Strip the markup that opens the line, so a `**Resolution**:` label is
      // not itself counted as the bolded screen name that satisfies the
      // instruction. That veto silently swallowed "ask IT to allowlist the
      // package", which sits in a Resolution block and has no destination.
      const body = trimmed
        .replace(RESOLUTION_LABEL_RE, '')
        .replace(/^:\s*/, '')
        .replace(STEP_RE, '');

      const isTableRow = trimmed.startsWith('|');
      const isStep = STEP_RE.test(trimmed);

      for (const sentence of sentencesOf(body)) {
        const hit = HANDOFF_RE.exec(sentence);
        if (!hit) continue;

        // Per sentence, not per line, and the destination must come AFTER the
        // handoff verb. A line can carry a link for one clause and abandon the
        // reader in the next: monitor-and-troubleshoot.md:64 links what
        // "disabled" means and then says "raise a support request" with no
        // route to support. A whole-line veto reads that as satisfied.
        const after = sentence.slice(hit.index);
        if (DESTINATION_RE.test(after)) continue;

        // The instruction context. A Resolution block, a numbered step, or a
        // Fix table cell is one. So is a handoff verb reached through "so" or
        // "or", which is how body prose issues an instruction: "the menu names
        // depend on your plan, so check OpenAI's documentation". Requiring
        // only the first three dropped every body-prose dead end; requiring
        // none of them flagged symptom headings and descriptive sentences.
        const before = sentence.slice(0, hit.index);
        const reachedByConjunction = /(^|[.,;:]\s+)(so|or|then)\s+$/i.test(before);
        const sentenceInitial = before.trim() === '';
        if (!inResolution && !isStep && !isTableRow && !reachedByConjunction && !sentenceInitial) continue;

        out.push(
          makeCandidate({
            ruleIds: ['C5-06'],
            generator: 'missingDestination',
            doc,
            line,
            section: section.text,
            signal: `handoff verb "${hit[0]}" with no link, URL, mailto, or bolded screen name after it`,
            evidence: [sentence.slice(0, 300)],
            decide:
              'Does this instruction tell the reader to go somewhere or ask someone without giving them the destination?',
          })
        );
      }
    }
  }
  return out;
}

// --- C3-22: a contrastive connective joining clauses that agree --------------

/** Only mid-sentence, and only with a clause on each side. A leading "But" is C3-15's. */
const CONTRAST_RE = /,\s+(but|yet)\s+|\b(however|though|whereas)\b/i;

/** C3-22: do the clauses this connective joins actually point opposite ways? */
function falseContrast(doc) {
  const out = [];
  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const trimmed = text.trim();
      if (!trimmed || trimmed.startsWith('|') || /^#{1,6}\s/.test(trimmed)) continue;

      for (const sentence of sentencesOf(trimmed.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''))) {
        const hit = CONTRAST_RE.exec(stripNonProse(sentence));
        if (!hit) continue;
        const connective = (hit[1] || hit[2]).toLowerCase();
        out.push(
          makeCandidate({
            ruleIds: ['C3-22'],
            generator: 'falseContrast',
            doc,
            line,
            section: section.text,
            signal: `contrastive connective "${connective}" joining two clauses`,
            evidence: [sentence.slice(0, 300)],
            decide: 'Do the two clauses this connective joins actually point in opposite directions?',
          })
        );
      }
    }
  }
  return out;
}

// --- C7-06 and C7-02: the same fact stated more than once --------------------

/** Below this, two sentences share wording by coincidence rather than meaning. */
const REPEAT_JACCARD_FLOOR = 0.5;
/** A short sentence shares shingles too easily to judge, and carries little fact. */
const REPEAT_MIN_WORDS = 7;

/**
 * C7-06: is this fact stated more than once where one canonical statement plus
 * a cross-reference would do?
 *
 * Reuses lib/similarity.js's shingles and jaccard, which C7-01 already uses,
 * but at SENTENCE granularity rather than whole sections. That difference is
 * the whole point: C7-01 compares top-level sections at jaccard > 0.5, so one
 * repeated sentence living inside three otherwise-different sections scores far
 * under the floor and is invisible. That is exactly how a Warning callout came
 * to restate a fact already present in two other sections of the same page.
 *
 * Also carries C7-02 in alsoCovers when one occurrence is in Prerequisites,
 * which is the narrower rule C7-02 always described and never once fired on.
 */
function repeatedFact(doc) {
  const sentences = [];
  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const trimmed = text.trim();
      if (!trimmed || trimmed.startsWith('|') || /^#{1,6}\s/.test(trimmed)) continue;
      for (const sentence of sentencesOf(stripNonProse(trimmed).replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''))) {
        if (sentence.split(/\s+/).filter(Boolean).length < REPEAT_MIN_WORDS) continue;
        sentences.push({ line, section: section.text, sentence, sh: shingles(sentence) });
      }
    }
  }

  // Union-find would be tidier, but a page has tens of sentences, so a simple
  // grouping pass is clearer and fast enough.
  const grouped = new Set();
  const out = [];
  for (let i = 0; i < sentences.length; i++) {
    if (grouped.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < sentences.length; j++) {
      if (grouped.has(j)) continue;
      if (jaccard(sentences[i].sh, sentences[j].sh) >= REPEAT_JACCARD_FLOOR) group.push(j);
    }
    if (group.length < 2) continue;
    for (const k of group) grouped.add(k);

    const members = group.map((k) => sentences[k]);
    const inPrerequisites = members.some((m) => /^prerequisites$/i.test(m.section));
    const ruleIds = inPrerequisites ? ['C7-06', 'C7-02'] : ['C7-06'];

    out.push(
      makeCandidate({
        ruleIds,
        generator: 'repeatedFact',
        doc,
        line: members[0].line,
        endLine: members[members.length - 1].line,
        section: members[0].section,
        signal: `the same wording at ${members.length} places: lines ${members.map((m) => m.line).join(', ')}`,
        // Every occurrence travels in the evidence, so the judge sees the full
        // set rather than a pair and can say which one should be canonical.
        evidence: members.map((m) => `L${m.line} [${m.section}] ${m.sentence.slice(0, 200)}`),
        decide:
          'Is this the same fact stated more than once, where one canonical statement plus a cross-reference would do?',
      })
    );
  }
  return out;
}

// --- C3-23: a documented concept described instead of named and linked ------

/**
 * Named concepts this doc set circles instead of naming, with the term the
 * prose should use.
 *
 * C3-09 already existed and could never have caught any of these: its rule text
 * is concept-general but `data/periphrasis/` holds one file, about pagination,
 * so a periphrastic description of a token matched no entry. Rather than grow
 * that wordlist one concept at a time, which is the "list encodes yesterday's
 * catches" failure this whole pass exists to stop, this generator works from
 * the concept side: it looks for the DESCRIPTION and asks whether the NAME
 * would do.
 *
 * The signal is a conjunction, which is what keeps it from firing on ordinary
 * prose: a sentence must carry a periphrasis marker AND at least two property
 * words for one of these concepts, AND must not already name the concept.
 */
const CIRCLED_CONCEPTS = [
  {
    name: 'auth token',
    names: /\bauth(entication)? token\b/i,
    properties: /\bshort[- ]lived\b|\bnever displays\b|\bissues for its own use\b|\bfor its own use\b/i,
  },
  {
    name: 'access token and refresh token',
    names: /\baccess token\b|\brefresh token\b/i,
    properties: /\bshort[- ]lived\b|\bcaches it locally\b|\brefreshes it\b/i,
  },
  {
    name: 'management token or delivery token',
    names: /\b(management|delivery) token\b/i,
    // Bare "credentials" is an ordinary English word, not a periphrasis. It
    // fired on "cached MCP credentials" and "carries no credentials", so the
    // property is narrowed to the phrasing that actually stands in for the two
    // named token types.
    properties: /\b(you )?supply the tokens\b/i,
  },
  {
    name: 'tools/list',
    names: /`tools\/list`/,
    properties: /\b(a|the) client lists the tools\b|\blists the tools a profile\b/i,
  },
  {
    name: 'enum',
    names: /`enum`/,
    properties: /\bthe list of [a-z]+ that exist\b|\bcarries the list of\b/i,
  },
  {
    name: 'Dynamic Client Registration',
    names: /\bDynamic Client Registration\b/i,
    properties: /\bno client ID and no client secret\b/i,
  },
  {
    name: 'HTTP trigger',
    names: /\bHTTP (Request )?[Tt]rigger\b/,
    properties: /\bworks as an unauthenticated webhook\b|\bunauthenticated webhook\b/i,
  },
  {
    name: 'inputSchema',
    names: /`inputSchema`|\binput schema\b/i,
    properties: /\bno parameter names\b|\bno schema to fill\b/i,
  },
];

/** C3-23: is a documented concept being described where naming and linking it would do? */
function circledConcept(doc) {
  const out = [];
  for (const section of doc.topLevelSections()) {
    for (const { line, text } of proseLinesIn(doc, section.line, section.endLine)) {
      const trimmed = text.trim();
      if (!trimmed || /^#{1,6}\s/.test(trimmed)) continue;
      const stripped = stripNonProse(trimmed);

      // Grouped per line, not per concept. Several concepts share a property
      // word ("short-lived" belongs to both the auth token and the OAuth access
      // token), so one sentence would otherwise become two questions about the
      // same wording, and the judge would be billed twice for it.
      const matched = CIRCLED_CONCEPTS.filter(
        // Already naming it is a use, not a definition. This is what keeps the
        // generator from re-flagging a sentence it already caused someone to fix.
        (c) => c.properties.test(stripped) && !c.names.test(trimmed)
      );
      if (matched.length === 0) continue;

      const names = matched.map((c) => c.name);
      out.push(
        makeCandidate({
          ruleIds: ['C3-23'],
          generator: 'circledConcept',
          doc,
          line,
          section: section.text,
          signal: `describes ${names.map((n) => `"${n}"`).join(' or ')} without naming it`,
          evidence: [trimmed.slice(0, 300), `the established term is ${names.map((n) => `"${n}"`).join(' or ')}`],
          decide: `Is this sentence describing ${names.join(' or ')} where naming it and linking its documentation would do?`,
        })
      );
    }
  }
  return out;
}

// --- C3-25: a block with no lead-in, or a pronoun stranded behind one ---------

/** A markdown image on its own line. The alt text is not a noun the next sentence can resolve to. */
const IMAGE_LINE_RE = /^\s*!\[/;

/**
 * Words that tell the reader which way to look. A lead-in carrying one of these
 * has already answered the question this rule asks, so the sentence is exempt.
 * C3-24 owns the opposite case, a pointer that names no direction at all.
 */
const DIRECTION_RE = /\b(below|above|following|preceding|earlier|later|next|previous|shown|listed|here)\b/i;

/** A sentence that opens on a pronoun, so its antecedent has to come from outside the sentence. */
const OPENING_PRONOUN_RE = /^(it|they|these|those|this|that)\b/i;

/** The nearest line before `lineNo` that carries content. Returns 0 at the top of the body. */
function previousContentLine(doc, lineNo) {
  for (let n = lineNo - 1; n >= doc.bodyStartLine; n--) {
    if (String(doc.lines[n - 1]).trim() !== '') return n;
  }
  return 0;
}

/**
 * C3-25: does a block arrive with nothing introducing it, or a pronoun with no
 * noun behind it?
 *
 * Two shapes, one rule. A fence or a table whose preceding prose neither ends
 * in a colon nor names a direction leaves the reader to infer what they are
 * looking at. A sentence opening on a pronoun whose nearest antecedent is an
 * image, a table, or a code block resolves to the block rather than to a noun.
 *
 * Tier 3 rather than a check because both shapes have legitimate forms a
 * pattern cannot separate. A heading directly above a block often names it
 * completely, and a pronoun after a screenshot is fine when the noun sits in
 * the sentence before the image. Only a reader can tell.
 *
 * Capped at one candidate per line, because the judge is billed per sentence.
 */
function unanchoredBlockReference(doc) {
  const out = [];
  const seen = new Set();

  const emit = ({ line, signal, evidence, decide }) => {
    if (seen.has(line)) return;
    seen.add(line);
    const section = [...doc.sections].reverse().find((s) => s.line <= line);
    out.push(
      makeCandidate({
        ruleIds: ['C3-25'],
        generator: 'unanchoredBlockReference',
        doc,
        line,
        section: section ? section.text : null,
        signal,
        evidence,
        decide,
      })
    );
  };

  for (let line = doc.bodyStartLine; line <= doc.totalLines; line++) {
    const raw = String(doc.lines[line - 1]);
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const inFence = Boolean(doc.inFenceMask[line]);
    const opensFence = inFence && !doc.inFenceMask[line - 1];
    const prev = previousContentLine(doc, line);
    if (!prev) continue;
    const prevRaw = String(doc.lines[prev - 1]);
    const prevTrimmed = prevRaw.trim();

    // Shape one: a block opens and the prose above it introduces nothing.
    const opensTable = !inFence && /^\|/.test(trimmed) && !/^\|/.test(prevTrimmed);
    if (opensFence || opensTable) {
      const prevIsProse =
        !doc.inFenceMask[prev] && !/^#{1,6}\s/.test(prevTrimmed) && !/^\|/.test(prevTrimmed) && !IMAGE_LINE_RE.test(prevTrimmed);
      if (prevIsProse && !/:\s*$/.test(prevRaw) && !DIRECTION_RE.test(prevTrimmed)) {
        emit({
          line: prev,
          signal: `${opensFence ? 'a code block' : 'a table'} opens at line ${line} and the prose above it neither ends in a colon nor names a direction`,
          evidence: [prevTrimmed.slice(0, 300)],
          decide: 'Does the block that follows arrive without a sentence naming what it is?',
        });
      }
      continue;
    }

    if (inFence) continue;

    // Shape two: a sentence opens on a pronoun and the nearest thing behind it
    // is a block rather than a noun.
    const withoutMarker = trimmed.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
    if (!OPENING_PRONOUN_RE.test(withoutMarker)) continue;
    if (/^#{1,6}\s/.test(trimmed) || /^\|/.test(trimmed)) continue;

    const prevIsBlock = IMAGE_LINE_RE.test(prevTrimmed) || /^\|/.test(prevTrimmed) || Boolean(doc.inFenceMask[prev]);
    if (!prevIsBlock) continue;

    emit({
      line,
      signal: `the sentence opens on "${withoutMarker.split(/\s+/)[0]}" and the nearest line above it is ${IMAGE_LINE_RE.test(prevTrimmed) ? 'an image' : 'a block'}`,
      evidence: [sentencesOf(withoutMarker)[0].slice(0, 300)],
      decide: 'Does this pronoun resolve to a block rather than to a noun the reader has just read?',
    });
  }

  return out;
}

// --- C3-26: a lead-in that introduces a block without naming it --------------

/**
 * Nouns that name a document element. A lead-in carrying one of these has told
 * the reader what they are about to look at, which is all this rule asks for.
 * Restricted to element nouns on purpose: a subject noun such as "places" or
 * "value" names what the sentence is about, not what follows it, so widening
 * this list into general vocabulary would exempt the exact defect the rule
 * exists for ("Several places can set the same value. The highest one wins:").
 */
const ELEMENT_NOUN_RE =
  /\b(tables?|lists?|columns?|rows?|steps?|urls?|links?|commands?|examples?|snippets?|blocks?|code|outputs?|messages?|errors?|formats?|payloads?|parameters?|arguments?|fields?|options?|sections?|diagrams?|entries|entry|responses?|requests?|files?|settings?|screens?|tabs?|dialog|text|order|sequence|paragraphs?|cases?|rules?)\b/i;

/**
 * A markdown link. A lead-in that links its target has named it more precisely
 * than any noun could, so the link alone satisfies the rule.
 */
const LINK_RE = /\[[^\]]+\]\([^)]+\)/;

/**
 * A numeral modifying a plural noun, as in "three components" or "50 values".
 * The rule asks the lead-in to name OR count what follows, and a count answers
 * "how much of this is there" even when the noun is not a document element. A
 * vague quantifier is deliberately absent: "several places" is the defect, and
 * C3-17 owns it.
 *
 * "one" is excluded on purpose. Nothing plural follows it, so it can only match
 * a numeral against a verb, and the one place it did was "the highest one wins"
 * in the very sentence this rule was written for.
 */
const COUNT_RE = /\b(two|three|four|five|six|seven|eight|nine|ten|\d+)\s+[a-z]+s\b/i;

/** A colon at the end of the line, allowing trailing whitespace. The declared lead-in. */
const COLON_LEAD_IN_RE = /:\s*$/;

/** A bullet or a numbered step. Either one opens a structure a lead-in points at. */
const STRUCTURE_LIST_RE = /^\s*(?:[-*+]\s|\d+[.)]\s)/;

/** A table row. Mirrors checks/vague-reference.js rather than importing it, to keep this module dependency-free. */
const STRUCTURE_TABLE_RE = /^\s*\|/;

/** The nearest line after `lineNo` that carries content. Returns 0 past the end, which every caller reads as "nothing follows". */
function nextContentLine(doc, lineNo) {
  for (let n = lineNo + 1; n <= doc.totalLines; n++) {
    if (String(doc.lines[n - 1]).trim() !== '') return n;
  }
  return 0;
}

/**
 * C3-26: does a lead-in introduce a block without naming or locating it?
 *
 * The sibling rules are keyed on vocabulary. C3-24 fires on a demonstrative
 * from data/vague-reference/*.json, and C3-17 on a vague quantifier. A lead-in
 * can fail while using neither, and the case that produced this rule did:
 * "Several places can set the same value. The highest one wins:" above a
 * numbered list matched no wordlist in the corpus, because the defect is that
 * nothing in the sentence names the list, not that a particular word appears.
 * So the signal here is structural and the test is for an absence.
 *
 * Two narrowings carry the whole precision budget:
 *
 *   Only a line ending in a colon whose next content line opens a fence, a
 *   table, or a list counts. That is a lead-in the writer declared, which keeps
 *   this rule disjoint from C3-25, whose subject is a block arriving with no
 *   lead-in at all.
 *
 *   Only the final sentence of the line is tested. The pointer has to sit in
 *   the clause that touches the colon. Testing the whole line would let a
 *   subject noun several clauses back stand in for a pointer, and "the same
 *   value" would then exempt the sentence this rule was written to catch.
 *
 * Tier 3 because the absence of a pointer is not the same as a reader being
 * lost. "This app serves:" above three bullets names nothing and reads fine.
 * Only a reader can tell those apart, so the judge decides and this generator
 * only narrows where to look.
 */
function unnamedLeadInReferent(doc) {
  const out = [];

  for (let line = doc.bodyStartLine; line <= doc.totalLines; line++) {
    if (doc.inFenceMask[line]) continue;

    const raw = String(doc.lines[line - 1]);
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (!COLON_LEAD_IN_RE.test(raw)) continue;
    if (/^#{1,6}\s/.test(trimmed) || STRUCTURE_TABLE_RE.test(trimmed)) continue;

    const next = nextContentLine(doc, line);
    if (!next) continue;
    const nextRaw = String(doc.lines[next - 1]);
    const opensStructure =
      Boolean(doc.inFenceMask[next]) || STRUCTURE_TABLE_RE.test(nextRaw) || STRUCTURE_LIST_RE.test(nextRaw);
    if (!opensStructure) continue;

    // Tested on the code-stripped text so an identifier inside a code span
    // cannot supply the pointer, but reported from the raw text, because the
    // judge reads the sentence the writer wrote and a blanked identifier makes
    // it unreadable.
    const prose = stripNonProse(trimmed).replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
    const lastSentence = sentencesOf(prose).pop() || prose;
    if (!lastSentence) continue;

    const hasPointer =
      DIRECTION_RE.test(lastSentence) ||
      ELEMENT_NOUN_RE.test(lastSentence) ||
      COUNT_RE.test(lastSentence) ||
      LINK_RE.test(trimmed);
    if (hasPointer) continue;

    const rawProse = trimmed.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
    const rawSentence = sentencesOf(rawProse).pop() || rawProse;

    const section = [...doc.sections].reverse().find((s) => s.line <= line);
    out.push(
      makeCandidate({
        ruleIds: ['C3-26'],
        generator: 'unnamedLeadInReferent',
        doc,
        line,
        section: section ? section.text : null,
        signal: `the lead-in ends in a colon above ${doc.inFenceMask[next] ? 'a code block' : STRUCTURE_TABLE_RE.test(nextRaw) ? 'a table' : 'a list'} at line ${next}, and its final clause names no direction, no element, and no link`,
        evidence: [rawSentence.slice(0, 300)],
        decide: 'Does the reader reach the colon without knowing what the block that follows contains?',
      })
    );
  }

  return out;
}

/**
 * C2-09: a run of paragraphs under one heading that signal no relation to each
 * other.
 *
 * The gate is checks/paragraph-cohesion.js, imported rather than restated, so
 * the tier-2 finding a writer sees in the editor and the question the judge
 * answers are always about the same sections. Two copies of the gate would
 * drift, and a writer chasing a finding that the judge never receives is worse
 * than no finding at all.
 *
 * Unlike every other rule here, C2-09 has two valid repairs. The candidate
 * therefore asks which one applies rather than whether the section is wrong,
 * and the judge answers with a fixKind.
 */
function paragraphCohesion(doc) {
  const out = [];

  for (const section of doc.sections) {
    if (section.level < 2) continue;

    const paragraphs = sectionParagraphs(doc, section);
    const result = cohesionSignal(paragraphs);
    if (!result) continue;

    out.push(
      makeCandidate({
        ruleIds: ['C2-09'],
        generator: 'paragraphCohesion',
        doc,
        line: paragraphs[0].startLine,
        endLine: paragraphs[paragraphs.length - 1].endLine,
        section: section.text,
        signal: result.signal,
        // The opening sentence of each paragraph, which is where the relation
        // to the paragraph above is either carried or missing.
        evidence: paragraphs.map((p) => `L${p.startLine}: ${sentences(p.text)[0] || p.text}`.slice(0, 300)),
        decide:
          'Do these paragraphs leave the reader to work out how each one follows the one above, either because they are separate sub-topics with no bolded lead-in or because they are one argument with its connectives missing?',
      })
    );
  }

  return out;
}

const GENERATORS = [
  headingAccuracy,
  houseVerbTone,
  missingDestination,
  falseContrast,
  repeatedFact,
  circledConcept,
  gerundSubjectActor,
  overviewOpenerTopicFirst,
  hoverIconBoldLabel,
  enumerationCompleteness,
  vagueQuantifier,
  headingProductOutput,
  defectFraming,
  internalDisclosure,
  tableAdjacentBlock,
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
  unanchoredBlockReference,
  unnamedLeadInReferent,
  paragraphCohesion,
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
