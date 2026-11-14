'use strict';
// The code repo of a doc set. checkRepo() runs at set time (add-docs --repo): is this folder the repo the graph was built from?
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SAMPLE = 200, MIN_RATIO = 0.8, GIT_TIMEOUT = 5000;

// Does git accept this commit in this folder? A missing git or a bad folder counts as "no".
const hasCommit = (repoDir, commit) => {
  try { execFileSync('git', ['-C', repoDir, 'cat-file', '-e', `${commit}^{commit}`], { stdio: 'ignore', timeout: GIT_TIMEOUT }); return true; }
  catch { return false; }
};
const isGitRepo = (repoDir) => {
  try { return execFileSync('git', ['-C', repoDir, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GIT_TIMEOUT }).trim() === 'true'; }
  catch { return false; }
};

// Checks the folder against the graph. Returns { ok, reason, found, sampled, base }.
// base is '' when graph paths are relative to the repo root, or 'src' when they are relative to <repo>/src (Makillez).
function checkRepo(repoDir, graphFile) {
  const fail = (reason, extra = {}) => ({ ok: false, reason, found: 0, sampled: 0, base: '', ...extra });
  if (!fs.existsSync(repoDir) || !fs.statSync(repoDir).isDirectory()) return fail('not a folder');
  if (!isGitRepo(repoDir)) return fail('not a git repo');
  const graph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
  const commit = graph.built_at_commit;
  if (commit && !hasCommit(repoDir, commit)) return fail(`graph commit ${commit.slice(0, 7)} not in this repo`);

  // 200 code nodes, evenly spaced over the nodes that have a source_file
  const withFile = (graph.nodes || []).filter((n) => n && typeof n.source_file === 'string' && n.source_file);
  const step = withFile.length / SAMPLE;
  const sample = withFile.length <= SAMPLE ? withFile : Array.from({ length: SAMPLE }, (_, i) => withFile[Math.floor(i * step)]);
  if (!sample.length) return fail('graph has no source files');

  // test both bases; keep the one with more hits (ties keep the repo root)
  const hits = (base) => sample.filter((n) => fs.existsSync(path.join(repoDir, base, n.source_file.replace(/\\/g, '/')))).length;
  const rootHits = hits(''), srcHits = hits('src');
  const base = srcHits > rootHits ? 'src' : '', found = Math.max(rootHits, srcHits), sampled = sample.length;
  if (found / sampled < MIN_RATIO) return { ok: false, reason: `only ${found} of ${sampled} graph files are here`, found, sampled, base };
  return { ok: true, reason: '', found, sampled, base };
}

// ---- prompt time: exact lines from the real repo files ----
const MAX_FILES = 30, MAX_BYTES = 2 * 1024 * 1024, BUDGET_MS = 450;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A label like ".Handle()" becomes "Handle". Anything else that is not a plain name gives ''.
const plainName = (label) => {
  const s = String(label || '').replace(/^\./, '').replace(/\(\)$/, '');
  return /^[A-Za-z_$][\w$]*$/.test(s) ? s : '';
};

// Definition forms, tried line by line. Each one needs the name on the line.
function defRegexes(nm) {
  return [
    // function / class / interface / enum / struct / record / type <name>
    new RegExp(`(?<![\\w$])(?:function|class|interface|enum|struct|record|type)\\s+${nm}(?![\\w$])`),
    // const / let / var <name> =
    new RegExp(`(?<![\\w$])(?:const|let|var)\\s+${nm}\\s*=`),
    // class field: <name> = (  or  <name> = async (  (also "public static ..." before it)
    new RegExp(`^\\s*(?:(?:public|private|protected|static|readonly)\\s+)*${nm}\\s*=\\s*(?:async\\s*)?\\(`),
    // C# / TS method with an access or other keyword earlier on the line: public async Task<X> Handle(
    new RegExp(`\\b(?:public|private|protected|internal|static|async|override|virtual)\\b[^(]*?(?<![\\w$.])${nm}\\s*(?:<[^>]*>)?\\s*\\(`),
    // method line: <name>(...) {  (optional keyword before it, optional return type after ")")
    new RegExp(`^\\s*(?:(?:public|private|protected|static|async|readonly|get|set)\\s+)*(?<![\\w$.])${nm}\\s*\\([^)]*\\)\\s*(?::[^{;]*)?\\{`),
  ];
}

