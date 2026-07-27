'use strict';

const { makeFinding } = require('../lib/report');

const CALLOUT_RE = /^\s*(\*\*)?(ATTENTION|Required|Note|Additional Resource)(\*\*)?\s*:/i;
const ASYNC_MARKER_RE = /\bawait\b|\.then\s*\(/;
const TRY_RE = /\btry\s*\{/;

/** Duplicate link targets across the doc, outside a single Prerequisites-repeat exception. */
function checkDuplicateLinks(doc) {
  const findings = [];
  const byUrl = new Map();
  for (const link of doc.links) {
    if (!byUrl.has(link.url)) byUrl.set(link.url, []);
    byUrl.get(link.url).push(link);
  }
  for (const [url, occurrences] of byUrl) {
    if (occurrences.length > 1) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C5-04',
          checkId: 'duplicate-links',
          line: occurrences[0].line,
          message: `Link target "${url}" appears ${occurrences.length} times (lines ${occurrences.map((o) => o.line).join(', ')}).`,
          falsePositiveNote: 'Repeats in Prerequisites reminders or long docs may be intentional per C5-04\'s exception.',
        })
      );
    }
  }
  return findings;
}

/** Prerequisites bullets with no link at all. */
function checkPrerequisitesLinks(doc) {
  const findings = [];
  const prerequisites = doc.findSection(['Prerequisites']);
  if (!prerequisites) return findings;

  const items = doc.listItemsInRange(prerequisites.line + 1, prerequisites.endLine);
  const links = doc.linksInRange(prerequisites.line + 1, prerequisites.endLine);
  for (const item of items) {
    const hasLink = links.some((l) => l.line === item.line);
    if (!hasLink) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C1-04',
          checkId: 'prerequisites-links',
          line: item.line,
          section: 'Prerequisites',
          message: `Prerequisites item has no link: "${item.text.slice(0, 80)}"`,
          falsePositiveNote: 'May be an environment fact that does not require a link per C1-04\'s exception.',
        })
      );
    }
  }
  return findings;
}

/** Async code fences (await/.then) with no try block. */
function checkTryCatch(doc) {
  const findings = [];
  for (const fence of doc.codeFences) {
    if (!/^(js|jsx|ts|tsx|javascript|typescript)$/i.test(fence.lang)) continue;
    const body = doc.rawText(fence.start + 1, fence.end - 1);
    if (ASYNC_MARKER_RE.test(body) && !TRY_RE.test(body)) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C4-05',
          checkId: 'try-catch-heuristic',
          line: fence.start,
          message: 'Async code block (await/.then) has no try block.',
          falsePositiveNote: 'Inline single-expression fragments are exempt per C4-05, and .catch() chains are not detected by this heuristic.',
        })
      );
    }
  }
  return findings;
}

/** Near-duplicate top-level sections via word-shingle Jaccard similarity. */
function shingles(text, n = 5) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const result = new Set();
  for (let i = 0; i + n <= words.length; i++) result.add(words.slice(i, i + n).join(' '));
  return result;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function checkDuplicateSections(doc) {
  const findings = [];
  const topLevel = doc.topLevelSections();
  const shingleSets = topLevel.map((s) => shingles(doc.sectionOwnBody(s)));

  for (let i = 0; i < topLevel.length; i++) {
    for (let j = i + 1; j < topLevel.length; j++) {
      const similarity = jaccard(shingleSets[i], shingleSets[j]);
      if (similarity > 0.5) {
        findings.push(
          makeFinding({
            tier: 2,
            ruleId: 'C7-01',
            checkId: 'duplicate-sections',
            line: topLevel[j].line,
            message: `Section "${topLevel[j].text}" is ${Math.round(similarity * 100)}% textually similar to "${topLevel[i].text}", consider referencing instead of duplicating.`,
            falsePositiveNote: 'Sections meant to be read in isolation may intentionally mirror each other per C7-01\'s exception.',
          })
        );
      }
    }
  }
  return findings;
}

