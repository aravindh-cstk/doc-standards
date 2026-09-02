'use strict';

const { makeFinding } = require('../lib/report');

/**
 * Words that mark the surrounding prose (the list's intro line or its nearest
 * heading) as describing a sequence, so a numbered list there is carrying real
 * order: process steps, an event flow, or a ranked precedence chain.
 */
const SEQUENCE_SIGNAL_RE =
  /\b(steps?|in this order|in the order|sequence|sequential|follow|following|precedence|order|ranked|ranking|priority|highest|lowest|wins|stages?|phases?|process|flow|lifecycle|works|happens|authenticat\w*|first|then|finally)\b/i;

/**
 * Verbs a step in Contentstack documentation actually starts with. A numbered
 * list whose items begin with these is an instruction sequence regardless of
 * what the intro line says.
 */
const IMPERATIVE_VERBS = new Set([
  'add', 'adjust', 'apply', 'assign', 'browse', 'call', 'change', 'check', 'choose', 'clear',
  'click', 'clone', 'close', 'collapse', 'complete', 'configure', 'confirm', 'connect', 'copy',
  'create', 'decrease', 'define', 'delete', 'deploy', 'disable', 'download', 'drag', 'drop',
  'duplicate', 'edit', 'enable', 'ensure', 'enter', 'expand', 'export', 'fetch', 'filter',
  'find', 'generate', 'give', 'go', 'grant', 'hover', 'import', 'increase', 'install', 'keep',
  'launch', 'list', 'log', 'modify', 'name', 'navigate', 'note', 'open', 'pause', 'paste',
  'pick', 'publish', 'read', 'reconnect', 'refresh', 'reload', 'remove', 'rename', 'reopen',
  'repeat', 'replace', 'request', 'rerun', 'reset', 'restart', 'restore', 'resume', 'return',
  'review', 'revoke', 'rotate', 'run', 'save', 'scroll', 'search', 'select', 'send', 'set',
  'share', 'sign', 'start', 'stop', 'submit', 'switch', 'test', 'toggle', 'trigger', 'type',
  'unpublish', 'update', 'upload', 'use', 'validate', 'verify', 'wait',
]);

const INLINE_CODE_RE = /`[^`]*`/g;

/** Strips markdown decoration so the first *word* of an item is the first real word. */
function firstWord(text) {
  const plain = text
    .replace(INLINE_CODE_RE, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_>#]/g, '')
    .trim();
  const match = plain.match(/^([A-Za-z][A-Za-z-]*)/);
  return match ? match[1].toLowerCase() : '';
}

/** Hyphenated compounds such as "re-list" and "re-add" are steps too. */
function isImperative(text) {
  const word = firstWord(text);
  if (!word) return false;
  if (IMPERATIVE_VERBS.has(word)) return true;
  const stem = word.replace(/^re-/, '');
  return stem !== word && IMPERATIVE_VERBS.has(stem);
}

/** Groups the top-level ordered items into runs of consecutive list lines. */
function orderedListBlocks(doc) {
  const items = doc.listItems.filter((i) => i.ordered && i.indent === 0 && i.line >= doc.bodyStartLine);
  const blocks = [];
  let current = null;
  for (const item of items) {
    if (current && item.line - current.items[current.items.length - 1].line <= 2) {
      current.items.push(item);
    } else {
      current = { items: [item] };
      blocks.push(current);
    }
  }
  return blocks;
}

/** The list's intro line plus the heading it sits under, the prose that frames the list. */
function contextText(doc, startLine) {
  const parts = [];
  for (let lineNo = startLine - 1; lineNo >= doc.bodyStartLine && lineNo >= startLine - 3; lineNo--) {
    const line = doc.lines[lineNo - 1];
    if (line.trim()) {
      parts.push(line);
      break;
    }
  }
  const heading = [...doc.headings].reverse().find((h) => h.line < startLine);
  if (heading) parts.push(heading.text);
  return parts.join(' ');
}

/**
 * Tier 2: a numbered list claims the items are a sequence. When the items are
 * neither instructions nor an ordered flow, the numbers assert an order the
 * reader then tries and fails to follow, so the list belongs in bullets.
 */
function checkOrderedListSequence(doc) {
  const findings = [];

  for (const block of orderedListBlocks(doc)) {
    if (block.items.length < 2) continue;

    const startLine = block.items[0].line;
    if (SEQUENCE_SIGNAL_RE.test(contextText(doc, startLine))) continue;

    const imperatives = block.items.filter((i) => isImperative(i.text)).length;
    if (imperatives * 2 >= block.items.length) continue;

    findings.push(
      makeFinding({
        tier: 2,
        ruleId: 'C3-14',
        checkId: 'ordered-list-sequence',
        line: startLine,
        message: `Numbered list of ${block.items.length} items reads as a set, not a sequence: no item starts with an instruction verb and the intro does not name an order. Use an unordered list.`,
        falsePositiveNote:
          'Keep the numbers when the order is real: process steps, an event flow the reader follows in order, or a ranked list such as precedence. Naming the order in the intro line ("in this order", "the highest one wins") both fixes the reader\'s problem and clears this flag.',
      })
    );
  }

  return findings;
}

module.exports = { checkOrderedListSequence };
