#!/usr/bin/env node
'use strict';

/**
 * Link and 404 checker for the docs corpus.
 *
 * Nothing in either repo checks a Markdown link. What exists checks something
 * else:
 *
 *   studio-docs/scripts/lint-links.ts audits generated HTML under docs/dist/,
 *   which does not exist until `npm run build:rte` has run, and cannot map a
 *   failure back to a source line.
 *
 *   fix/repair-anchors.js --audit handles anchors well, but its pattern
 *   requires a literal "#", so all 2,785 plain relative links are invisible to
 *   it. That is where 42 of the 83 known breaks live.
 *
 * Three layers, because they fail for different reasons and cost different
 * amounts to run:
 *
 *   internal  filesystem and heading-slug resolution. No network, fast enough
 *             for CI on every commit. This is 95 percent of the link surface.
 *   external  HTTP liveness for absolute URLs. Slow, flaky, needs a cache and
 *             a skiplist, so it is opt-in.
 *   cms       every `url:` front-matter value has a published entry at that
 *             url. Needs credentials. This is the layer that catches a
 *             navigation entry pointing at a page that was never published,
 *             which is what a reader experiences as a 404.
 *
 * Usage:
 *   node check-links.js <dir>...                        # internal only
 *   node check-links.js <dir>... --layers=internal,external
 *   node check-links.js <dir>... --layers=cms --env=production
 *   node check-links.js <dir>... --format=json --out=links.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const { collectDocs } = require('./sweep-docs');
const { slugifyVariants } = require('./lib/slugify');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CACHE_PATH = path.join(REPO_ROOT, '.doc-review', 'link-cache.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EXTERNAL_CONCURRENCY = 6;
const EXTERNAL_TIMEOUT_MS = 15000;

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
      out.push({ file, line: lineNo, target: m[3], label: m[2], image: m[1] === '!' });
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

// ---------------------------------------------------------------------------
// Layer 1: internal
// ---------------------------------------------------------------------------

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

function checkInternal(files) {
  const corpus = new Set(files.map((f) => path.resolve(f)));
  const anchorCache = new Map();
  const anchorsFor = (f) => {
    const key = path.resolve(f);
    if (!anchorCache.has(key)) {
      anchorCache.set(key, fs.existsSync(key) ? anchorsIn(key) : new Set());
    }
    return anchorCache.get(key);
  };

  const findings = [];
  const counts = { relative: 0, 'same-page': 0, external: 0, scheme: 0, images: 0, html: 0 };

  for (const file of files) {
    for (const link of linksIn(file)) {
      const kind = classify(link.target);
      counts[kind] = (counts[kind] || 0) + 1;
      if (link.image) counts.images += 1;
      if (link.html) counts.html += 1;
      if (kind === 'external' || kind === 'scheme') continue;

      const [rawPath, fragment] = splitFragment(link.target);

      // Same-page anchor: the path half is empty.
      const targetFile = rawPath === '' ? file : path.resolve(path.dirname(file), rawPath);

      if (rawPath !== '' && !fs.existsSync(targetFile)) {
        findings.push({
          ...link,
          kind: 'missing-file',
          message: `target does not exist on disk: ${link.target}`,
        });
        continue;
      }

      if (rawPath !== '' && fs.statSync(targetFile).isDirectory()) {
        // A directory that exists resolves. Several links point at a source
        // directory for browsing, such as `../../scripts/` or
        // `../../skills/src/`, and those are meant to be read on the repo host
        // rather than served as a page. Requiring an index.md reported all four
        // as broken when the directory is right there.
        continue;
      }

      if (!fragment) continue;

      // An anchor into a file outside the corpus cannot be resolved, and saying
      // so is more honest than reporting it dead.
      if (!corpus.has(path.resolve(targetFile)) && rawPath !== '') {
        findings.push({
          ...link,
          kind: 'unresolvable-anchor',
          message: `anchor points into a file outside the scanned corpus: ${link.target}`,
        });
        continue;
      }

      if (!anchorsFor(targetFile).has(decodeURIComponent(fragment))) {
        findings.push({
          ...link,
          kind: 'dead-anchor',
          message: `no heading in ${path.basename(targetFile)} produces the anchor "#${fragment}"`,
        });
      }
    }
  }

  return { findings, counts };
}

function splitFragment(target) {
  const at = target.indexOf('#');
  if (at === -1) return [target, ''];
  return [target.slice(0, at), target.slice(at + 1)];
}

// ---------------------------------------------------------------------------
// Layer 2: external
// ---------------------------------------------------------------------------

function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    return raw && raw.version === 1 ? raw : { version: 1, entries: {} };
  } catch {
    return { version: 1, entries: {} };
  }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

/** HEAD, then GET if the host refuses HEAD, which several CDNs do. */
function probe(url) {
  return new Promise((resolve) => {
    const attempt = (method, redirectsLeft) => {
      let settled = false;
      const done = (result) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };
      let req;
      try {
        const lib = url.startsWith('https:') ? https : http;
        req = lib.request(
          url,
          { method, timeout: EXTERNAL_TIMEOUT_MS, headers: { 'user-agent': 'doc-standards-link-check' } },
          (res) => {
            const { statusCode, headers } = res;
            res.resume();
            if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location && redirectsLeft > 0) {
              try {
                url = new URL(headers.location, url).toString();
              } catch {
                return done({ status: statusCode, note: 'bad redirect target' });
              }
              return attempt('HEAD', redirectsLeft - 1);
            }
            if ((statusCode === 405 || statusCode === 403 || statusCode === 501) && method === 'HEAD') {
              return attempt('GET', redirectsLeft);
            }
            return done({ status: statusCode });
          }
        );
      } catch (err) {
        return done({ status: 0, note: err.message });
      }
      req.on('timeout', () => {
        req.destroy();
        done({ status: 0, note: 'timeout' });
      });
      req.on('error', (err) => done({ status: 0, note: err.code || err.message }));
      req.end();
    };
    attempt('HEAD', 4);
  });
}