/** Frequency of callout-style lines (Note/ATTENTION/Required/Additional Resource) per top-level section. */
function checkCalloutFrequency(doc) {
  const findings = [];
  const topLevel = doc.topLevelSections();
  for (const section of topLevel) {
    const lines = doc.proseLineNumbers(section.line + 1, section.endLine);
    const calloutLines = lines.filter((l) => CALLOUT_RE.test(doc.lines[l - 1]));
    if (calloutLines.length > 1) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C2-05',
          checkId: 'callout-frequency',
          line: calloutLines[0],
          section: section.text,
          message: `Section "${section.text}" has ${calloutLines.length} callouts (lines ${calloutLines.join(', ')}), callouts are reserved for high-stakes warnings.`,
        })
      );
    }
  }
  return findings;
}

/** Migration guides: Type Mapping Reference rows that group multiple identifiers via commas in the old-API cell. */
function checkTypeMappingRowGrouping(doc, docType) {
  const findings = [];
  if (docType !== 'migration-guide') return findings;
  const section = doc.findSection(['Type Mapping Reference']);
  if (!section) return findings;
  const tables = doc.tablesInRange(section.line + 1, section.endLine);
  if (tables.length === 0) return findings;

  const headers = tables[0].headerCells.map((c) => c.trim().toLowerCase());
  const oldApiIdx = headers.findIndex((h) => h.includes('old api'));
  if (oldApiIdx === -1) return findings;

  tables[0].rows.forEach((row, idx) => {
    const cell = row[oldApiIdx] || '';
    if (cell.split(',').length > 1) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'MIG-05',
          checkId: 'type-mapping-row-grouping',
          line: tables[0].startLine + idx + 2,
          section: 'Type Mapping Reference',
          message: `Type Mapping Reference row groups multiple identifiers in one row: "${cell.trim()}"`,
        })
      );
    }
  });
  return findings;
}

/** Migration guides: Main Content subsections without a Before/After pair and no "no prior equivalent" exemption phrase. */
function checkMigrationBeforeAfter(doc, docType) {
  const findings = [];
  if (docType !== 'migration-guide') return findings;
  const mainContent = doc.findSection(['Main Content']);
  if (!mainContent) return findings;

  const subsections = doc.sections.filter(
    (s) => s.level === mainContent.level + 1 && s.line > mainContent.line && s.endLine <= mainContent.endLine
  );
  for (const sub of subsections) {
    const body = doc.rawText(sub.line + 1, sub.endLine).toLowerCase();
    const hasBefore = /\bbefore\b/.test(body);
    const hasAfter = /\bafter\b/.test(body);
    const hasExemption = /no prior equivalent/.test(body);
    if (!hasExemption && (!hasBefore || !hasAfter)) {
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'MIG-03',
          checkId: 'migration-before-after',
          line: sub.line,
          section: sub.text,
          message: `Main Content subsection "${sub.text}" does not clearly show both a Before and an After block.`,
          falsePositiveNote: 'This heuristic looks for the words "before"/"after", it may miss differently-labeled code comparisons.',
        })
      );
    }
  }
  return findings;
}

/** Get Started Guides: Quick Start's final step should contain observable-success language. */
function checkQuickStartVerification(doc, docType) {
  const findings = [];
  if (docType !== 'getting-started') return findings;
  const quickStart = doc.findSection(['Quick Start']);
  if (!quickStart) return findings;

  const items = doc.listItemsInRange(quickStart.line + 1, quickStart.endLine).filter((i) => i.ordered);
  if (items.length === 0) return findings;
  const lastItem = items[items.length - 1];
  const verificationRe = /\breturns?\b|\byou should see\b|\brunning at\b|\bconfirm|\bverif/i;
  if (!verificationRe.test(lastItem.text)) {
    findings.push(
      makeFinding({
        tier: 2,
        ruleId: 'RS2-03',
        checkId: 'quick-start-verification',
        line: lastItem.line,
        section: 'Quick Start',
        message: 'Quick Start\'s final step does not clearly state an observable success outcome.',
        falsePositiveNote: 'This heuristic looks for common verification phrasing, it may miss a valid but differently-worded success state.',
      })
    );
  }
  return findings;
}

function checkHeuristics(doc, docType) {
  return [
    ...checkDuplicateLinks(doc),
    ...checkPrerequisitesLinks(doc),
    ...checkTryCatch(doc),
    ...checkDuplicateSections(doc),
    ...checkCalloutFrequency(doc),
    ...checkTypeMappingRowGrouping(doc, docType),
    ...checkMigrationBeforeAfter(doc, docType),
    ...checkQuickStartVerification(doc, docType),
  ];
}

module.exports = { checkHeuristics };
