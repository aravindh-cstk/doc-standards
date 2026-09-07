'use strict';

const { makeFinding } = require('../lib/report');

const CLI_TYPES = ['cli-command-reference', 'cli-task-runbook', 'cli-module-reference', 'cli-plugin-guide'];

// CLI-C2's mandated flag-table shape: C9's four columns plus the two the CLI
// actually needs. 16 distinct column signatures are in use across the CLI corpus
// today, so this check is the highest-volume finding in the CLI set by design.
// Type and Default are included because 106 of the 167 existing tables already
// carry them and the CLI declares 62 explicit flag defaults in its V2 plugins.
const FLAG_TABLE_COLUMNS = ['flag', 'type', 'required', 'default', 'description', 'notes'];
const FLAG_TABLE_HEADS = ['flag', 'flags', 'option', 'options'];

// A fence opener carrying no language tag. The corpus has 1,782 of these and zero
// tagged fences, so this is reported at tier 2 to keep it out of the error budget.
const BARE_FENCE = /^\s*```\s*$/;

function norm(cell) {
  return String(cell || '').trim().toLowerCase();
}

/** Every table in the doc whose header looks like a flag or option reference. */
function flagTables(doc) {
  return doc.tables.filter((t) => {
    const heads = t.headerCells.map(norm);
    if (heads.length < 2) return false;
    // A flag table names flags in its first column and describes them in another.
    return FLAG_TABLE_HEADS.includes(heads[0]) && heads.some((h) => h.includes('description'));
  });
}

function checkFlagTables(doc) {
  const findings = [];
  for (const table of flagTables(doc)) {
    const heads = table.headerCells.map(norm);
    // Two-column Flag/Description is explicitly allowed by C9's exception.
    if (heads.length === 2) continue;
    const missing = FLAG_TABLE_COLUMNS.filter((col) => !heads.includes(col));
    if (missing.length === 0) continue;
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'CLI-01',
        checkId: 'cli-specific',
        line: table.startLine,
        message:
          `Flag table columns are [${heads.join(' | ')}]. CLI-C2 requires ` +
          `[flag | type | required | default | description | notes]. ` +
          `Missing: ${missing.join(', ')}.`,
      })
    );
  }
  return findings;
}

/**
 * Prerequisites presence AND level. `section-index.js` compares H2 text only, so a
 * Prerequisites heading sitting at H3 or H4 registers as missing rather than as
 * misleveled, and the two need different fixes.
 */
function checkPrerequisites(doc, docType) {
  const findings = [];
  if (docType === 'cli-module-reference') return findings; // MOD3: deliberately has none.

  const heads = doc.headings.filter((h) => /^prerequisites?$/i.test(h.text.trim()));
  if (heads.length === 0) {
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'CLI-02',
        checkId: 'cli-specific',
        message: 'No Prerequisites heading at any level.',
      })
    );
    return findings;
  }

  const top = heads.find((h) => h.level === 2);
  if (!top) {
    const h = heads[0];
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'CLI-03',
        checkId: 'cli-specific',
        line: h.line,
        section: 'Prerequisites',
        message:
          `Prerequisites is at H${h.level}, not H2. It is nested under another section, ` +
          'so the section-order check cannot see it and the right-hand navigation ' +
          (h.level >= 4 ? 'omits it entirely.' : 'buries it.'),
      })
    );
    return findings;
  }

  // Every prerequisite should link to the resource that satisfies it.
  const items = doc.listItemsInRange(top.line + 1, top.endLine);
  const unlinked = items.filter((it) => !/\]\(/.test(it.text || ''));
  if (items.length > 0 && unlinked.length > 0) {
    findings.push(
      makeFinding({
        tier: 2,
        ruleId: 'CLI-04',
        checkId: 'cli-specific',
        line: unlinked[0].line,
        section: 'Prerequisites',
        message:
          `${unlinked.length} of ${items.length} Prerequisites items carry no link to ` +
          'the resource that fulfils them.',
        falsePositiveNote:
          'A bare version requirement such as "Node.js version 22 or later" may ' +
          'legitimately have no link target.',
      })
    );
  }
  return findings;
}

/**
 * CLI-C1. Headings stop at H3 in every CLI doc. The docs platform emits an anchor
 * id and a right-nav entry for H2 and H3 only, so an H4 is unlinkable and absent
 * from the page's own navigation whatever it contains.
 *
 * This deliberately replaces an earlier, narrower version of the check that only
 * flagged H4s naming a command and exempted the facet headings Syntax, Flags,
 * Output and Examples. The exemption is gone: a facet at H4 is still unlinkable,
 * and CMD1 now specifies bold lead-ins for facets rather than headings.
 */
function checkHeadingDepth(doc) {
  const findings = [];
  for (const h of doc.headings) {
    if (h.level < 4) continue;
    findings.push(
      makeFinding({
        tier: 1,
        ruleId: 'CLI-05',
        checkId: 'cli-specific',
        line: h.line,
        message:
          `"${h.text.trim()}" is at H${h.level}. The renderer emits anchor ids for ` +
          'H2 and H3 only, so nothing can deep-link to it and it is absent from the ' +
          'page navigation. Promote it to H3, or convert it to a bold lead-in on its ' +
          'own line if it does not need to be linked to.',
      })
    );
  }
  return findings;
}

function checkFenceLanguage(doc) {
  const bare = [];
  let open = false;
  doc.lines.forEach((line, idx) => {
    if (!/^\s*```/.test(line)) return;
    if (open) {
      open = false; // closing fence, no tag expected
      return;
    }
    open = true;
    if (BARE_FENCE.test(line)) bare.push(idx + 1);
  });
  if (bare.length === 0) return [];
  return [
    makeFinding({
      tier: 2,
      ruleId: 'CLI-06',
      checkId: 'cli-specific',
      line: bare[0],
      message:
        `${bare.length} code fence(s) carry no language tag. Tag shell blocks ` +
        '`bash` and data blocks `json` so they highlight and so readers can tell ' +
        'a command from a payload.',
      falsePositiveNote:
        'Output transcripts and directory trees have no meaningful language tag ' +
        'and can stay bare.',
    }),
  ];
}

