'use strict';
// Rewrite check: lists key ideas (code spans, link targets, numbers) that a doc lost. A fact moved to another doc still counts as kept.
const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['node_modules', '.git', 'graphify-out']);
const NUMBER = /\b\d+(\.\d+)?\s?(%|ms|s|MB|min|days?|minutes|characters)?\b/g;

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(full);
    return e.isFile() && e.name.endsWith('.md') ? [full] : [];
  }).sort();
}

// Key ideas outside code fences: backtick spans, markdown link targets and numbers. Returns unique tokens in order.
function tokens(text) {
  const out = new Set();
  let fence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) out.add(m[1].trim());
    for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) out.add(m[1]);
    for (const m of line.matchAll(NUMBER)) out.add(m[0]);
  }
  out.delete('');
  return [...out];
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A token is present when it is not glued to letters, digits or underscores on either side.
const present = (token, text) => new RegExp(`(?<![A-Za-z0-9_])${esc(token)}(?![A-Za-z0-9_])`).test(text);
const lineCount = (text) => (text === '' ? 0 : text.replace(/\r?\n$/, '').split(/\r?\n/).length);

function readOr(file) {
  try { return { text: fs.readFileSync(file, 'utf8') }; } catch (e) { return { error: e.message }; }
}

// Pairs of { name, before, after } to compare. Two files compare as they are; two folders match by relative path.
function pairs(before, after) {
  const isDir = (p) => fs.statSync(p).isDirectory();
  if (isDir(before) !== isDir(after)) throw new Error('both arguments must be files, or both must be folders');
  if (!isDir(before)) return [{ name: path.basename(after), before, after, file: true }];
  return walk(before)
    .map((f) => path.relative(before, f).split(path.sep).join('/'))
    .map((rel) => ({ name: rel, before: path.join(before, rel), after: fs.existsSync(path.join(after, rel)) ? path.join(after, rel) : null, file: false }));   // a removed or renamed doc is checked too: its ideas must be somewhere in "after"
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv.some((a) => a.startsWith('--'))) throw new Error('usage: key-ideas.js <before file or folder> <after file or folder>');
  const [before, after] = argv.map((a) => path.resolve(a));
  for (const p of [before, after]) {
    if (!fs.existsSync(p)) throw new Error(`no such file or folder: ${p}`);
  }
  return { before, after };
}

try {
  const opts = parseArgs(process.argv.slice(2));
  const afterIsDir = fs.statSync(opts.after).isDirectory();
  const afterFiles = afterIsDir ? walk(opts.after) : [opts.after];
  const afterTexts = [];
  const report = [];
  let lost = 0;
  for (const f of afterFiles) {
    const r = readOr(f);
    if (r.error) { report.push(`${path.relative(opts.after, f).split(path.sep).join('/') || path.basename(f)}: unreadable: ${r.error}`); lost++; } else afterTexts.push(r.text);
  }
  for (const job of pairs(opts.before, opts.after)) {
    const b = readOr(job.before);
    const a = job.after ? readOr(job.after) : { text: '' };
    if (b.error || a.error) { report.push(`${job.name}: unreadable: ${b.error || a.error}`); lost++; continue; }
    if (!job.file && b.text === a.text) continue;
    const all = tokens(b.text);
    const lostHere = all.filter((t) => !afterTexts.some((text) => present(t, text)));
    lost += lostHere.length;
    report.push(`${job.name}: ${lineCount(b.text)} -> ${lineCount(a.text)} lines, key ideas kept: ${all.length - lostHere.length}/${all.length}`);
    for (const t of lostHere) report.push(`  lost: ${t}`);
  }
  console.log([...report, `key-ideas: ${lost} lost`].join('\n'));
  process.exitCode = lost ? 1 : 0;
} catch (e) {
  console.error(`key-ideas: ${e.message}`);
  process.exitCode = 2;
}
