#!/usr/bin/env node
/* Static build of the Night Feed deck: slides/ -> dist/, ready for a dumb
   static origin (deploy/compose.yml serves dist/ behind a cloudflared
   tunnel).

   The dev deck is server-driven: deck.js asks /api/slides for the fragment
   list, fetches each one, and holds an SSE stream open for live reload. None
   of that survives a static host, so this build:
     - inlines the 15 fragments into #stage, each keeping its data-src
       (deck.js sees them and skips both the fetch and the SSE stream);
       the .notes asides ride along, which is the whole of the published
       notes panel: it is public, read-only, and needs no server,
     - drops HTML comments and CSS/JS comments,
     - bundles the elements/*.css @import chain into one minified file and
       minifies deck.js,
     - content-hashes every asset, so index.html can be no-cache while the
       assets are immutable for a year,
     - emits sw.js, a service worker precaching the whole deck so one online
       visit keeps it presentable offline,
     - renders og.png (link previews) from the built deck itself, which
       doubles as a smoke test that dist/ actually runs.

   The same fragment baking also feeds the portable build (--portable), which
   emits one self-contained portable/tgdataset2-deck.html: CSS, JS, fonts and
   wallpaper inlined as data: URIs, so the file opens from a USB stick over
   file:// with no server, no network and no Node. It shares every helper here
   so the baking cannot drift; deck.js sees data-portable on #stage and drops
   the service worker.

   Usage: node deploy/build.mjs        (or: npm --prefix deploy run build)
          node deploy/build.mjs --portable
   Env:   SITE_URL=https://deck.example.com   SKIP_OG=1   PORTABLE=1 */
'use strict';

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'slides');
const OUT = path.join(ROOT, 'dist');
const PORTABLE_OUT = path.join(ROOT, 'portable');
const PORTABLE = process.argv.includes('--portable') || !!process.env.PORTABLE;
const SITE_URL = (process.env.SITE_URL || 'https://deck.example.com').replace(/\/$/, '');

const TITLE = "Making Telegram's Content Dynamics Observable";
const DESC = 'A Telegram corpus that catches edits, deletions and restrictions. Bachelor thesis defense.';

/* ---------- html ----------
   No rule in the design system sets white-space: pre (the scraper-log device
   uses <i> lines and &nbsp;), so collapsing every whitespace run to a single
   space is exactly what the browser would have rendered anyway. Deleting the
   space outright would not be: it is significant between inline elements. */
const collapse = (s) => s.replace(/[ \t\r\n]+/g, ' ');
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

/* Keep <script>/<style> bodies out of the whitespace pass. The marker is
   NUL-delimited so the collapse leaves it alone; unlike a bare number, it
   cannot collide with slide text that happens to be a number. */
function minifyHtml(html) {
  const held = [];
  const parked = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => {
    held.push(m);
    return `\0${held.length - 1}\0`;
  });
  return collapse(stripComments(parked))
    .replace(/\0(\d+)\0/g, (_, i) => held[+i])
    .trim();
}

async function minifyInlineScripts(html) {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  let out = html;
  for (const [whole, code] of blocks) {
    const { code: min } = await esbuild.transform(code, { minify: true, loader: 'js' });
    /* function replacer: $& and friends are literal inside minified JS */
    out = out.replace(whole, () => `<script>${min.trim()}</script>`);
  }
  return out;
}

/* ---------- assets: bundle + minify + content-hash ---------- */
async function buildAssets() {
  const result = await esbuild.build({
    entryPoints: [path.join(SRC, 'assets/deck.css'), path.join(SRC, 'assets/deck.js')],
    outdir: path.join(OUT, 'assets'),
    bundle: true,             // pulls the elements/*.css @import chain into one file
    minify: true,
    charset: 'utf8',          // keep · and → literal instead of \u-escaping them
    legalComments: 'none',
    target: ['chrome109', 'firefox115', 'safari16'],
    loader: { '.woff2': 'file', '.webp': 'file' },
    entryNames: '[name]-[hash]',
    assetNames: '[name]-[hash]',
    metafile: true,
  });
  /* metafile keys are relative to the cwd, which differs between
     `node deploy/build.mjs` and `npm --prefix deploy run build` */
  const outputs = Object.keys(result.metafile.outputs)
    .map((p) => path.relative(OUT, path.resolve(process.cwd(), p)));
  const pick = (ext) => outputs.find((p) => p.startsWith('assets/deck-') && p.endsWith(ext));
  return { css: pick('.css'), js: pick('.js'), outputs };
}

