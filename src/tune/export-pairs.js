// Training pairs for the optional embedding fine-tune (see docs/TUNING.md). Reads the eval cases and the map, writes JSON lines.
//   node src/tune/export-pairs.js [--projects a,b] [--out <dir>] [--seed 42] [--min 50] [--no-code]
// A pair = one case's question (anchor) and the first doc section it matches (positive). One pair per case.
// The split is BY DOC FILE: a seeded shuffle of the files, about 20% go to held-out. A file never sits on both sides.
// Code pairs (class names, src/tune/code-pairs.js) are added to pairs.train.jsonl only; --no-code leaves them out.
// Writes to <out> (default <data>/tune): pairs.train.jsonl, pairs.heldout.jsonl, split.json, <project>.heldout-cases.json.
const fs = require('fs');
const path = require('path');
const paths = require('../paths.js');
const { loadProjects, getProject } = require('../projects.js');
const mk = require('../mk.js');
const { embedText } = require('../embed.js');
const { codePairs } = require('./code-pairs.js');

const HELD_SHARE = 0.2;
const CODE_CASE_FILES = ['eval-cases-exact.json', 'eval-cases-chain.json', 'eval-cases-scenario.json'];   // scored as the code total in tune.js
const CASE_FILES = ['eval-cases.json', ...CODE_CASE_FILES];

// mulberry32: a small seeded random number generator. Same seed = same numbers = same split.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(list, seed) {
  const rnd = mulberry32(seed), a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const casesFile = (name) => path.join(paths.privateDir(name), 'eval-cases.json');
const projectsWithCases = () => loadProjects().map((p) => p.name).filter((n) => fs.existsSync(casesFile(n)));

// opts: projects (names), out (folder), seed (default 42), min (default 50 training pairs)
function exportPairs(opts = {}) {
  const seed = opts.seed ?? 42, min = opts.min ?? 50;
  const out = opts.out || path.join(paths.dataDir(), 'tune');
  const names = opts.projects || projectsWithCases();   // doc pairs: projects with eval-cases.json
  const codeNames = opts.projects || loadProjects().map((p) => p.name);   // code pairs: every project (one with no code rows adds none)
  const file = mk.dbFile();
  if (!fs.existsSync(file)) throw new Error('no map database yet: run node src/brain.js build-mk all first');

  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true });
  const matched = [];   // { project, c, row }: a case with the first doc section it matches
  const codeByProject = new Map();   // project -> { rows, skip }: class names (first row per label, lowest deg)
  let unmatched = 0;
  try {
    for (const name of names) {
      if (!getProject(name)) throw new Error('unknown project: ' + name);
      const cases = JSON.parse(fs.readFileSync(casesFile(name), 'utf8')).filter((c) => c.doc && !c.none);
      // same matching as eval/eval-map.js judge(): case-insensitive regexes on the doc file and the section
      const docs = db.prepare("SELECT id, file, section, text FROM nodes WHERE kind = 'doc' AND project = ? ORDER BY id").all(name);
      for (const c of cases) {
        const docRe = new RegExp(c.doc, 'i'), secRe = c.sec ? new RegExp(c.sec, 'i') : null;
        const row = docs.find((r) => docRe.test(r.file) && (!secRe || secRe.test(r.section || '')));
        if (row) matched.push({ project: name, c, row }); else unmatched++;
      }
    }
    // every eval question of EVERY project: a code anchor equal to one is dropped (no eval text in training).
    // One list for all projects: a template made from one project's code can equal another project's question.
    const skip = new Set();
    for (const name of new Set([...names, ...codeNames])) {
      for (const f of CASE_FILES) {
        const fp = path.join(paths.privateDir(name), f);
        if (fs.existsSync(fp)) for (const c of JSON.parse(fs.readFileSync(fp, 'utf8'))) if (c && c.q) skip.add(String(c.q).toLowerCase());
      }
    }
    for (const name of opts.code === false ? [] : codeNames) {
      if (!getProject(name)) throw new Error('unknown project: ' + name);
      const seen = new Set(), rows = [];
      const raw = db.prepare("SELECT label, file, deg FROM nodes WHERE kind = 'code' AND file != '' AND project = ? ORDER BY deg ASC").all(name);
      for (const r of raw) {
        const label = String(r.label || '');
        if (!/^[A-Za-z][A-Za-z0-9]{4,}$/.test(label) || seen.has(label)) continue;   // same label filter as build() in mk.js
        seen.add(label); rows.push({ label, file: String(r.file) });
      }
      codeByProject.set(name, { rows, skip });
    }
  } finally { db.close(); }

  // split by doc file name (across projects too, so a shared file cannot leak into training)
  const files = [...new Set(matched.map((m) => m.row.file))].sort();
  if (files.length < 2) throw new Error(`too few doc files with eval cases: need at least 2, have ${files.length}`);
  const nHeld = Math.min(files.length - 1, Math.max(1, Math.round(files.length * HELD_SHARE)));
  const heldFiles = new Set(seededShuffle(files, seed).slice(0, nHeld));

  const train = [], heldout = [];
  const heldCases = Object.fromEntries(names.map((n) => [n, []]));
  for (const m of matched) {
    const pair = { anchor: m.c.q, positive: embedText(m.row), project: m.project, file: m.row.file, id: m.c.id };
    if (heldFiles.has(m.row.file)) { heldout.push(pair); heldCases[m.project].push(m.c); } else train.push(pair);
  }
  if (train.length < min) throw new Error(`too few cases: add or review more in eval-cases.json (have ${train.length}, need ${min})`);

  // code pairs go to training only; the held-out side stays eval questions
  const codeCounts = {};
  for (const [name, { rows, skip }] of codeByProject) {
    const cp = codePairs(rows, { seed, skip }).map((p) => ({ ...p, project: name }));
    codeCounts[name] = cp.length;
    train.push(...cp);
  }

  fs.mkdirSync(out, { recursive: true });
  const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
  fs.writeFileSync(path.join(out, 'pairs.train.jsonl'), jsonl(train));
  fs.writeFileSync(path.join(out, 'pairs.heldout.jsonl'), jsonl(heldout));
  for (const n of names) fs.writeFileSync(path.join(out, `${n}.heldout-cases.json`), JSON.stringify(heldCases[n], null, 2) + '\n');
  const split = {
    seed, held_share: HELD_SHARE, unit: 'doc file',
    train_files: files.filter((f) => !heldFiles.has(f)), heldout_files: [...heldFiles].sort(),
  };
  fs.writeFileSync(path.join(out, 'split.json'), JSON.stringify(split, null, 2) + '\n');
  return { out, seed, train: train.length, heldout: heldout.length, unmatched, trainFiles: split.train_files.length, heldoutFiles: split.heldout_files.length, codeCounts };
}

