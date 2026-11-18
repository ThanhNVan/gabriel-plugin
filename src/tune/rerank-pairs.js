'use strict';
// Hard-negative pairs for the reranker (the tuner, see docs/TUNING.md). Each question (see questionsOf) gets up to `negs`
// negative texts, in this order: labels from opts.hardOf (closest in meaning first, from --mine), names sharing a name word
// with the positive (more shared words first), names in the same folder as the positive file, then seeded random names.
// The positive is codeText(label, file), the same text the map embeds.
// Questions per row: the code-name templates (code-pairs.js, class names only) plus scenario templates (long debug, change,
// workflow and explain questions, for class and method names).
//   rerankPairs(rows: {label, file}[], opts?: {seed?, negs?, skip?: Set<string>, hardOf?: (q) => string[], scenarioPer?}) -> {q, pos, negs: string[]}[]
// Same rows + same seed = same output.
//   node src/tune/rerank-pairs.js --out <dir> [--seed 42] [--negs 4] [--mine]   (writes <dir>/pairs.rerank.jsonl)
const fs = require('fs');
const path = require('path');
const mk = require('../mk.js');
const { loadProjects, getProject } = require('../projects.js');
const { codeText } = mk;
const { codePairs } = require('./code-pairs.js');
const { seededShuffle, caseQuestionSkip, mulberry32 } = require('./export-pairs.js');
const { getEmbedder } = require('../embed.js');

// same split as mk.js (not exported there): camelCase -> spaced words
const camel = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
const ROLE_WORDS = new Set(['handler', 'command', 'query', 'request', 'dto', 'service', 'repository', 'controller']);
const CLASS_ROW = /^[A-Za-z][A-Za-z0-9]{4,}$/;                 // a class name (same test as export-pairs.js)
const METHOD_ROW = /^\.?[A-Za-z_][A-Za-z0-9_]*\(\)$/;          // a method or function name: .collect_metrics() or distance()

// .collect_metrics() -> collect_metrics, distance() -> distance
const nameCore = (label) => String(label).replace(/^\./, '').replace(/\(\)$/, '');

// the name words that can make a hard negative: 3+ letters, not a role word
const nameWords = (label) => camel(nameCore(label)).toLowerCase().split(/[\s_.]+/).filter((w) => w.length >= 3 && !ROLE_WORDS.has(w));
const folderOf = (file) => path.posix.dirname(String(file).replace(/\\/g, '/'));
const dirParts = (file) => String(file || '').replace(/\\/g, '/').split('/').slice(0, -1);

// the folder right under Services/ (Services/Vessels/... -> vessels), else '' (same rule as areaOf in code-pairs.js)
function areaOf(file) {
  const parts = String(file || '').replace(/\\/g, '/').split('/');
  const i = parts.indexOf('Services');
  return i >= 0 && i + 2 < parts.length ? parts[i + 1].toLowerCase() : '';
}
// the last 2 folders of the file, without src, lower-case: aipo/metrics/collect.py -> 'aipo metrics'
const folderWords = (file) => dirParts(file).filter((p) => p && p.toLowerCase() !== 'src').slice(-2)
  .map((p) => p.toLowerCase().replace(/[_-]+/g, ' ')).join(' ');

// {subject} = the name words without role words; {folder} and {area} are dropped (with their "in") when empty
const SCENARIO = [
  '{subject} gives the wrong result in {folder}, where is the logic',
  'a user reports a bug with {subject}, which code should I check first',
  'our {subject} job fails in {folder} after a deploy, what should I look at first',
  'why does {subject} return stale data in {folder}',
  'I need to change how {subject} works in {area}, which function or class do I edit',
  'where would I add a new rule for {subject}',
  'a new requirement changes {subject} in {area}, what code do I touch',
  'I want {subject} to behave differently for one customer, where should that check go',
  'walk me through what happens when {subject} runs in {folder}',
  'which code runs the {subject} step and what calls it',
  'a request hits {subject} and then the database, which functions run in order',
  'explain how {subject} is done in {folder} and where the code is',
  'how does {subject} work here, show me the code in {folder}',
  'what is the purpose of {subject} and where is it implemented',
];

