// Optional: tune the meaning model on your own eval questions, score it on a copy of your data, keep it only if it wins.
//   node src/tune/tune.js [--venv <dir>] [--yes]   the whole run: 5 steps (slow on CPU; see docs/TUNING.md)
//                                                  --venv defaults to <dataDir>/tune-venv (made by node src/setup.js --tune)
//   node src/tune/tune.js --rollback               remove embedModel from projects.json (config only)
// Your real data does not change until the scores say keep. The scores run on a copy of the data folder,
// because a model change re-embeds every map and the real maps must stay as they are until the decision.
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const paths = require('../paths.js');
const mk = require('../mk.js');
const { writeAtomic } = require('../rules.js');
const { loadProjects } = require('../projects.js');
const { exportPairs } = require('./export-pairs.js');

const SRC = path.resolve(__dirname, '..');                  // src/
const ROOT = path.resolve(__dirname, '..', '..');           // the plugin folder
const BRAIN = path.join(SRC, 'brain.js');
const EVAL = path.join(ROOT, 'eval', 'eval-map.js');
const TUNED = 'local/gabriel-tuned';
const TRAIN_BASE = 'sentence-transformers/all-MiniLM-L6-v2';   // the PyTorch model the ONNX base model comes from
const STEPS = 5;

// ---- output ----
const bar = (pct) => { const w = 6, f = Math.round((w * pct) / 100); return `[${'#'.repeat(f)}${'-'.repeat(w - f)}] ${pct}%`; };
const stepStart = (k, label) => console.log(`${bar(Math.round((100 * (k - 1)) / STEPS))} step ${k}/${STEPS} ${label}`);
const stepDone = (k, label) => console.log(`${bar(Math.round((100 * k) / STEPS))} step ${k}/${STEPS} ${label}: done`);

// ---- child processes: stop on the first failure ----
function run(cmd, args, env, what) {
  const r = spawnSync(cmd, args, { env, stdio: 'inherit', windowsHide: true });
  if (r.error || r.status !== 0) throw new Error(`${what} failed${r.status != null ? ` (exit ${r.status})` : ''}${r.error ? ` (${r.error.message})` : ''}`);
}
function capture(cmd, args, env, what) {
  const r = spawnSync(cmd, args, { env, encoding: 'utf8', maxBuffer: 256 << 20, windowsHide: true });
  const text = (r.stdout || '') + (r.stderr || '');
  if (r.error || r.status !== 0) {
    const lines = text.trim().split(/\r?\n/), firstErr = lines.find((l) => /error/i.test(l));   // the cause, then the last lines
    throw new Error(`${what} failed${r.status != null ? ` (exit ${r.status})` : ''}: ${[...new Set([firstErr, ...lines.slice(-3)].filter(Boolean))].join(' | ')}`);
  }
  return text;
}

// ---- files ----
const listDir = (d) => (fs.existsSync(d) ? fs.readdirSync(d) : []);
const copyIfThere = (src, dst) => {
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
};
// read-only folders: hard links (same files, no space used), a copy when the volume does not allow links
function linkTree(src, dst, skip = new Set()) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) linkTree(s, d);
    else if (e.isFile()) { try { fs.linkSync(s, d); } catch { fs.copyFileSync(s, d); } }
  }
}