async function checkExternal(files) {
  const cache = loadCache();
  const now = Date.now();
  const byUrl = new Map();

  for (const file of files) {
    for (const link of linksIn(file)) {
      if (classify(link.target) !== 'external') continue;
      if (isUnresolvableHost(link.target)) continue;
      if (!byUrl.has(link.target)) byUrl.set(link.target, []);
      byUrl.get(link.target).push(link);
    }
  }

  const urls = [...byUrl.keys()];
  const findings = [];
  let checked = 0;
  let fromCache = 0;

  const queue = urls.slice();
  const workers = Array.from({ length: Math.min(EXTERNAL_CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift();
      const hit = cache.entries[url];
      let result;
      if (hit && now - hit.at < CACHE_TTL_MS) {
        result = hit;
        fromCache += 1;
      } else {
        result = { ...(await probe(url)), at: now };
        cache.entries[url] = result;
        checked += 1;
      }
      const ok = result.status >= 200 && result.status < 400;
      if (!ok) {
        for (const link of byUrl.get(url)) {
          findings.push({
            ...link,
            kind: result.status === 0 ? 'unreachable' : `http-${result.status}`,
            message: `${url} returned ${result.status || 'no response'}${result.note ? ` (${result.note})` : ''}`,
          });
        }
      }
    }
  });

  await Promise.all(workers);
  saveCache(cache);
  return { findings, stats: { urls: urls.length, checked, fromCache } };
}

// ---------------------------------------------------------------------------
// Layer 3: CMS
// ---------------------------------------------------------------------------

/**
 * Every public url the corpus declares, checked against what the CMS actually
 * serves.
 *
 * This is the layer that catches the 404s a reader hits. The navigation lists
 * 86 articles against 169 declared urls, so half the corpus is reachable only
 * by direct link, and a page that never got published is indistinguishable from
 * a typo until someone reads the entry back.
 *
 * Read-only. It resolves the entry list through the same helper the export
 * script uses, so it cannot write and needs no new credentials handling.
 */