// the scenario questions for one row: `per` templates, start picked by the seeded rnd (rotates like anchorsOf in code-pairs.js)
function scenarioAnchors(label, file, rnd, per = 2) {
  const core = nameCore(String(label || ''));
  let w = camel(core).replace(/[_.]+/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);
  if (/^On[A-Z]/.test(core) && w[0] === 'on') w = w.slice(1);
  const subject = w.filter((x) => !ROLE_WORDS.has(x)).join(' ').trim();
  if (!subject) return [];
  const folder = folderWords(file), area = areaOf(file);
  const start = Math.floor(rnd() * SCENARIO.length);
  const out = new Set();
  for (let k = 0; k < Math.min(per, SCENARIO.length); k++) {
    out.add(SCENARIO[(start + k) % SCENARIO.length].split('{subject}').join(subject)
      .replace(/\bin \{folder\}/g, folder ? 'in ' + folder : '')
      .replace(/\bin \{area\}/g, area ? 'in ' + area : '')
      .replace(/\s+/g, ' ').replace(/\s+([,.?])/g, '$1').trim());
  }
  return [...out];
}

// all questions for the rows: code-name templates, then scenario templates; each as {q, pos} (pos = codeText). Deduplicated.
function questionsOf(rows, opts = {}) {
  const seed = opts.seed ?? 42, skip = opts.skip ?? new Set(), per = opts.scenarioPer ?? 2;
  const out = [], seen = new Set();
  const add = (q, pos) => {
    if (skip.has(q.toLowerCase())) return;
    const key = q + '\u0000' + pos;
    if (seen.has(key)) return;
    seen.add(key); out.push({ q, pos });
  };
  for (const p of codePairs(rows, { seed, skip })) add(p.anchor, p.positive);
  const rnd = mulberry32(seed);
  for (const r of rows) {
    const label = String(r.label || ''), file = String(r.file || '');
    if (!label || label.startsWith('Metizoft')) continue;
    const positive = codeText(label, file);
    for (const a of scenarioAnchors(label, file, rnd, per)) add(a, positive);
  }
  return out;
}

function rerankPairs(rows, opts = {}) {
  const seed = opts.seed ?? 42, negs = opts.negs ?? 4, skip = opts.skip ?? new Set(), hardOf = opts.hardOf;
  const texts = rows.map((r) => codeText(String(r.label || ''), String(r.file || '')));
  const byText = new Map(), byLabel = new Map();
  texts.forEach((t, i) => { if (!byText.has(t)) byText.set(t, i); });
  rows.forEach((r, i) => { const l = String(r.label || ''); if (!byLabel.has(l)) byLabel.set(l, i); });
  const words = rows.map((r) => new Set(nameWords(String(r.label || ''))));
  const folders = rows.map((r) => folderOf(r.file));
  const order = seededShuffle(rows.map((_, i) => i), seed);   // seeded order: tie-break and random pool
  const out = [];
  for (const p of questionsOf(rows, { seed, skip, scenarioPer: opts.scenarioPer })) {
    const pi = byText.get(p.pos);
    if (pi === undefined) continue;
    const shared = (j) => [...words[pi]].filter((w) => words[j].has(w)).length;
    const first = [];   // labels the caller says are close in meaning to this question (not the positive's own row)
    for (const l of (hardOf ? hardOf(p.q) : [])) { const j = byLabel.get(l); if (j !== undefined && j !== pi) first.push(j); }
    const hard = order.filter((j) => j !== pi && shared(j) > 0).sort((a, b) => shared(b) - shared(a));   // stable: ties keep seeded order
    const sameFolder = order.filter((j) => j !== pi && folders[j] === folders[pi]);
    const rest = order.filter((j) => j !== pi);
    const picked = [], seen = new Set([p.pos]);
    for (const j of [...first, ...hard, ...sameFolder, ...rest]) {
      if (picked.length >= negs) break;
      if (seen.has(texts[j])) continue;
      seen.add(texts[j]); picked.push(texts[j]);
    }
    out.push({ q: p.q, pos: p.pos, negs: picked });
  }
  return out;
}

// --mine: the labels closest in meaning to each question, from the map's own code vectors (vecc). Returns (q) => labels, best first.
const f32 = (b) => (b.byteOffset % 4 === 0 ? new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) : new Float32Array(new Uint8Array(b).buffer));
const MINE_TOP = 8, MINE_BATCH = 64;