// The copy of the data folder for scoring. Files that get written (maps, vectors, question index, private json) are COPIED:
// a hard link would let a write in the copy change the real file. Models and docs are only read, so they are linked.
function stage(work) {
  const real = paths.dataDir(), T = path.join(work, 'data');
  fs.mkdirSync(T, { recursive: true });
  for (const f of ['mk.db', 'vectors.json', 'graph.json', 'projects.json']) copyIfThere(path.join(real, f), path.join(T, f));
  for (const f of listDir(real)) if (/^dq\..+\.(bin|idx\.json)$/.test(f)) copyIfThere(path.join(real, f), path.join(T, f));
  const priv = path.join(real, 'private');
  for (const e of listDir(priv)) {
    const p = path.join(priv, e);
    if (fs.statSync(p).isFile() && e.endsWith('.json')) copyIfThere(p, path.join(T, 'private', e));
    else if (fs.statSync(p).isDirectory()) for (const f of listDir(p)) if (f.endsWith('.json')) copyIfThere(path.join(p, f), path.join(T, 'private', e, f));
  }
  // "local" holds tuned models: never linked, so a new export can never write into a real model folder
  linkTree(path.join(real, 'models'), path.join(T, 'models'), new Set(['local']));
  // every doc root inside the data folder (docs/<name>, corpus/tech, …): roots outside it are read in place
  for (const p of loadProjects()) {
    const rel = path.relative(real, p.root);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) linkTree(p.root, path.join(T, rel));
  }
  fs.mkdirSync(path.join(work, 'home'), { recursive: true });   // an empty rules home: the run never reads your ~/.claude
  return T;
}