/**
 * CMD4, the half a script can see. Whether a plugin is bundled is a fact about
 * `oclif.plugins`, not about the page, so this cannot decide that a doc is missing
 * an Installation section. What it can decide is that a doc telling the reader to
 * run `plugins:install` has buried that instruction outside an Installation
 * section, which is the case that actually loses readers.
 */
function checkInstallPlacement(doc, docType) {
  if (docType !== 'cli-command-reference') return [];
  const body = doc.lines.join('\n');
  if (!/\bplugins:install\b/.test(body)) return [];
  if (doc.findSection(['Installation', 'Install the Plugin'])) return [];

  const line = doc.lines.findIndex((l) => /\bplugins:install\b/.test(l)) + 1;
  return [
    makeFinding({
      tier: 1,
      ruleId: 'CLI-07',
      checkId: 'cli-specific',
      line: line || undefined,
      message:
        'The doc tells the reader to run `plugins:install` but has no Installation ' +
        'section. An install step the reader has to hunt for is an install step they ' +
        'skip, and the command then fails as "command not found".',
    }),
  ];
}

/**
 * CLI-specific checks, self-gating on doc type.
 *
 * Heading depth is gated differently from the rest. CLI-C1 is a fact about the
 * rendering platform rather than about a template, so it binds on any CLI doc,
 * including ones typed `migration-guide`, `feature-doc` or `setup-guide`.
 * `lint-doc.js` passes its own `isCliDoc()` result in as `isCli` so this check can
 * see those docs. The other checks stay scoped to the four CLI types, because
 * each of them restates a rule from a CLI template.
 */
function checkCliSpecific(doc, docType, isCli) {
  const isCliType = CLI_TYPES.includes(docType);
  if (!isCliType && !isCli) return [];

  const findings = [...checkHeadingDepth(doc)];
  if (!isCliType) return findings;

  return [
    ...findings,
    ...checkFlagTables(doc),
    ...checkPrerequisites(doc, docType),
    ...checkInstallPlacement(doc, docType),
    ...checkFenceLanguage(doc),
  ];
}

module.exports = { checkCliSpecific };
