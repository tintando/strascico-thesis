#!/usr/bin/env node
/* Zero-dependency dev server for the Night Feed deck (Node >= 20, no npm).
   - static files rooted at slides/
   - GET /api/slides  -> sorted JSON list of slide fragments (order = filename)
   - GET /events      -> SSE; broadcasts `reload` on any file change.
   Changes are detected via fs.watch AND a 1 s mtime poll: inotify events do
   not always propagate across Docker Desktop bind mounts, the poll does. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');   // slides/
const FRAGS = path.join(ROOT, 'slides');      // slides/slides/
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function slideList() {
  return fs.readdirSync(FRAGS)
    .filter((f) => /\.html$/i.test(f) && !f.startsWith('.'))
    .sort()
    .map((f) => 'slides/' + f);
}

/* ---- SSE clients + change detection ---- */
const clients = new Set();

const WATCH_DIRS = ['', 'slides', 'assets', 'assets/elements', 'fonts']; // relative to ROOT
function signature() {
  const parts = [];
  for (const d of WATCH_DIRS) {
    let entries;
    try { entries = fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }); }
    catch (e) { continue; }
    for (const ent of entries) {
      if (!ent.isFile() || ent.name.startsWith('.') || ent.name.endsWith('.pdf')) continue;
      try {
        const st = fs.statSync(path.join(ROOT, d, ent.name));
        parts.push(`${d}/${ent.name}:${st.mtimeMs}:${st.size}`);
      } catch (e) { /* deleted between readdir and stat */ }
    }
  }
  return parts.join('|');
}

let sig = signature();
function check() {
  const now = signature();
  if (now === sig) return;
  sig = now;
  for (const res of clients) res.write(`event: reload\ndata: ${Date.now()}\n\n`);
}
let debounce = null;
function checkSoon() { clearTimeout(debounce); debounce = setTimeout(check, 200); }

try { fs.watch(ROOT, { recursive: true }, checkSoon); }
catch (e) { /* the poll below covers it */ }
setInterval(check, 1000);
setInterval(() => { for (const res of clients) res.write(':hb\n\n'); }, 25000);

/* ---- HTTP ---- */
http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (pathname === '/api/slides') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(slideList()));
    return;
  }
  if (pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
    });
    res.write(':connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const file = path.normalize(path.join(ROOT, pathname === '/' ? 'index.html' : pathname.slice(1)));
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found: ' + pathname);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`night feed deck → http://localhost:${PORT}`);
});
