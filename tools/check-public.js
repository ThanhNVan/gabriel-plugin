'use strict';
// Privacy scan for publishable files: finds owner words, emails, IPs, secrets and user paths. Prints file, line and kind only, never the matched value.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'private', '.git']);
const BIN_CHECK_BYTES = 8192;

// Built-in patterns. Regex escapes keep this file itself free of matches.
const PATTERNS = [
  // email: the last domain part has letters, so an npm pin (pkg@3.4.2) is not an email
  { kind: 'email', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g, ok: (m) => !m.toLowerCase().startsWith('noreply@') },
  { kind: 'ip', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ok: (m) => m !== '127.0.0.1' && m !== '0.0.0.0' },
  { kind: 'secret', re: /api[_-]?key\s*[:=]\s*\S{8,}/gi },
  { kind: 'secret', re: /password\s*[:=]\s*\S+/gi },
  { kind: 'secret', re: /-{5}BEGIN/g },
  { kind: 'user path', re: /[A-Za-z]:\\Users\\[^\\\s<]+/g },
  { kind: 'user path', re: /\/Users\/[^/\s<]+/g },
  { kind: 'user path', re: /\/home\/[^/\s<]+/g },
];

function parseArgs(argv) {
  const opts = { root: DEFAULT_ROOT, words: null, release: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--release') {
      opts.release = true;
    } else if (a === '--root' || a === '--words') {
      if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`);
      if (a === '--root') opts.root = path.resolve(argv[++i]);
      else opts.words = path.resolve(argv[++i]);
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return opts;
}

function findWordsFile(opts) {
  const base = require('../src/paths.js').dataDir();   // same folder rule as the rest of gabriel
  const candidates = opts.words
    ? [opts.words]
    : [path.join(base, 'private', 'privacy-words.txt'), path.join(opts.root, 'private', 'privacy-words.txt')];
  return candidates.find((f) => fs.existsSync(f)) || null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadWords(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((word) => ({
      word,
      re: new RegExp(`(?<![A-Za-z0-9_])${escapeRe(word)}(?![A-Za-z0-9_])`, 'i'),
    }));
}

function kindsForLine(line, words) {
  const kinds = new Set();
  for (const w of words) {
    if (w.re.test(line)) kinds.add(`word "${w.word}"`);
  }
  for (const p of PATTERNS) {
    if ([...line.matchAll(p.re)].some((m) => !p.ok || p.ok(m[0]))) kinds.add(p.kind);
  }
  return kinds;
}

function isSkipped(rel) {
  return rel.split('/').some((seg) => SKIP_DIRS.has(seg));
}

function walk(root, rel, out) {
  for (const d of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) {
      if (!SKIP_DIRS.has(d.name)) walk(root, childRel, out);
    } else if (d.isFile()) {
      out.push(childRel);
    }
  }
}

function gitLines(root, args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || '').trim()}`);
  return r.stdout.split('\0').filter(Boolean);
}

function listFiles(root) {
  if (fs.existsSync(path.join(root, '.git'))) {
    return gitLines(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
  }
  const out = [];
  walk(root, '', out);
  return out;
}

function main(argv) {
  const opts = parseArgs(argv);
  const wordsFile = findWordsFile(opts);
  let words = [];
  if (wordsFile) {
    words = loadWords(wordsFile);
  } else if (opts.release) {
    console.error('word list required for --release: pass --words or put private/privacy-words.txt in place');
    return 2;
  } else {
    console.error('word list not found, words skipped');
  }

  const report = [];
  if (fs.existsSync(path.join(opts.root, '.git'))) {
    for (const f of gitLines(opts.root, ['ls-files', '-z', '--', ':(glob)**/private/**'])) {
      report.push(`private/ file is tracked: ${f}`);
    }
  }

  for (const rel of listFiles(opts.root).sort()) {
    if (isSkipped(rel)) continue;
    let buf;
    try {
      buf = fs.readFileSync(path.join(opts.root, rel));
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'EISDIR') continue;
      throw e;
    }
    if (buf.subarray(0, BIN_CHECK_BYTES).includes(0)) continue;
    buf.toString('utf8').split(/\r?\n/).forEach((line, i) => {
      for (const kind of kindsForLine(line, words)) {
        report.push(`${rel}:${i + 1}: ${kind}`);
      }
    });
  }

  for (const line of report) console.log(line);
  console.log(`privacy scan: ${report.length} hits`);
  return report.length ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  console.error(`check-public: ${e.message}`);
  process.exitCode = 2;
}