const USAGE = `usage: node src/tune/export-pairs.js [--projects a,b] [--out <dir>] [--seed 42] [--min 50] [--no-code]
  --projects a,b   projects to export (default: every project with eval cases)
  --out <dir>      output folder (default <data>/tune)
  --seed <n>       seed for the file split and the code templates (default 42)
  --min <n>        refuse when training pairs are fewer (default 50)
  --no-code        leave the code-name pairs out of pairs.train.jsonl
  --help           show this text`;

function parseArgs(argv) {
  const o = {};
  const intArg = (name, v) => { const n = Number(v); if (!Number.isInteger(n) || n < 0) throw new Error(`${name} needs a whole number`); return n; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => { if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`); return argv[++i]; };
    if (a === '--projects') o.projects = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--out') o.out = path.resolve(next());
    else if (a === '--seed') o.seed = intArg(a, next());
    else if (a === '--min') o.min = intArg(a, next());
    else if (a === '--no-code') o.code = false;
    else throw new Error('unknown argument: ' + a);
  }
  return o;
}

module.exports = { exportPairs, mulberry32, seededShuffle, CODE_CASE_FILES, CASE_FILES };

if (require.main === module) {
  try {
    if (process.argv.slice(2).includes('--help')) { console.log(USAGE); process.exit(0); }
    const r = exportPairs(parseArgs(process.argv.slice(2)));
    console.log(`pairs: ${r.train} train, ${r.heldout} held-out (files: ${r.trainFiles} train, ${r.heldoutFiles} held-out, seed ${r.seed})`);
    for (const [name, n] of Object.entries(r.codeCounts)) console.log(`code pairs: ${n} (${name})`);
    if (r.unmatched) console.log(`cases with no matching doc section (skipped): ${r.unmatched}`);
    console.log(`written to ${r.out}`);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