// ---- config (projects.json): only the embedModel key changes ----
function readConfig() {
  try { return JSON.parse(fs.readFileSync(paths.projectsFile(), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function setConfigModel(model) {   // model: an id, or null to remove the key
  // no projects.json yet: write the list the loader derives from the docs folder, so nothing else changes
  const j = readConfig() || { version: 1, projects: loadProjects().map((p) => ({ name: p.name, root: path.join('docs', p.name) })) };
  if (model) j.embedModel = model; else delete j.embedModel;
  fs.mkdirSync(paths.dataDir(), { recursive: true });
  writeAtomic(paths.projectsFile(), JSON.stringify(j, null, 2) + '\n');
}

function venvPython(venv) {
  const py = process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
  if (!fs.existsSync(py)) throw new Error(`python not found at ${py}: create the venv and install src/tune/requirements.txt`);
  return py;
}

// the question index (dq) is embedded with one model: rebuild it for each project that has a question list
function rebuildQuestionIndex(projects, env) {
  for (const p of projects) {
    if (fs.existsSync(path.join(paths.privateDir(p), 'doc-questions.json'))) {
      run(process.execPath, [BRAIN, 'build-dq', '--project', p], env, `question index (${p})`);
    }
  }
}

// ---- scoring ----
// "strict a/b" from the question line, "quiet a/b" from the unrelated line; "-" means no such questions (0/0)
function countOf(text, re, what) {
  const m = text.match(re);
  if (!m) throw new Error(`could not read the ${what} line of eval-map`);
  return { n: Number(m[1] || 0), t: Number(m[2] || 0) };
}
function evalMap(project, env, casesFile) {
  const args = [EVAL, '--project', project];
  if (casesFile) args.push('--cases', casesFile);
  const text = capture(process.execPath, args, env, `eval ${project}${casesFile ? ' (held-out)' : ''}`);
  return {
    strict: countOf(text, /^ {2}.+? questions\s+strict (?:(\d+)\/(\d+)|-)/m, 'strict'),
    quiet: countOf(text, /unrelated questions\s+quiet (?:(\d+)\/(\d+)|-)/, 'quiet'),
  };
}
function measure(label, env, projects, work) {
  const res = { held: {}, full: {}, quiet: {} };
  for (const p of projects) {
    const full = evalMap(p, env, null);
    res.full[p] = full.strict; res.quiet[p] = full.quiet;
    const hc = path.join(work, 'pairs', `${p}.heldout-cases.json`);
    const n = fs.existsSync(hc) ? JSON.parse(fs.readFileSync(hc, 'utf8')).length : 0;
    if (n) res.held[p] = evalMap(p, env, hc).strict;
    console.log(`  ${label} ${p}: full ${full.strict.n}/${full.strict.t}${n ? `, held-out ${res.held[p].n}/${res.held[p].t}` : ''}, quiet ${full.quiet.n}/${full.quiet.t}`);
  }
  return res;
}
function score(T, work, projects) {
  const scrub = (extra) => { const e = { ...process.env, ...extra }; delete e.GABRIEL_EMBED_MODEL; delete e.BRAIN_DATA; return e; };
  const envBase = scrub({ GABRIEL_DATA: T, BRAIN_HOME: path.join(work, 'home') });
  const envTuned = { ...envBase, GABRIEL_EMBED_MODEL: TUNED };
  // both sides use maps built from the same docs (the base side is rebuilt here too, in the copy only)
  run(process.execPath, ['--max-old-space-size=4096', BRAIN, 'build-mk', 'all'], envBase, 'build maps (base)');
  const base = measure('base ', envBase, projects, work);
  run(process.execPath, ['--max-old-space-size=4096', BRAIN, 'build-mk', 'all'], envTuned, 'build maps (tuned)');
  rebuildQuestionIndex(projects, envTuned);
  const tuned = measure('tuned', envTuned, projects, work);
  return { base, tuned };
}

const tot = (obj) => Object.values(obj).reduce((a, r) => a + r.n, 0);
const totT = (obj) => Object.values(obj).reduce((a, r) => a + r.t, 0);

// keep rule: held-out total strictly higher; no project's held-out lower by more than 1; full strict not lower; quiet not lower
function decide(base, tuned) {
  const reasons = [];
  if (!(tot(tuned.held) > tot(base.held))) reasons.push(`held-out total did not go up (${tot(base.held)} -> ${tot(tuned.held)})`);
  for (const p of Object.keys(base.held)) {
    if (tuned.held[p].n - base.held[p].n < -1) reasons.push(`${p} held-out fell by more than 1 (${base.held[p].n} -> ${tuned.held[p].n})`);
  }
  if (tot(tuned.full) < tot(base.full)) reasons.push(`full strict fell (${tot(base.full)} -> ${tot(tuned.full)})`);
  if (tot(tuned.quiet) < tot(base.quiet)) reasons.push(`quiet fell (${tot(base.quiet)} -> ${tot(tuned.quiet)})`);
  return { keep: reasons.length === 0, reasons };
}

function printTable(base, tuned) {
  const f = (r) => `${r.n}/${r.t}`;
  const rows = [];
  for (const p of Object.keys(base.held)) rows.push([`${p} held-out`, f(base.held[p]), f(tuned.held[p])]);
  for (const p of Object.keys(base.full)) rows.push([`${p} full strict`, f(base.full[p]), f(tuned.full[p])]);
  const sum = (o) => ({ n: tot(o), t: totT(o) });
  rows.push(['held-out total', f(sum(base.held)), f(sum(tuned.held))]);
  rows.push(['full strict total', f(sum(base.full)), f(sum(tuned.full))]);
  rows.push(['quiet total', f(sum(base.quiet)), f(sum(tuned.quiet))]);
  const w = Math.max(...rows.map((r) => r[0].length), 18);
  console.log('\n' + ['measure'.padEnd(w), 'before'.padStart(9), 'after'.padStart(9), 'change'.padStart(8)].join('  '));
  for (const [label, b, a] of rows) {
    const d = Number(a.split('/')[0]) - Number(b.split('/')[0]);
    console.log([label.padEnd(w), b.padStart(9), a.padStart(9), (d > 0 ? '+' : '') + d].join('  ').replace(/\s+$/, ''));
  }
}

// ---- keep or roll back ----
function keepModel(T, projects) {
  const dst = path.join(paths.modelsDir(), 'local', 'gabriel-tuned');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(path.join(T, 'models', 'local', 'gabriel-tuned'), dst, { recursive: true });
  setConfigModel(TUNED);
  const env = { ...process.env }; delete env.GABRIEL_EMBED_MODEL;
  rebuildQuestionIndex(projects, env);
  console.log(`kept: ${TUNED} is now the meaning model (projects.json embedModel). The next prompt rebuilds each map once, in the background.`);
}
function rollBackModel() {   // the real data was never changed, so only the (unused) real model folder can go
  fs.rmSync(path.join(paths.modelsDir(), 'local', 'gabriel-tuned'), { recursive: true, force: true });
}

// ---- main ----
function parseArgs(argv) {
  const o = { rollback: false, yes: false, venv: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--rollback') o.rollback = true;
    else if (a === '--yes') o.yes = true;
    else if (a === '--venv') { if (argv[i + 1] === undefined) throw new Error('--venv needs a folder'); o.venv = path.resolve(argv[++i]); }
    else throw new Error('unknown argument: ' + a);
  }
  return o;
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(/^y(es)?$/i.test(answer.trim())); });
  });
}

