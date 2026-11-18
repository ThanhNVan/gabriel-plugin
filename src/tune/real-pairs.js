'use strict';
// Reranker training pairs from REAL labelled questions (the cases a user wrote for each project).
// Input per project: <privateDir(p)>/rerank-train-cases.json, an array of {id, q, code, file?, project, target?}:
//   code: regex for the answer's label; file: optional regex for the end of its path; target: {label, file} used when the answer is not in the search pool.
//   realPairs(cases, searchFn(c) -> search result | null, {negs, textOf(label, file, c)}) -> {rows: {q, pos, negs, project}[], stats}
//   node src/tune/real-pairs.js --out <dir> [--negs 7] [--projects a,b] [--rich]   (writes <dir>/pairs.real.jsonl)
const fs = require('fs');
const path = require('path');
const mk = require('../mk.js');
const paths = require('../paths.js');
const rules = require('../rules.js');
const { loadProjects } = require('../projects.js');
const { getEmbedder } = require('../embed.js');
const { codeText } = mk;
const { richText } = require('../rerank.js');

const CASES = 'rerank-train-cases.json';
const casesFile = (name) => path.join(paths.privateDir(name), CASES);
const normPath = (f) => String(f).replace(/\\/g, '/');

// the label regex and the full matcher (label + file) of one case
function matchersOf(c) {
  const re = new RegExp(c.code, 'i'), fre = c.file ? new RegExp(c.file, 'i') : null;
  return { re, match: (x) => re.test(x.label) && (!fre || fre.test(normPath(x.file))) };
}

function realPairs(cases, searchFn, { negs = 7, textOf = codeText } = {}) {
  const rows = [], stats = { cases: 0, inPool: 0, notInPool: 0, noResult: 0 };
  for (const c of cases) {
    stats.cases++;
    const res = searchFn(c);
    if (!res) { stats.noResult++; continue; }
    const { re, match } = matchersOf(c);
    const pool = res.pool || [];
    let item = pool.find(match);
    if (item) stats.inPool++;
    else if (c.target) { item = c.target; stats.notInPool++; }
    else continue;
    const pos = textOf(item.label, item.file, c);
    const seen = new Set([pos]), picked = [];
    for (const x of pool) {
      if (picked.length >= negs) break;
      if (re.test(x.label)) continue;   // a negative must not carry the answer's label
      const t = textOf(x.label, x.file, c);
      if (seen.has(t)) continue;
      seen.add(t); picked.push(t);
    }
    if (!picked.length) continue;
    rows.push({ q: c.q, pos, negs: picked, project: c.project });
  }
  return { rows, stats };
}

const USAGE = `usage: node src/tune/real-pairs.js --out <dir> [--negs 7] [--projects a,b]
  --out <dir>      output folder (required); writes pairs.real.jsonl
  --negs <n>       negative texts per pair (default 7)
  --projects a,b   only these projects (default: every project with ${CASES})
  --rich           code body from the repo folder too (richText), not only the name and path
  --help           show this text`;

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => { if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`); return argv[++i]; };
    if (a === '--out') o.out = path.resolve(next());
    else if (a === '--negs') { const n = Number(next()); if (!Number.isInteger(n) || n < 0) throw new Error('--negs needs a whole number'); o.negs = n; }
    else if (a === '--projects') o.projects = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--rich') o.rich = true;
    else throw new Error('unknown argument: ' + a);
  }
  if (!o.out) throw new Error('--out <dir> is required');
  return o;
}

// the first code node of the project that matches the case (used when the answer is not in the pool)
function targetFinder(db, project) {
  const nodes = db.prepare("SELECT label, file FROM nodes WHERE project = ? AND kind = 'code' AND file != ''").all(project);
  return (c) => {
    const { match } = matchersOf(c);
    const r = nodes.find((x) => match({ label: String(x.label), file: String(x.file) }));
    return r ? { label: String(r.label), file: String(r.file) } : null;
  };
}

async function run(opts) {
  const embed = await getEmbedder(false);
  if (!embed) throw new Error('embedding model not installed: run node src/brain.js setup');
  const home = rules.homeDir(), dbPath = mk.dbFile(home);
  if (!fs.existsSync(dbPath)) throw new Error('no map database yet: run node src/brain.js build-mk all first');
  const all = loadProjects().map((p) => p.name);
  const names = (opts.projects || all).filter((n) => {
    if (fs.existsSync(casesFile(n))) return true;
    console.log(`skip ${n}: no ${CASES}`);
    return false;
  });

  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const lines = [], counts = {};
  try {
    for (const name of names) {
      const cases = JSON.parse(fs.readFileSync(casesFile(name), 'utf8'));
      const findTarget = targetFinder(db, name);
      const results = new Map(), richCache = new Map();
      let last = -10;
      for (let i = 0; i < cases.length; i++) {
        const c = { ...cases[i], project: cases[i].project || name };
        const [pv] = await embed([String(c.q).slice(0, 500)]);
        const res = mk.search(home, c.q, { pv, learn: false, project: name, pool: true });
        if (res && !(res.pool || []).some(matchersOf(c).match)) c.target = c.target || findTarget(c) || undefined;
        results.set(c, res);
        const pct = Math.floor((100 * (i + 1)) / cases.length);
        if (pct >= last + 10 || pct === 100) { last = pct; console.log(`${name} ${pct}%`); }
      }
      const textOf = opts.rich ? (label, file, c) => richText(label, file, c.project, richCache) : codeText;
      const r = realPairs([...results.keys()], (c) => results.get(c) ?? null, { negs: opts.negs ?? 7, textOf });
      const s = r.stats;
      console.log(`real pairs: ${r.rows.length} (${name}) in pool ${s.inPool}, not in pool ${s.notInPool}, no result ${s.noResult}`);
      counts[name] = r.rows.length;
      for (const row of r.rows) lines.push(JSON.stringify(row));
    }
  } finally { db.close(); }

  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(path.join(opts.out, 'pairs.real.jsonl'), lines.map((l) => l + '\n').join(''));
  return { counts, total: lines.length, out: opts.out };
}

module.exports = { realPairs };

if (require.main === module) {
  (async () => {
    if (process.argv.slice(2).includes('--help')) { console.log(USAGE); return; }
    const t0 = Date.now();
    const r = await run(parseArgs(process.argv.slice(2)));
    console.log(`real pairs: ${r.total} (total)`);
    console.log(`written to ${r.out}`);
    console.log(`time: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  })().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