/* ---------- assets, portable: same bundle, nothing on disk ----------
   Fonts and the Classic wallpaper become data: URIs inside the CSS, because a
   file:// page is an opaque origin: a separate woff2 would be CORS-blocked and
   the type would silently fall back to the system stack. */
async function buildPortableAssets() {
  const result = await esbuild.build({
    entryPoints: [path.join(SRC, 'assets/deck.css'), path.join(SRC, 'assets/deck.js')],
    outdir: path.join(SRC, 'assets'),   // never written: write:false
    write: false,
    bundle: true,
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    target: ['chrome109', 'firefox115', 'safari16'],
    loader: { '.woff2': 'dataurl', '.webp': 'dataurl' },
  });
  const pick = (ext) => {
    const f = result.outputFiles.find((o) => o.path.endsWith(ext));
    if (!f) throw new Error(`portable build produced no ${ext}`);
    return f.text;
  };
  return { css: pick('.css'), js: pick('.js') };
}

/* ---------- slides: fragments -> sections inside #stage ---------- */
async function bakeSlides() {
  const dir = path.join(SRC, 'slides');
  const files = (await fs.readdir(dir)).filter((f) => /\.html$/i.test(f) && !f.startsWith('.')).sort();
  const sections = await Promise.all(files.map(async (f) => {
    const raw = await fs.readFile(path.join(dir, f), 'utf8');
    const html = minifyHtml(raw);
    const src = 'slides/' + f;                       // deck.js keys PDF selection off data-src
    const tagged = html.replace(/<section class="slide"/, `<section data-src="${src}" class="slide"`);
    if (tagged === html) throw new Error(`${f}: no <section class="slide"> to tag`);
    return tagged;
  }));
  return { html: sections.join(''), count: files.length, files };
}

/* ---------- index.html ----------
   The favicon is not injected here: slides/index.html carries it as a data:
   URI, so the dev server shows the same tab icon the build does and there is
   exactly one <link rel="icon"> in every output. Injecting a second one here
   used to leave the dev deck blank-tabbed, which is the wrong way round. */
async function buildIndex({ css, js, slides, og }) {
  let html = await fs.readFile(path.join(SRC, 'index.html'), 'utf8');

  const head = [
    `<meta name="description" content="${DESC}">`,
    `<link rel="canonical" href="${SITE_URL}/">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${SITE_URL}/">`,
    `<meta property="og:title" content="${TITLE}">`,
    `<meta property="og:description" content="${DESC}">`,
    og ? `<meta property="og:image" content="${SITE_URL}/og.png">` : '',
    `<meta name="twitter:card" content="${og ? 'summary_large_image' : 'summary'}">`,
  ].filter(Boolean).join('\n');

  html = html
    .replace('<link rel="stylesheet" href="assets/deck.css">', `${head}\n<link rel="stylesheet" href="${css}">`)
    .replace('<script src="assets/deck.js"></script>', `<script src="${js}"></script>`)
    .replace('<div id="stage"></div>', `<div id="stage">${slides}</div>`);

  return minifyHtml(await minifyInlineScripts(html));
}

/* ---------- index.html, portable: one file, no external reference ----------
   data-portable on #stage is the build's only signal to deck.js. Canonical and
   og: tags are dropped: there is no URL to be canonical about offline. */
async function buildPortableIndex({ css, js, slides }) {
  let html = await fs.readFile(path.join(SRC, 'index.html'), 'utf8');

  const head = [
    `<meta name="description" content="${DESC}">`,
  ].join('\n');

  html = html
    .replace('<link rel="stylesheet" href="assets/deck.css">', `${head}\n<style>${css}</style>`)
    .replace('<script src="assets/deck.js"></script>', `<script>${js}</script>`)
    .replace('<div id="stage"></div>', `<div id="stage" data-portable>${slides}</div>`);

  return minifyHtml(await minifyInlineScripts(html));
}

/* ---------- og.png: render the built deck, headless ---------- */
async function findBrowser() {
  if (process.env.BROWSER) return process.env.BROWSER;
  for (const dir of (process.env.PATH || '').split(':')) {
    for (const c of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome']) {
      const bin = path.join(dir, c);
      try { await fs.access(bin, constants.X_OK); return bin; } catch {}
    }
  }
  return null;
}

