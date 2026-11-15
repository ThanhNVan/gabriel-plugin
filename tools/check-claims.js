'use strict';
// Claim checker: backticked paths, function names, constants and flags in docs must exist in the code. Prints file:line per hit.
const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['node_modules', '.git', 'graphify-out']);
const CODE_DIRS = ['src', 'tools', 'eval', 'test'];
const CODE_EXT = /\.(js|py)$/;
const PATH_EXT = /\.[A-Za-z]{1,5}$/;
const FUNC = /^([A-Za-z_][\w.]*)\(\)$/;
const CONST = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const FLAG = /^--[A-Za-z][\w-]*$/;

function walk(dir, pick) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(full, pick);
    return e.isFile() && pick(e.name) ? [full] : [];
  }).sort();
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

// One text index of the code (words) and one with the skill files too (flags).
function buildIndex(repo) {
  const code = CODE_DIRS.flatMap((d) => walk(path.join(repo, d), (n) => CODE_EXT.test(n))).map(readText).join('\n');
  const skills = walk(path.join(repo, 'skills'), (n) => n === 'SKILL.md').map(readText).join('\n');
  const files = walkAll(repo).map((f) => '/' + path.relative(repo, f).split(path.sep).join('/'));
  return { code, flags: code + '\n' + skills, files };
}

// Every file in the repo (graphify-out included, so graph report paths count), for short-path matches.
function walkAll(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '.git' ? [] : walkAll(full);
    return e.isFile() ? [full] : [];
  });
}

// Paths that live outside the repo on purpose: the home folder, env vars, and gabriel's data folder.
const OUTSIDE = /^(~|\$|%|[A-Za-z]:)|^(private|history|seen|models|docs\/stack)\//;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const seen = new Map();
// A word is found when it is not glued to letters, digits or underscores (flags also allow a dash).
function found(text, word, edge) {
  const key = edge + word;
  if (!seen.has(key)) seen.set(key, new RegExp(`(?<!${edge})${esc(word)}(?!${edge})`).test(text));
  return seen.get(key);
}

// Returns { kind, span } for a claim that is checked and missing, or null for anything else.
function judge(span, file, repo, index) {
  if (/^https?:\/\//i.test(span)) return null;
  if (span.includes('/') && PATH_EXT.test(span) && !/[\s<*]/.test(span)) {
    if (OUTSIDE.test(span) || index.ignore.includes(span)) return null;
    const tail = '/' + span.replace(/^\.?\//, '');   // a short path (hosts/codex.js) matches a repo file that ends with it (src/hosts/codex.js)
    const ok = fs.existsSync(path.join(repo, span)) || fs.existsSync(path.join(path.dirname(file), span)) || index.files.some((f) => f.endsWith(tail));
    return ok ? null : { kind: 'path', span };
  }
  const fn = span.match(FUNC);
  if (fn) return found(index.code, fn[1].split('.').pop(), '[A-Za-z0-9_]') ? null : { kind: 'function', span };
  if (CONST.test(span) && span.length >= 4) return found(index.code, span, '[A-Za-z0-9_]') ? null : { kind: 'constant', span };
  if (FLAG.test(span)) return found(index.flags, span, '[\\w-]') ? null : { kind: 'flag', span };
  return null;
}

function checkFile(docsDir, file, repo, index) {
  const rel = path.relative(docsDir, file).split(path.sep).join('/');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return [`${rel}:1: unreadable: ${e.message}`]; }
  const hits = [];
  let fence = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*```/.test(line)) { fence = !fence; return; }
    if (fence) return;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const hit = judge(m[1], file, repo, index);
      if (hit) hits.push(`${rel}:${i + 1}: ${hit.kind} not found: ${hit.span}`);
    }
  });
  return hits;
}

function parseArgs(argv) {
  const opts = { docs: null, code: null, ignore: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--code' && argv[i + 1] !== undefined) opts.code = path.resolve(argv[++i]);
    else if (argv[i] === '--ignore' && argv[i + 1] !== undefined) opts.ignore = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);   // paths in another repo or the data folder, named on purpose
    else if (!opts.docs && !argv[i].startsWith('--')) opts.docs = path.resolve(argv[i]);
    else throw new Error(`unknown or incomplete argument: ${argv[i]}`);
  }
  if (!opts.docs || !opts.code) throw new Error('usage: check-claims.js <docs folder> --code <repo> [--ignore <path>,<path>]');
  for (const dir of [opts.docs, opts.code]) {
    if (!fs.existsSync(dir)) throw new Error(`no such folder: ${dir}`);
  }
  return opts;
}

try {
  const opts = parseArgs(process.argv.slice(2));
  const index = { ...buildIndex(opts.code), ignore: opts.ignore };
  const report = walk(opts.docs, (n) => n.endsWith('.md')).flatMap((f) => checkFile(opts.docs, f, opts.code, index));
  console.log([...report, `check-claims: ${report.length} hits`].join('\n'));
  process.exitCode = report.length ? 1 : 0;
} catch (e) {
  console.error(`check-claims: ${e.message}`);
  process.exitCode = 2;
}