async function main(argv) {
  const o = parseArgs(argv);
  if (o.rollback) {
    const cur = readConfig();
    if (!cur || !cur.embedModel) { console.log('nothing to roll back: projects.json has no embedModel'); return 0; }
    setConfigModel(null);
    rebuildQuestionIndex(loadProjects().map((p) => p.name), { ...process.env, GABRIEL_EMBED_MODEL: '' });
    console.log(`removed embedModel "${cur.embedModel}" from projects.json. The next prompt rebuilds each map once with the default model.`);
    return 0;
  }
  if (!o.venv) o.venv = path.join(paths.dataDir(), 'tune-venv');
  if (!fs.existsSync(o.venv)) throw new Error(`no tune venv at ${o.venv}: run /gabriel:setup --tune first (or node src/setup.js --tune)`);
  venvPython(o.venv);   // fails early when the venv has no python
  const cur = readConfig();
  if (cur && cur.embedModel) throw new Error(`projects.json already sets embedModel "${cur.embedModel}". Run --rollback first, then tune again.`);
  const projects = loadProjects().map((p) => p.name).filter((n) => fs.existsSync(path.join(paths.privateDir(n), 'eval-cases.json')));
  if (!projects.length) throw new Error('no eval cases yet: write eval-cases.json for a project first (docs/EVAL.md)');
  if (!fs.existsSync(mk.dbFile())) throw new Error('no map yet: run node src/brain.js build-mk all first');
  if (!o.yes) {
    if (!process.stdin.isTTY) throw new Error('this run downloads packages and can take a long time: add --yes to start');
    if (!(await ask('Start the tune run? It can take a long time and downloads packages. (y/N) '))) throw new Error('cancelled');
  }

  const work = path.join(paths.dataDir(), 'tune', 'work');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const venvPy = venvPython(o.venv);
  try {
    const T = stage(work);
    stepStart(1, 'export pairs');
    const pairs = exportPairs({ out: path.join(work, 'pairs') });
    console.log(`  ${pairs.train} train pairs, ${pairs.heldout} held-out pairs`);
    stepDone(1, 'export pairs');

    stepStart(2, 'train (CPU, can be slow)');
    run(venvPy, [path.join(SRC, 'tune', 'train.py'), '--base', TRAIN_BASE, '--pairs', path.join(work, 'pairs'), '--out', path.join(work, 'model')], process.env, 'train');
    stepDone(2, 'train');

    stepStart(3, 'export ONNX');
    run(process.execPath, [path.join(SRC, 'tune', 'export-onnx.js'), '--model', path.join(work, 'model'),
      '--out', path.join(T, 'models', 'local', 'gabriel-tuned'), '--venv', o.venv], process.env, 'export ONNX');
    stepDone(3, 'export ONNX');

    stepStart(4, 'score on a copy');
    const res = score(T, work, projects);
    stepDone(4, 'score on a copy');

    stepStart(5, 'keep or roll back');
    const d = decide(res.base, res.tuned);
    if (d.keep) keepModel(T, projects);
    else {
      rollBackModel();
      console.log(`rolled back: the current model stays (projects.json unchanged). Numbers that fell or failed the rule: ${d.reasons.join('; ')}`);
    }
    stepDone(5, 'keep or roll back');
    printTable(res.base, res.tuned);
    return 0;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });   // hard links only: the real files stay
  }
}

module.exports = { decide, parseArgs };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((e) => {
    console.error(`stopped: ${e.message}`);
    process.exitCode = 1;
  });
}
