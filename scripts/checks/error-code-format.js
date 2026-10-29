'use strict';

/**
 * C3-11: an HTTP status code or numeric error code written as bare prose.
 *
 * The first version flagged every three-digit number from 100 to 599. On the
 * MCP Profile Hub pages that meant nine findings, eight of them limits such as
 * "200 tools" and "500 profiles", so the one real defect ("Contentstack returned
 * 403") was skipped along with the noise. A check whose hits are mostly wrong
 * teaches the reviewer to ignore it.
 *
 * So a number now counts only in status context: a status word within a few
 * words of it ("HTTP", "status", "error", "returns", "responds with") or a status
 * name right after it ("403 Forbidden"). A number followed by a unit noun or led
 * by a limit phrase is a quantity and is never reported.
 */

const { makeFinding } = require('../lib/report');
const { byId } = require('../lib/rules-registry');

const INLINE_CODE_RE = /`[^`]*`/g;
const HTTP_STATUS_RE = /(?<![\w.:/-])[1-5][0-9]{2}(?![\w%]|[.,]\d)/g;
const STATUS_BEFORE_RE = /\b(?:HTTP|status(?: code)?|code|error|errors|returns?|returned|returning|responds? with|responded with|response|fails? with|failed with|gets?|got)\s+(?:an?\s+|the\s+|code\s+)?$/i;
const STATUS_AFTER_RE = /^\s*(?:\/\s*[1-5][0-9]{2}\s*)?(?:errors?|responses?|status|codes?|OK\b|Created|Accepted|No Content|Moved|Found|Not Modified|Bad Request|Unauthorized|Payment Required|Forbidden|Not Found|Method Not Allowed|Conflict|Gone|Unprocessable|Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\b/;
const QUANTITY_BEFORE_RE = /\b(?:up to|at most|at least|limit of|maximum of|max(?:imum)?|minimum of|more than|fewer than|less than|over|under|of|than|first|last|top|every|each)\s+$/i;
const UNIT_AFTER_RE = /^\s*(?:[a-z]+s\b|ms\b|s\b|sec|min|KB|MB|GB|TB|px|%|characters?|chars?|words?|lines?|items?|rows?|tools?|profiles?|entries|requests?|calls?|users?|members?|seconds?|minutes?|hours?|days?)/i;

/** The bare status codes on a line, with the quantities and other numbers left out. */
function statusCodesIn(line) {
  const bare = String(line).replace(INLINE_CODE_RE, (m) => ' '.repeat(m.length));
  const codes = [];
  for (const m of bare.matchAll(HTTP_STATUS_RE)) {
    const before = bare.slice(Math.max(0, m.index - 40), m.index);
    const after = bare.slice(m.index + m[0].length, m.index + m[0].length + 40);
    // "404 / 401" or "401 or 403": a code joined to a code inherits its context.
    const joinedToCode = /\b[1-5][0-9]{2}\s*(?:\/|,|or|and)\s*$/.test(before) && codes.length > 0;
    if (QUANTITY_BEFORE_RE.test(before) || UNIT_AFTER_RE.test(after)) {
      // "returns 403 errors" is still a status code: a status word before it, or
      // a code it is joined to, wins over an -s noun after it, but never over an
      // explicit limit phrase.
      if (QUANTITY_BEFORE_RE.test(before) || !(STATUS_BEFORE_RE.test(before) || joinedToCode)) continue;
    }
    if (STATUS_BEFORE_RE.test(before) || STATUS_AFTER_RE.test(after) || joinedToCode) codes.push(m[0]);
  }
  return [...new Set(codes)];
}

function checkErrorCodeFormat(doc) {
  const findings = [];
  const tier = byId('C3-11').tier;
  for (let lineNo = doc.bodyStartLine; lineNo <= doc.totalLines; lineNo++) {
    if (doc.inFenceMask[lineNo]) continue;
    const codes = statusCodesIn(doc.lines[lineNo - 1]);
    if (!codes.length) continue;
    findings.push(
      makeFinding({
        tier,
        ruleId: 'C3-11',
        checkId: 'error-code-format',
        line: lineNo,
        message: `Status code(s) not in inline code: ${codes.join(', ')}. Wrap as ${codes.map((c) => `\`${c}\``).join(', ')}.`,
        falsePositiveNote: 'Only a number in status context is reported. A number in a status sentence that is really a count, such as "returned 200 rows", can stay as prose.',
      })
    );
  }
  return findings;
}

module.exports = { checkErrorCodeFormat, statusCodesIn };