// The 1-based line of the definition of name in lines, else the first whole-word line, else 0.
function defLineIn(lines, name) {
  const nm = escapeRe(name);
  const defs = defRegexes(nm);
  const word = new RegExp(`(?<![A-Za-z0-9_$])${nm}(?![A-Za-z0-9_$])`);
  let wordLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(name)) continue; // cheap check first; the regexes run only on lines with the name
    if (defs.some((re) => re.test(line))) return i + 1;
    if (!wordLine && word.test(line)) wordLine = i + 1;
  }
  return wordLine;
}

function defLine(text, name) {
  return defLineIn(String(text).split('\n'), name);
}

// Reads one file once per call. Returns lines, false (file not found), or null (skip: over 2 MB, unreadable, over the file cap or the time budget).
function fileLines(repoDir, base, rel, cache, t0) {
  const key = path.join(repoDir, base, String(rel).replace(/\\/g, '/'));
  if (cache.has(key)) return cache.get(key);
  if (cache.size >= MAX_FILES || Date.now() - t0 > BUDGET_MS) return null; // not cached: a later call may still read it
  let p = key;
  if (!fs.existsSync(p)) {
    // case-insensitive match of the base name inside the same folder (for systems where case matters)
    const dir = path.dirname(key), want = path.basename(key).toLowerCase();
    let hit = null;
    try { hit = fs.readdirSync(dir).find((f) => f.toLowerCase() === want); } catch { hit = null; }
    if (!hit) { cache.set(key, false); return false; }
    p = path.join(dir, hit);
  }
  let lines = null;
  try {
    if (fs.statSync(p).size <= MAX_BYTES) lines = fs.readFileSync(p, 'utf8').split('\n');
  } catch { lines = null; }
  cache.set(key, lines);
  return lines;
}

// The file is gone: git grep finds the name elsewhere in the repo. A hit file with the old basename wins; else the first hit with a definition.
// Returns { file, line } (file relative to base) or null. Never throws. Exit 1 (no match) and any git error both mean not found.
const MAX_LOOKUPS = 2;
function movedLine(repoDir, base, name, oldFile, cache, t0) {
  let out;
  try {
    out = execFileSync('git', ['-C', repoDir, 'grep', '-n', '-w', '-I', '-e', name, '--', base || '.'], {
      encoding: 'utf8', timeout: Math.max(50, BUDGET_MS - (Date.now() - t0)), maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch { return null; }
  const old = path.basename(String(oldFile).replace(/\\/g, '/')), prefix = base ? base + '/' : '';
  const hits = [...new Set(out.split('\n').map((l) => (l.match(/^(.*?):\d+:/) || [])[1]).filter(Boolean))];
  let best = null;
  for (const hit of hits) {
    if (!hit.startsWith(prefix)) continue;
    const rel = hit.slice(prefix.length);
    const lines = fileLines(repoDir, base, rel, cache, t0);
    if (!lines) continue; // missing, skipped, or over the budget
    const line = defLineIn(lines, name);
    if (!line) continue;
    if (path.basename(rel) === old) return { file: rel, line };
    if (!best) best = { file: rel, line };
  }
  return best;
}

// Sets n.loc = 'L<line>' and n.exact = true when the name is found, or n.exact = false when the file or the name is not there.
// A moved file (file gone, name found elsewhere in the repo): n.file = the new path, n.moved = true.
// Items are { n: { label, file, loc } } (code) or { label, file, loc } (neighbour). Names that are not plain are left alone.
// Never throws: a bad item or a skipped file is left as it was.
function exactLines(repoDir, items, base = '') {
  if (!Array.isArray(items)) return;
  const t0 = Date.now(), cache = new Map(), missing = [];
  // pass 1: every file that is on disk (fast reads); a missing file waits for pass 2
  for (const item of items) {
    try {
      const n = item.n || item;
      const name = plainName(n.label);
      if (!name) continue;
      if (!n.file) { n.exact = false; continue; }
      const lines = fileLines(repoDir, base, n.file, cache, t0);
      if (lines === null) continue;
      if (lines === false) { missing.push([n, name]); continue; }
      const line = defLineIn(lines, name);
      if (line) { n.loc = 'L' + line; n.exact = true; } else n.exact = false;
    } catch { /* fail open: this item keeps its old line */ }
  }
  // pass 2: moved files, with the time left (git grep takes ~200 ms on a big repo, so it must not starve pass 1)
  let lookups = 0;
  for (const [n, name] of missing) {
    try {
      let mv = null;
      if (lookups < MAX_LOOKUPS) { lookups++; mv = movedLine(repoDir, base, name, n.file, cache, t0); }
      if (mv) { n.file = mv.file; n.loc = 'L' + mv.line; n.exact = true; n.moved = true; } else n.exact = false;
    } catch { /* fail open */ }
  }
}

module.exports = { checkRepo, defLine, exactLines };
