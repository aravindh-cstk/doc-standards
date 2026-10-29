'use strict';

/**
 * C8-10, tier 2: an absolute claim about what the product does.
 *
 * The MCP Profile Hub review shipped a draft that said a system profile needed
 * no app and that Contentstack needed nothing else to run it. Neither claim had
 * a source, and the reviewer's ruling was to remove an ambiguous claim and to
 * rewrite one that turns out inaccurate. A wordlist can find the absolutes, but
 * only a reader with the source can tell a verified fact from a promise, so the
 * finding is advisory and every hit is also a judge candidate (generator
 * overPromise in tier3-candidates.js).
 */

const path = require('path');
const { makeFinding } = require('../lib/report');
const { loadPhraseList, scanDoc } = require('../lib/phrase-list');

const DATA_DIR = path.join(__dirname, '..', 'data', 'over-promise');

function checkOverPromise(doc) {
  const findings = [];
  const reported = new Set();
  scanDoc(doc, loadPhraseList(DATA_DIR), {
    onMatch: ({ error, entry, line, matched }) => {
      if (error) {
        findings.push(makeFinding({ tier: 2, ruleId: 'C8-10', checkId: 'over-promise', line, message: error }));
        return;
      }
      if (reported.has(line)) return;
      reported.add(line);
      findings.push(
        makeFinding({
          tier: 2,
          ruleId: 'C8-10',
          checkId: 'over-promise',
          line,
          message: `Absolute claim "${entry.label || matched}". Fix: ${entry.fix}.`,
          falsePositiveNote:
            'An absolute that a cited source confirms can stay, stated as the concrete fact. If no source confirms it, remove it. If a source contradicts it, rewrite it to the accurate statement.',
        })
      );
    },
  });
  return findings;
}

module.exports = { checkOverPromise, DATA_DIR };
