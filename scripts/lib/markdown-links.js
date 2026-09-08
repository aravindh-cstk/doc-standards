'use strict';

/**
 * One definition of how a Markdown link is read off a page.
 *
 * check-links.js owned all of this, and checks/link-label-fidelity.js needs
 * exactly the same extraction to compare a label against its destination.
 * Requiring it back from check-links.js made a cycle, and the cycle was not
 * theoretical: `--layers=labels` threw "linksIn is not a function" on its first
 * run, because check-links.js invokes main() before it assigns module.exports,
 * so the partial exports object a circular require sees is empty.
 *
 * Same remedy as lib/prose-mask.js, lib/table-shape.js and lib/slugify.js: the
 * shared definition moves down into lib/ and both callers import it, rather
 * than one caller importing the other. check-links.js re-exports these names so
 * its own documented surface is unchanged.
 */

const fs = require('fs');
const { slugifyVariants } = require('./slugify');

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Fence mask, computed here rather than through DocModel because this tool
 * reads front matter too and wants the raw lines either way.
 */
function fenceMask(lines) {
  const mask = new Array(lines.length + 1).fill(false);
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line.replace(/^(\s*>)+\s?/, ''))) {
      mask[i + 1] = true;
      inFence = !inFence;
      return;
    }
    mask[i + 1] = inFence;
  });
  return mask;
}

/**
 * Nested-bracket-aware link pattern.
 *
 * A label can itself contain brackets, which this corpus does: one alt text is
 * `[[...slug]]`, two levels of nesting. A naive `\[([^\]]*)\]` stops at the
 * first close and misreads the target.
 */
const LINK_RE =
  /(!?)\[((?:[^[\]]|\[[^[\]]*\])*)\]\(([^()\s]*(?:\([^()]*\)[^()\s]*)*)\s*(?:"[^"]*")?\)/g;
const HTML_HREF_RE = /<a\s[^>]*href\s*=\s*"([^"]*)"/gi;
const HEADING_RE = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const FRONT_URL_RE = /^url:\s*(.+)$/;

/** Every link in one file, with enough context to resolve it. */
function linksIn(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const mask = fenceMask(lines);
  const out = [];

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (mask[lineNo]) return;

    // Code spans are blanked first, because a link written inside one is
    // example syntax rather than a link. This corpus documents markdown image
    // syntax as `![alt](./path.png)` in a table cell and shows a hardcoded nav
    // as `<li><a href="/deals">Deals</a></li>`. Resolving either reports a
    // broken link against something that was never meant to resolve.
    //
    // Only code spans, not the full prose mask: that one blanks `](target)`
    // itself, which is the very thing being extracted.
    const scan = line.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));

    LINK_RE.lastIndex = 0;
    for (const m of scan.matchAll(LINK_RE)) {
      // `label` comes from the scanned line, where code spans are blanked, so a
      // label written as `` `design-component-library` `` reads as spaces.
      // That is right for resolving a target and wrong for reading a label, so
      // `rawLabel` carries the same span cut from the untouched line. Blanking
      // preserves length, so the offsets line up exactly.
      const labelStart = m.index + m[1].length + 1;
      out.push({
        file,
        line: lineNo,
        target: m[3],
        label: m[2],
        rawLabel: line.slice(labelStart, labelStart + m[2].length),
        image: m[1] === '!',
      });
    }
    HTML_HREF_RE.lastIndex = 0;
    for (const m of scan.matchAll(HTML_HREF_RE)) {
      out.push({ file, line: lineNo, target: m[1], label: '', image: false, html: true });
    }
  });

  return out;
}

/** Every anchor a heading in this file can be reached by. */
function anchorsIn(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const mask = fenceMask(lines);
  const set = new Set();
  lines.forEach((line, i) => {
    if (mask[i + 1]) return;
    const m = line.match(HEADING_RE);
    if (m) for (const v of slugifyVariants(m[2])) set.add(v);
  });
  // Explicit anchor targets, which a heading slug cannot produce.
  const text = lines.join('\n');
  for (const m of text.matchAll(/<a\s[^>]*(?:name|id)\s*=\s*"([^"]*)"/gi)) set.add(m[1]);
  for (const m of text.matchAll(/\{#([^}]+)\}/g)) set.add(m[1]);
  return set;
}

/** The `url:` front-matter value, which is the page's public path. */
function publicUrlOf(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  if (lines[0].trim() !== '---') return null;
  for (let i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
    const m = lines[i].match(FRONT_URL_RE);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}


function splitFragment(target) {
  const at = target.indexOf('#');
  if (at === -1) return [target, ''];
  return [target.slice(0, at), target.slice(at + 1)];
}


/**
 * Hosts that are not real hosts.
 *
 * 381 of the 417 `http(s)://` occurrences in this corpus are bare or inside a
 * code sample: `localhost:5173`, `<cma-host>`, `${req.headers.host}`. Resolving
 * them produces roughly 380 false 404s, which is more noise than the 36 real
 * absolute links are worth.
 */
function isUnresolvableHost(url) {
  return (
    /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url) ||
    /[<>]/.test(url) ||
    /\$\{/.test(url) ||
    /\bexample\.(com|org|net)\b/.test(url) ||
    /\byour(site|domain|app|-)/.test(url)
  );
}

function classify(target) {
  if (/^https?:\/\//i.test(target)) return 'external';
  if (/^(mailto|tel|data|javascript):/i.test(target)) return 'scheme';
  if (target.startsWith('//')) return 'external';
  if (target.startsWith('#')) return 'same-page';
  return 'relative';
}

module.exports = {
  fenceMask,
  linksIn,
  anchorsIn,
  publicUrlOf,
  isUnresolvableHost,
  classify,
  splitFragment,
  LINK_RE,
  HTML_HREF_RE,
  HEADING_RE,
  FRONT_URL_RE,
};