async function checkCms(files, { environment }) {
  let listEntries;
  try {
    ({ listEntries } = require(path.join(REPO_ROOT, 'scripts', 'lib', 'contentstack.js')));
  } catch (err) {
    return {
      findings: [],
      stats: { skipped: true, reason: `cannot load the CMA client: ${err.message}` },
    };
  }
  if (typeof listEntries !== 'function') {
    return {
      findings: [],
      stats: {
        skipped: true,
        reason: 'the CMA client does not export listEntries, so this layer needs wiring to it',
      },
    };
  }

  const declared = new Map();
  for (const file of files) {
    const url = publicUrlOf(file);
    if (url) declared.set(url, file);
  }

  let entries;
  try {
    entries = await listEntries('docs_article');
  } catch (err) {
    return { findings: [], stats: { skipped: true, reason: `CMA request failed: ${err.message}` } };
  }

  const live = new Map();
  for (const e of entries) if (e.url) live.set(e.url, e);

  const findings = [];
  for (const [url, file] of declared) {
    const entry = live.get(url);
    if (!entry) {
      findings.push({
        file,
        line: 1,
        target: url,
        kind: 'no-cms-entry',
        message: `no docs_article entry has url "${url}", so the public page 404s`,
      });
      continue;
    }
    if (environment) {
      const published = (entry.publish_details || []).some((p) => p.environment === environment);
      if (!published) {
        findings.push({
          file,
          line: 1,
          target: url,
          kind: 'not-published',
          message: `entry ${entry.uid} exists but is not published to ${environment}`,
        });
      }
    }
  }

  return { findings, stats: { declared: declared.size, live: live.size } };
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { targets: [], layers: ['internal'], format: 'text', out: null, environment: null };
  for (const arg of argv) {
    if (arg.startsWith('--layers=')) args.layers = arg.split('=')[1].split(',');
    else if (arg.startsWith('--format=')) args.format = arg.split('=')[1];
    else if (arg.startsWith('--out=')) args.out = arg.split('=')[1];
    else if (arg.startsWith('--env=')) args.environment = arg.split('=')[1];
    else if (!arg.startsWith('--')) args.targets.push(arg);
  }
  return args;
}

function rel(p) {
  return path.relative(process.cwd(), p);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.targets.length) {
    console.error(
      'Usage: check-links.js <dir>... [--layers=internal,external,cms] [--env=staging] [--format=text|json] [--out=file]'
    );
    process.exit(2);
  }

  const files = [...new Set(args.targets.flatMap((t) => collectDocs(path.resolve(t))))].sort();
  const report = { files: files.length, layers: {}, findings: [] };

  if (args.layers.includes('internal')) {
    const { findings, counts } = checkInternal(files);
    report.layers.internal = counts;
    report.findings.push(...findings.map((f) => ({ ...f, layer: 'internal' })));
  }
  if (args.layers.includes('external')) {
    const { findings, stats } = await checkExternal(files);
    report.layers.external = stats;
    report.findings.push(...findings.map((f) => ({ ...f, layer: 'external' })));
  }
  if (args.layers.includes('cms')) {
    const { findings, stats } = await checkCms(files, { environment: args.environment });
    report.layers.cms = stats;
    report.findings.push(...findings.map((f) => ({ ...f, layer: 'cms' })));
  }

  if (args.format === 'json') {
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (args.out) fs.writeFileSync(args.out, json);
    else process.stdout.write(json);
  } else {
    console.log(`files scanned      ${report.files}`);
    if (report.layers.internal) {
      const c = report.layers.internal;
      console.log(
        `links              ${c.relative} relative, ${c['same-page']} same-page, ${c.external} external, ${c.scheme} other`
      );
      console.log(`  of which        ${c.images} images, ${c.html} HTML anchors`);
    }
    if (report.layers.external) {
      const s = report.layers.external;
      console.log(`external URLs      ${s.urls} distinct, ${s.checked} probed, ${s.fromCache} from cache`);
    }
    if (report.layers.cms) {
      const s = report.layers.cms;
      if (s.skipped) console.log(`cms layer          skipped: ${s.reason}`);
      else console.log(`cms                ${s.declared} declared urls against ${s.live} live entries`);
    }

    const byKind = {};
    for (const f of report.findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
    console.log('');
    console.log(`problems           ${report.findings.length}`);
    for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${k}`);
    }
    if (report.findings.length) {
      console.log('');
      for (const f of report.findings) {
        console.log(`${rel(f.file)}:${f.line}  [${f.kind}] ${f.message}`);
      }
    }
  }

  process.exitCode = report.findings.length ? 1 : 0;
}

if (require.main === module) main();

module.exports = {
  linksIn,
  anchorsIn,
  publicUrlOf,
  classify,
  isUnresolvableHost,
  checkInternal,
  splitFragment,
  fenceMask,
};
