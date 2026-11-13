'use strict';
// Every ```mermaid block in the repo's Markdown (README, docs, skills) must parse with the real Mermaid parser.
// Needs the dev packages mermaid and jsdom (npm install). Without them it prints a skip line and exits 0.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
let JSDOM, createDOMPurify;
try { ({ JSDOM } = require('jsdom')); createDOMPurify = require('dompurify'); require.resolve('mermaid'); }
catch { console.log('mermaid check skipped (dev packages missing: run npm install)'); process.exit(0); }

const SKIP = new Set(['node_modules', 'private', '.git', 'graphify-out']);
function mdFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...mdFiles(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window; global.document = dom.window.document;
global.DOMPurify = createDOMPurify(dom.window);

(async () => {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
  let total = 0, bad = 0;
  for (const file of mdFiles(ROOT)) {
    const md = fs.readFileSync(file, 'utf8');
    for (const m of md.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)) {
      total++;
      const line = md.slice(0, m.index).split('\n').length;
      try { await mermaid.parse(m[1]); }
      catch (e) { bad++; console.log(`FAIL ${path.relative(ROOT, file)}:${line}: ${String(e.message || e).split('\n').slice(0, 3).join(' | ')}`); }
    }
  }
  console.log(`${total - bad}/${total} mermaid diagrams parse`);
  if (bad) process.exitCode = 1; else console.log('ALL PASSED');
})();
