'use strict';
// Doc checker: size, code-block, line-number, placeholder, link and path problems in a docs folder. Prints file:line per hit.
const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['node_modules', '.git', 'graphify-out', 'private']);
const CODE_PATH = /^(src|eval|test|skills|tools|hooks|defaults)\//;

// Fence blocks: start and end are line indexes of the fence lines (end = lines.length if never closed).
function fenceBlocks(lines) {
  const blocks = [];
  lines.forEach((text, i) => {
    const m = text.match(/^\s*```\s*(\S*)/);
    const open = blocks.at(-1);
    if (!m) return;
    if (open && open.end === undefined) open.end = i;
    else blocks.push({ start: i, lang: m[1] });
  });
  return blocks.map((b) => ({ end: lines.length, ...b }));
}

function codeMask(lines) {
  const mask = lines.map(() => false);
  for (const b of fenceBlocks(lines)) mask.fill(true, b.start, Math.min(b.end, lines.length - 1) + 1);
  return mask;
}

function sizeHits(rel, lines) {
  const max = rel.split('/').slice(0, -1).includes('workflows') ? 120 : 300;
  return lines.length > max ? [{ line: 1, rule: 'size', detail: `${lines.length} lines (max ${max})` }] : [];
}

// Folder trees (box-drawing glyphs) are pictures of a layout, not code.
function codeBlockHits(lines) {
  return fenceBlocks(lines)
    .filter((b) => b.lang !== 'mermaid' && b.end - b.start - 1 > 5)
    .filter((b) => !lines.slice(b.start + 1, b.end).some((l) => /[├└│]/.test(l)))
    .map((b) => ({ line: b.start + 1, rule: 'code-block', detail: `${b.end - b.start - 1} lines in a ${b.lang || 'plain'} block (max 5)` }));
}

// Rules below check prose lines only (fenced code is skipped). find() returns a detail string or null.
function proseHits(lines, mask, rule, find) {
  return lines.flatMap((text, i) => {
    const detail = mask[i] ? null : find(text);
    return detail ? [{ line: i + 1, rule, detail }] : [];
  });
}

function lineNumberHits(lines, mask) {
  return proseHits(lines, mask, 'line-number', (text) => {
    const m = text.replace(/https?:\/\/\S+/g, '').match(/[\w-]+\.[A-Za-z]{1,5}:\d+\b/);
    return m && `cite ${m[0]}`;
  });
}

// Backtick text and "quoted" words are named, not used. "planned" counts only as a section marker (a heading or line start).
function placeholderHits(lines, mask) {
  return proseHits(lines, mask, 'placeholder', (text) => {
    const prose = text.replace(/`[^`]*`/g, '').replace(/"[^"]*"/g, '');
    const m = prose.match(/\bTBD\b|\bTODO\b|maybe later/) || prose.match(/^\s*(?:#+\s*)?(planned)\b/i);
    return m && `word "${m[1] || m[0]}"`;
  });
}

function pathHits(lines, mask, repo) {
  if (!repo) return [];
  const isMissing = (t) => CODE_PATH.test(t) && !/[\s<*]/.test(t) && !fs.existsSync(path.join(repo, t));
  return proseHits(lines, mask, 'path', (text) => {
    const miss = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\(\)$/, '').replace(/:.*$/, '')).find(isMissing);
    return miss && `missing ${miss}`;
  });
}

function linkHits(file, lines) {
  return lines.flatMap((text, i) => [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .filter((m) => /^[^:]*\.md(#[^#]*)?$/i.test(m[1]) && !fs.existsSync(path.resolve(path.dirname(file), m[1].replace(/#.*$/, ''))))
    .map((m) => ({ line: i + 1, rule: 'link', detail: `missing ${m[1]}` })));
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(full);
    return e.isFile() && e.name.endsWith('.md') ? [full] : [];
  }).sort();
}

function checkFile(docsDir, file, opts) {
  const rel = path.relative(docsDir, file).split(path.sep).join('/');
  const lines = fs.readFileSync(file, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  const mask = codeMask(lines);
  return [
    ...(opts.size ? sizeHits(rel, lines) : []), ...codeBlockHits(lines), ...lineNumberHits(lines, mask),
    ...placeholderHits(lines, mask), ...linkHits(file, lines), ...pathHits(lines, mask, opts.code),
  ].sort((a, b) => a.line - b.line).map((h) => `${rel}:${h.line}: ${h.rule}: ${h.detail}`);
}

function parseArgs(argv) {
  const opts = { docs: null, code: null, size: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--code' && argv[i + 1] !== undefined) opts.code = path.resolve(argv[++i]);
    else if (argv[i] === '--no-size') opts.size = false;
    else if (!opts.docs && !argv[i].startsWith('--')) opts.docs = path.resolve(argv[i]);
    else throw new Error(`unknown or incomplete argument: ${argv[i]}`);
  }
  if (!opts.docs) throw new Error('usage: check-docs.js <docs folder> [--code <repo>] [--no-size]');
  return opts;
}

try {
  const opts = parseArgs(process.argv.slice(2));
  const report = walk(opts.docs).flatMap((f) => checkFile(opts.docs, f, opts));
  console.log([...report, `check-docs: ${report.length} hits`].join('\n'));
  process.exitCode = report.length ? 1 : 0;
} catch (e) {
  console.error(`check-docs: ${e.message}`);
  process.exitCode = 2;
}