async function mineHard(db, project, rows, skip, seed, scenarioPer) {
  const embed = await getEmbedder(false);
  if (!embed) throw new Error('embedding model not installed: run node src/brain.js setup, or drop --mine');
  const uniq = [...new Set(questionsOf(rows, { seed, skip, scenarioPer }).map((p) => p.q))];
  const qv = new Map();
  const vrows = db.prepare('SELECT label, v FROM vecc WHERE project = ?').all(project);
  const labels = vrows.map((r) => String(r.label)), vecs = vrows.map((r) => f32(r.v));
  const total = uniq.length * 2, step = (done, phase) => {
    const pct = Math.floor(100 * (phase === 'embed' ? done : uniq.length + done) / total);
    if (pct >= lastPct + 10 || pct === 100) { lastPct = pct; console.log(`mine ${project} ${pct}%`); }
  };
  let lastPct = -10;
  for (let i = 0; i < uniq.length; i += MINE_BATCH) {
    const part = uniq.slice(i, i + MINE_BATCH), got = await embed(part);
    part.forEach((q, j) => qv.set(q, Float32Array.from(got[j])));
    step(Math.min(i + MINE_BATCH, uniq.length), 'embed');
  }
  const hard = new Map();
  for (let n = 0; n < uniq.length; n++) {
    const q = uniq[n], qvec = qv.get(q), D = qvec.length;
    const top = [];   // {s, i}, best first, at most MINE_TOP
    for (let i = 0; i < vecs.length; i++) {
      const v = vecs[i];
      if (v.length !== D) continue;
      let s = 0;
      for (let d = 0; d < D; d++) s += qvec[d] * v[d];
      if (top.length < MINE_TOP || s > top[top.length - 1].s) {
        let at = top.length;
        while (at > 0 && top[at - 1].s < s) at--;
        top.splice(at, 0, { s, i });
        if (top.length > MINE_TOP) top.pop();
      }
    }
    hard.set(q, top.map((t) => labels[t.i]));
    step(n + 1, 'score');
  }
  return (q) => hard.get(q) || [];
}

const USAGE = `usage: node src/tune/rerank-pairs.js --out <dir> [--seed 42] [--negs 4] [--mine]
  --out <dir>      output folder (required); writes pairs.rerank.jsonl
  --seed <n>       seed for the templates, tie-breaks and random negatives (default 42)
  --negs <n>       negative texts per pair (default 4)
  --mine           take the hard negatives from the map's code vectors (closest 8 labels per question); needs the embedding model
  --help           show this text`;

function parseArgs(argv) {
  const o = {};
  const intArg = (name, v) => { const n = Number(v); if (!Number.isInteger(n) || n < 0) throw new Error(`${name} needs a whole number`); return n; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => { if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`); return argv[++i]; };
    if (a === '--out') o.out = path.resolve(next());
    else if (a === '--seed') o.seed = intArg(a, next());
    else if (a === '--negs') o.negs = intArg(a, next());
    else if (a === '--mine') o.mine = true;
    else throw new Error('unknown argument: ' + a);
  }
  if (!o.out) throw new Error('--out <dir> is required');
  return o;
}

async function run(opts) {
  const seed = opts.seed ?? 42, negs = opts.negs ?? 4;
  const file = mk.dbFile();
  if (!fs.existsSync(file)) throw new Error('no map database yet: run node src/brain.js build-mk all first');
  const names = loadProjects().map((p) => p.name);
  const skip = caseQuestionSkip(new Set(names));

  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true });
  const lines = [], counts = {};
  try {
    for (const name of names) {
      if (!getProject(name)) throw new Error('unknown project: ' + name);
      const seen = new Set(), rows = [];
      const raw = db.prepare("SELECT label, file, deg FROM nodes WHERE kind = 'code' AND file != '' AND project = ? ORDER BY deg ASC").all(name);
      for (const r of raw) {
        const label = String(r.label || '');
        const keep = CLASS_ROW.test(label) || (METHOD_ROW.test(label) && nameCore(label).length >= 5);
        if (!keep || seen.has(label)) continue;   // first row per label (lowest deg)
        seen.add(label); rows.push({ label, file: String(r.file) });
      }
      const hardOf = opts.mine ? await mineHard(db, name, rows, skip, seed, 2) : undefined;
      const pairs = rerankPairs(rows, { seed, negs, skip, hardOf });
      counts[name] = pairs.length;
      for (const p of pairs) lines.push(JSON.stringify({ ...p, project: name }));
    }
  } finally { db.close(); }

  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(path.join(opts.out, 'pairs.rerank.jsonl'), lines.map((l) => l + '\n').join(''));
  return { counts, total: lines.length, out: opts.out };
}

module.exports = { rerankPairs, scenarioAnchors };

if (require.main === module) {
  (async () => {
    if (process.argv.slice(2).includes('--help')) { console.log(USAGE); return; }
    const t0 = Date.now();
    const r = await run(parseArgs(process.argv.slice(2)));
    for (const [name, n] of Object.entries(r.counts)) console.log(`rerank pairs: ${n} (${name})`);
    console.log(`rerank pairs: ${r.total} (total)`);
    console.log(`written to ${r.out}`);
    console.log(`time: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  })().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