function serveDist() {
  const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.pdf': 'application/pdf',
  };
  const server = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(OUT, p === '/' ? 'index.html' : p.slice(1));
    try {
      const buf = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

async function renderOg() {
  const browser = await findBrowser();
  if (!browser) {
    console.warn('! no chrome/chromium found, skipping og.png (link previews get no image)');
    return false;
  }
  const { server, port } = await serveDist();
  const png = path.join(OUT, 'og.png');
  const args = [
    '--headless', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
    '--window-size=1280,720', '--virtual-time-budget=8000',
    // ?nolive keeps the SSE stream shut so --virtual-time-budget can go idle
    `--screenshot=${png}`, `http://127.0.0.1:${port}/?nolive#1`,
  ];
  const ok = await new Promise((done) => {
    const p = spawn(browser, args, { stdio: 'ignore' });
    p.on('exit', (code) => done(code === 0));
    p.on('error', () => done(false));
  });
  server.close();
  if (!ok) { console.warn('! headless render failed, skipping og.png'); return false; }
  await fs.access(png);
  return true;
}

/* ---------- sw.js: offline for the published deck ----------
   Precache = index + every hashed asset (+ /deck.pdf when shipped); the cache
   name hashes the final index.html, so each publish activates a fresh cache
   and deletes the old one. /api/ is never served from cache: the client's
   localStorage mirror is the notes' offline fallback. */
async function buildSw(outputs, hasPdf) {
  const precache = ['./', ...outputs];
  if (hasPdf) precache.push('/deck.pdf');
  const index = await fs.readFile(path.join(OUT, 'index.html'));
  const version = createHash('sha256').update(index).update(precache.join(',')).digest('hex').slice(0, 10);
  const sw = `/* generated by deploy/build.mjs */
const CACHE = 'nf-${version}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // network only, never cached
  const put = (r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  };
  if (url.pathname.startsWith('/assets/')) {
    // content-hashed, immutable: cache first
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then(put)));
    return;
  }
  // everything else same-origin: network first, cache fallback
  e.respondWith(fetch(e.request).then(put).catch(() =>
    caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' })
      .then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
`;
  await fs.writeFile(path.join(OUT, 'sw.js'), sw);
}

/* ---------- run ---------- */
const t0 = Date.now();

if (PORTABLE) {
  const { css, js } = await buildPortableAssets();
  const slides = await bakeSlides();
  const html = await buildPortableIndex({ css, js, slides: slides.html });
  await fs.mkdir(PORTABLE_OUT, { recursive: true });
  const file = path.join(PORTABLE_OUT, 'tgdataset2-deck.html');
  await fs.writeFile(file, html);
  const { size } = await fs.stat(file);
  console.log(`\nportable/  ${slides.count} slides  1 file  ${(size / 1024).toFixed(0)} KB  (${Date.now() - t0} ms)`);
  console.log(`\nopen it with: xdg-open ${path.relative(process.cwd(), file)}`);
  process.exit(0);
}

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const { css, js, outputs } = await buildAssets();
const slides = await bakeSlides();
await fs.writeFile(path.join(OUT, 'index.html'), await buildIndex({ css, js, slides: slides.html, og: false }));

const og = process.env.SKIP_OG ? false : await renderOg();
if (og) await fs.writeFile(path.join(OUT, 'index.html'), await buildIndex({ css, js, slides: slides.html, og: true }));

/* the PDF is the emergency deck; ship it at /deck.pdf when it has been exported */
let hasPdf = true;
try {
  await fs.copyFile(path.join(SRC, 'deck.pdf'), path.join(OUT, 'deck.pdf'));
} catch {
  hasPdf = false;
  console.warn('! slides/deck.pdf missing, run slides/export-pdf.sh to publish /deck.pdf');
}

await buildSw(outputs, hasPdf);

const files = await fs.readdir(OUT, { recursive: true, withFileTypes: true });
let total = 0;
const rows = [];
for (const f of files.filter((f) => f.isFile())) {
  const rel = path.relative(OUT, path.join(f.parentPath, f.name));
  const { size } = await fs.stat(path.join(OUT, rel));
  total += size;
  rows.push([rel, size]);
}
rows.sort((a, b) => b[1] - a[1]);
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';
console.log(`\ndist/  ${slides.count} slides  ${rows.length} files  ${(total / 1024).toFixed(0)} KB  (${Date.now() - t0} ms)`);
for (const [rel, size] of rows) console.log(`${kb(size)}  ${rel}`);
const hash = createHash('sha256');
for (const [rel] of rows.slice().sort()) hash.update(rel + await fs.readFile(path.join(OUT, rel)));
console.log(`\nbuild ${hash.digest('hex').slice(0, 12)} → serve with: docker compose -f deploy/compose.yml up -d`);
