#!/usr/bin/env node
// One-shot setup: checks node, installs packages, fetches the model, builds the rules graph and the doc maps, runs the tests.
// Usage: node src/setup.js [--dry-run] [--skip-model] [--skip-test] [--yes] [--data <dir>] [--only model|build|test]
//        node src/setup.js --tune [--dry-run] [--data <dir>]     (optional: Python packages for the tune run, see docs/TUNING.md)
// Safe to run again. Writes only inside the data folder (and node_modules when packages change).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { SUPPORTED, OPT_IN, extSet, isDocName, skipName, pdfHasSupport } = require('./extract.js');

const SRC = __dirname;
const ROOT = path.resolve(__dirname, '..');
const TOTAL = 10;
const MODEL_FILE = ['onnx', 'model_quantized.onnx'];
const RETRY_WAITS = [5000, 15000, 45000];
const OLD_BRAIN = path.join(os.homedir(), '.claude', 'brain');
const GRAPHIFY_SKILL = path.join(os.homedir(), '.claude', 'skills', 'graphify', 'SKILL.md');
const ONLY_STEPS = { model: [5], build: [7, 8], test: [9] };
const TUNE_STEPS = 6;
const TORCH_INDEX = 'https://download.pytorch.org/whl/cpu';
const TUNE_REQ = path.join(SRC, 'tune', 'requirements.txt');
const PY_HELP = 'Install Python 3.10 or newer from https://www.python.org/ and open a new terminal.';

const line = (msg) => console.log('  ' + msg);

// A leading ~, ~/ or ~\ means the home folder. Any other path is returned as it is.
function expandHome(p) {
  const s = String(p);
  if (s === '~') return os.homedir();
  if (/^~[\\/]/.test(s)) return path.join(os.homedir(), s.slice(2));
  return s;
}
const step = (n, text) => console.log(`[${'#'.repeat(n).padEnd(TOTAL, '-')}] ${String(n * 10).padStart(3)}% step ${n}/${TOTAL}: ${text}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

function parseArgs(argv) {
  const o = { dryRun: false, skipModel: false, skipTest: false, yes: false, data: null, only: null, tune: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--skip-model') o.skipModel = true;
    else if (a === '--skip-test') o.skipTest = true;
    else if (a === '--yes') o.yes = true;
    else if (a === '--tune') o.tune = true;
    else if (a === '--data' || a === '--only') {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`);
      if (a === '--data') o.data = v; else o.only = v;
    } else throw new Error('unknown option: ' + a);
  }
  if (o.only === 'tune') { o.only = null; o.tune = true; }
  if (o.only && !ONLY_STEPS[o.only]) throw new Error('--only must be model, build, test or tune');   // tune is valid: it is mapped to --tune above
  if (o.tune && o.only) throw new Error('--tune cannot be used with --only');
  return o;
}

// Runs src/<script> with node. Returns the spawn result.
function runNode(args, { skipModel = false, heap = false, capture = false } = {}) {
  const execArgs = heap ? ['--max-old-space-size=4096'] : [];
  return spawnSync(process.execPath, [...execArgs, ...args], {
    cwd: ROOT, env: skipModel ? { ...process.env, GABRIEL_NO_DOWNLOAD: '1' } : process.env, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

// Counts the doc files under a doc folder (skips the same folders the map skips). Returns null when the folder is missing.
function countDocs(root, extensions) {
  if (!root || !fs.existsSync(root)) return null;
  const skip = new Set(['graphify-out', 'node_modules', '.git', 'atlas', '_tools']), exts = extSet(extensions);
  let n = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!skip.has(e.name)) walk(path.join(d, e.name)); } else if (isDocName(e.name, exts)) n++; } };
  walk(root);
  return n;
}

async function fetchModel(modelsDir, modelFile) {
  const embedPath = path.join(SRC, 'embed.js');
  const script = `const e=require(${JSON.stringify(embedPath)});e.getEmbedder(true, e.BASE_MODEL).then((p)=>process.exit(p?0:1));`;
  for (let attempt = 0; attempt <= RETRY_WAITS.length; attempt++) {
    if (attempt > 0) {
      line(`retry ${attempt} of ${RETRY_WAITS.length} in ${RETRY_WAITS[attempt - 1] / 1000} s`);
      await sleep(RETRY_WAITS[attempt - 1]);
    }
    fs.mkdirSync(modelsDir, { recursive: true });
    const r = spawnSync(process.execPath, ['-e', script], { cwd: ROOT, env: process.env, stdio: 'inherit' });
    if (r.status === 0 && fs.existsSync(modelFile)) return true;
  }
  return false;
}

// ---- add-docs: node src/setup.js add-docs <name> <folder> [--copy] [--code <repo>] [--repo <folder>] [--yes] [--data <dir>]; or add-docs <name> --code <repo> --relink ----
const DOC_EXT = SUPPORTED, CODE_EXT = ['.cs', '.ts', '.js', '.py', '.java', '.go'];   // DOC_EXT: the default types the map reads (extract.js); opt-in types (OPT_IN) are counted apart
const ADD_SKIP = new Set(['graphify-out', 'node_modules', '.git']);
const MAX_DOC_FILES = 20000, MAX_DOC_BYTES = 500 * 1024 * 1024;
const ADD_USAGE = 'usage: node src/setup.js add-docs <name> <folder> [--copy] [--code <repo>] [--repo <folder>] [--yes] [--data <dir>]\n       node src/setup.js add-docs <name> --code <repo> --relink [--data <dir>]\n       node src/setup.js add-docs <name> --repo <folder> --relink [--data <dir>]';

// Doc files under a folder (paths relative to it, subfolders kept), their total size, and the opt-in files left out (count per extension).
function listDocFiles(root) {
  const files = [], optIn = new Map(), readable = extSet(DOC_EXT);
  let bytes = 0;
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name), r = path.join(rel, e.name);
      if (e.isDirectory()) { if (!ADD_SKIP.has(e.name)) walk(p, r); }
      else if (isDocName(e.name, readable)) { files.push(r); bytes += fs.statSync(p).size; }
      else {
        const x = path.extname(e.name).toLowerCase();
        if (OPT_IN.includes(x) && !skipName(e.name)) optIn.set(x, (optIn.get(x) || 0) + 1);
      }
    }
  };
  walk(root, '');
  return { files, bytes, optIn };
}

// "8 .md, 3 .pdf, 1 .docx": counts per extension, most files first
const countLine = (files) => {
  const by = new Map();
  for (const f of files) { const x = path.extname(f).toLowerCase(); by.set(x, (by.get(x) || 0) + 1); }
  return [...by].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([x, n]) => `${n} ${x}`).join(', ');
};

// True when a code file sits within two levels of the folder (the folder itself is level 0).
function hasCodeFiles(root) {
  const walk = (dir, level) => fs.readdirSync(dir, { withFileTypes: true }).some((e) => {
    if (e.isDirectory()) return level < 2 && !ADD_SKIP.has(e.name) && walk(path.join(dir, e.name), level + 1);
    return CODE_EXT.includes(path.extname(e.name).toLowerCase());
  });
  return walk(root, 0);
}

// The graph path stored in projects.json. mk.build joins root + graph, so it must be relative to root. Null when no relative path exists (another drive).
function graphRel(root, graphFile) {
  const rel = path.relative(root, graphFile).split(path.sep).join('/');
  return path.isAbsolute(rel) ? null : rel;
}

// Write JSON to a temp file, then rename it over the target (a reader sees the old or the new file, never half).
function writeJsonAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try { fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n'); require('./paths.js').moveIntoPlace(tmp, file); }
  catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
}

// Rebuilds one doc set's map in a child process (it reads projects.json, so call it after the write). Prints the map line. Returns the exit status.
function buildMap(name) {
  const r = runNode([path.join(SRC, 'brain.js'), 'build-mk', name], { heap: true, capture: true });
  const out = `${r.stdout || ''}${r.stderr || ''}`.split('\n').map((s) => s.trim()).filter(Boolean);
  console.log(out.find((l) => /^map (built|not built)/.test(l)) || out[out.length - 1] || '(no output)');
  for (const l of out) if (/^warning: /.test(l)) console.log(l);   // e.g. the docs name almost none of the graph's code
  return r.status;
}

// cwdHints for --code: the lower-case name of the git repo root above codeDir (walks up for a .git entry; no git call), else codeDir's own name.
function codeHintName(codeDir) {
  for (let d = codeDir; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return path.basename(d).toLowerCase();
    if (path.dirname(d) === d) break;   // drive root
  }
  return path.basename(codeDir).toLowerCase();
}

// ---- --repo: the code folder of a doc set, checked against the graph before it is saved (prints "repo set for" or "repo refused") ----
// Returns { repo, repoBase } to store, or null when refused.
function checkRepoArg(name, repoArg, graphFile) {
  const { checkRepo } = require('./repo.js');
  const repo = path.resolve(expandHome(repoArg));
  if (!graphFile || !fs.existsSync(graphFile)) { console.log('repo refused: this doc set has no code graph'); return null; }
  const r = checkRepo(repo, graphFile);
  if (!r.ok) { console.log(`repo refused: ${r.reason}`); return null; }
  console.log(`repo set for ${name}: ${repo} (${r.found}/${r.sampled} graph files found)`);
  return { repo, repoBase: r.base };
}

// Adds one doc set. Prints its lines. Returns the exit code. Every check runs before any write, so an error leaves projects.json unchanged.
// A docs or graph folder inside the plugin cache is lost on the next plugin update: refuse it before any write.
function pluginPathRefusal(dir, name) {
  const { insidePluginCache, dataDir } = require('./paths.js');
  if (!insidePluginCache(dir)) return null;
  return `refused: ${dir} is inside the plugin cache, which a plugin update replaces. Use ${path.join(dataDir(), 'this-machine-repo-docs', name)}.`;
}

async function addDocs(argv) {
  const { checkName, dataDir, docsDir, projectsFile, insidePluginCache } = require('./paths.js');
  const { loadProjects } = require('./projects.js');
  const fail = (msg) => { console.error(msg); return 1; };
  const opt = { copy: false, code: null, repo: null, yes: false, relink: false }, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--copy') opt.copy = true;
    else if (a === '--yes') opt.yes = true;
    else if (a === '--relink') opt.relink = true;
    else if (a === '--code' || a === '--repo' || a === '--data') {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`);
      if (a === '--code') opt.code = v; else if (a === '--repo') opt.repo = v; else process.env.GABRIEL_DATA = path.resolve(expandHome(v));
    } else if (a.startsWith('--')) throw new Error('unknown option: ' + a);
    else pos.push(a);
  }
  if (opt.relink ? pos.length !== 1 : pos.length !== 2) throw new Error(ADD_USAGE);
  if (opt.relink) return relinkDocs(pos[0], opt);
  const [name, folderArg] = pos;

  checkName(name);
  const folder = path.resolve(expandHome(folderArg));
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return fail(`folder not found: ${folderArg}`);
  const { files, bytes, optIn } = listDocFiles(folder);
  if (!files.length) return fail(`0 docs found in ${folderArg}`);
  console.log(`found ${files.length} docs: ${countLine(files)}`);
  for (const [x, n] of optIn) console.log(`${n} ${x} files not read (add "${x.slice(1)}" to extensions to include them)`);
  if (files.some((f) => path.extname(f).toLowerCase() === '.pdf') && !(await pdfHasSupport())) {
    console.log('PDF files found but pdfjs-dist is not installed: run npm ci --omit=dev in the plugin folder');
  }
  if (loadProjects().some((p) => p.name === name)) return fail(`project ${name} already exists`);
  if ((files.length > MAX_DOC_FILES || bytes > MAX_DOC_BYTES) && !opt.yes) {
    return fail(`too big: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB (limit ${MAX_DOC_FILES} files, ${MAX_DOC_BYTES / 1048576} MB). Add --yes to add it anyway.`);
  }
  const dest = docsDir(name);
  if (opt.copy && fs.existsSync(dest)) return fail(`folder already exists: ${dest}. Remove it or pick another name.`);
  const codeDir = opt.code ? path.resolve(expandHome(opt.code)) : folder;
  if (!fs.existsSync(codeDir)) return fail(`code folder not found: ${opt.code}`);
  // --copy moves the docs out to <data>/docs/<name>, so a source in the cache is fine; a graph left in the cache is not linked
  const folderInCache = insidePluginCache(folder);
  const refused = (!opt.copy && pluginPathRefusal(folder, name)) || (opt.code && pluginPathRefusal(codeDir, name));
  if (refused) return fail(refused);
  // with --code, the graph must be in that repo (no fallback to the docs folder)
  if (opt.code && !fs.existsSync(path.join(codeDir, 'graphify-out', 'graph.json'))) return fail(`no graphify-out/graph.json in ${codeDir}: run /graphify ${codeDir} first, or leave out --code`);

  // code graph: the --code repo first, then the docs folder
  const root = opt.copy ? dest : folder;
  const graphFile = folderInCache && !opt.code ? null : [path.join(codeDir, 'graphify-out', 'graph.json'), path.join(folder, 'graphify-out', 'graph.json')].find((f) => fs.existsSync(f));
  if (folderInCache && !opt.code) console.log('the source is in the plugin cache: its code graph is not linked. Add one later with --code <folder> --relink.');
  let graph = null;
  if (graphFile) {
    graph = graphRel(root, graphFile);
    if (graph) console.log('code graph found: linking docs to code');
    else console.log('code graph is on another drive, so it cannot be linked. The docs work without it.');
  } else if (hasCodeFiles(codeDir)) {
    console.log(`For better results with code, run /graphify ${opt.code || folderArg}; gabriel reads its graphify-out/graph.json.`);
  }
  const repoSet = opt.repo ? checkRepoArg(name, opt.repo, graphFile) : null;
  if (opt.repo && !repoSet) return 1;

  if (opt.copy) {
    try {
      for (const f of files) { fs.mkdirSync(path.dirname(path.join(dest, f)), { recursive: true }); fs.copyFileSync(path.join(folder, f), path.join(dest, f)); }
    } catch (e) { fs.rmSync(dest, { recursive: true, force: true }); return fail(`copy failed: ${e.message}`); }
  }

  // projects.json: with no file yet, start from the folders under docs/ (the same list loadConfig uses), so nothing disappears
  const file = projectsFile();
  let j;
  if (fs.existsSync(file)) {
    j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j.version !== 1) throw new Error(`projects.json version ${j.version} is not supported (expected 1)`);
    j.projects = j.projects || [];
  } else {
    const docs = path.join(dataDir(), 'docs');
    j = { version: 1, projects: [] };
    for (const e of fs.existsSync(docs) ? fs.readdirSync(docs, { withFileTypes: true }) : []) {
      if (!e.isDirectory() || e.name === name) continue;   // the new name is added below (a --copy just made its folder)
      if (!require('./projects.js').hasFiles(path.join(docs, e.name))) continue;   // empty (like docs/stack): /gabriel:update adds it once it has files
      try { checkName(e.name); } catch { console.log(`skipped folder with a bad name: ${e.name}`); continue; }
      j.projects.push({ name: e.name, root: 'docs/' + e.name, aliases: [e.name] });   // aliases: naming the set in a prompt routes to it
    }
  }
  const hints = opt.code ? { cwdHints: [codeHintName(codeDir)] } : {};
  const repoFields = repoSet ? { repo: repoSet.repo, repoBase: repoSet.repoBase } : {};
  j.projects.push({ name, label: name, root: opt.copy ? 'docs/' + name : folder, layout: 'auto', graph, aliases: [name], ...hints, ...repoFields });
  try { writeJsonAtomic(file, j); }
  catch (e) { if (opt.copy) fs.rmSync(dest, { recursive: true, force: true }); return fail(`cannot write projects.json: ${e.message}`); }

  // build the map (a child process reads projects.json, so this runs after the write)
  if (buildMap(name) !== 0) return fail(`${name} is in projects.json but its map was not built. Retry: node "${path.join(SRC, 'brain.js')}" build-mk ${name}`);
  console.log(`added ${name}: ${files.length} docs`);
  return 0;
}

// ---- --relink: node src/setup.js add-docs <name> --code <repo> --relink. Sets only the code graph of an existing doc set, then rebuilds its map ----
function relinkDocs(name, opt) {
  const { checkName, projectsFile } = require('./paths.js');
  const { loadProjects } = require('./projects.js');
  const fail = (msg) => { console.error(msg); return 1; };
  checkName(name);
  const file = projectsFile();
  const P = fs.existsSync(file) ? loadProjects().find((p) => p.name === name) : null;
  if (!P) return fail(`unknown doc set: ${name}`);
  if (!opt.code && !opt.repo) return fail('--relink needs --code <repo> or --repo <folder>');
  if (opt.repo) {   // checked against the set's current graph; --repo alone needs no --code
    const { graphPathOf } = require('./mk.js');
    const repoSet = checkRepoArg(name, opt.repo, graphPathOf(name));
    if (!repoSet) return 1;
    const j0 = JSON.parse(fs.readFileSync(file, 'utf8'));
    const e0 = (j0.projects || []).find((p) => p.name === name);
    e0.repo = repoSet.repo; e0.repoBase = repoSet.repoBase;
    try { writeJsonAtomic(file, j0); } catch (e) { return fail(`cannot write projects.json: ${e.message}`); }
    if (!opt.code) return 0;
  }
  const codeDir = path.resolve(expandHome(opt.code));
  if (!fs.existsSync(codeDir)) return fail(`code folder not found: ${opt.code}`);
  const refused = pluginPathRefusal(codeDir, name);
  if (refused) return fail(refused);
  const graphFile = path.join(codeDir, 'graphify-out', 'graph.json');
  if (!fs.existsSync(graphFile)) return fail(`no graphify-out/graph.json in ${codeDir}: run /graphify ${codeDir} first, or leave out --code`);
  const graph = graphRel(P.root, graphFile);   // relative to the doc set's root, as add-docs stores it
  if (!graph) return fail('code graph is on another drive, so it cannot be linked. The docs work without it.');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (j.version !== 1) throw new Error(`projects.json version ${j.version} is not supported (expected 1)`);
  const entry = (j.projects || []).find((p) => p.name === name);
  if (!entry) return fail(`unknown doc set: ${name}`);
  entry.graph = graph;
  try { writeJsonAtomic(file, j); }
  catch (e) { return fail(`cannot write projects.json: ${e.message}`); }
  console.log(`relinked ${name}: graph ${graph}`);
  if (buildMap(name) !== 0) return fail(`${name} is in projects.json but its map was not built. Retry: node "${path.join(SRC, 'brain.js')}" build-mk ${name}`);
  return 0;
}

// ---- --update: node src/setup.js --update [--dry-run] [--data <dir>]. Safe to run again. Steps: register new doc folders, rebuild stale maps, suggest cases for new sections ----
const UPDATE_USAGE = 'usage: node src/setup.js --update [--dry-run] [--data <dir>]';
const UPDATE_STEPS = 5;
const ustep = (k, text) => console.log(`[${'#'.repeat(k).padEnd(UPDATE_STEPS, '-')}] ${String(Math.round((k * 100) / UPDATE_STEPS)).padStart(3)}% step ${k}/${UPDATE_STEPS}: ${text}`);

async function update(argv) {
  const paths = require('./paths.js');
  const mk = require('./mk.js');
  const { loadConfig, loadProjects } = require('./projects.js');
  const { newSuggestions } = require('../eval/suggest-cases.js');
  let dry = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') dry = true;
    else if (a === '--data') {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error('--data needs a value');
      process.env.GABRIEL_DATA = path.resolve(expandHome(v));
    } else throw new Error('unknown option: ' + a);
  }
  const { checkName } = paths;
  const home = paths.rulesHome(), dataRoot = paths.dataDir(), file = paths.projectsFile(), docsRoot = path.join(dataRoot, 'docs');
  const counts = { added: 0, rebuilt: 0, upToDate: 0, newCases: 0, failed: 0 };
  const mapLine = (r) => { const out = `${r.stdout || ''}${r.stderr || ''}`.split('\n').map((s) => s.trim()).filter(Boolean); return out.find((l) => /^map (built|not built)/.test(l)) || out[out.length - 1] || '(no output)'; };
  if (dry) console.log('(dry run) nothing will be changed');

  // 0: sets made before aliases existed get their name as alias (so a prompt that names the set routes to it)
  if (fs.existsSync(file)) {
    const j0 = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j0.version !== 1) throw new Error(`projects.json version ${j0.version} is not supported (expected 1)`);
    let aliased = 0;
    for (const p of j0.projects || []) if (!p.fallback && !(p.aliases || []).length) { p.aliases = [p.name]; aliased++; line(`set alias for ${p.name}`); }
    if (aliased && !dry) writeJsonAtomic(file, j0);
  }

  // 1: new folders under docs/ become doc sets (only when projects.json exists: with no file, auto mode already sees them)
  ustep(1, 'register new doc folders');
  if (!fs.existsSync(file)) line('no projects.json: auto mode reads every folder under docs/, so new folders are used already');
  else {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j.version !== 1) throw new Error(`projects.json version ${j.version} is not supported (expected 1)`);
    j.projects = j.projects || [];
    const have = new Set(j.projects.map((p) => p.name)), roots = new Set(loadProjects().map((p) => path.resolve(p.root)));
    const folders = fs.existsSync(docsRoot) ? fs.readdirSync(docsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
    const add = [];
    for (const f of folders) {
      const dir = path.join(docsRoot, f);
      if (roots.has(path.resolve(dir))) continue;   // already a doc set
      try { checkName(f); } catch { line(`skipped docs/${f}: bad name (a-z, 0-9, - or _, up to 40)`); continue; }
      if (have.has(f)) { line(`skipped docs/${f}: a project named ${f} already exists with another folder`); continue; }
      if (!listDocFiles(dir).files.length) { line(`skipped docs/${f}: no doc files in it yet`); continue; }
      add.push(f);
    }
    for (const f of add) {
      if (dry) { line(`(dry run) would add doc set ${f}`); continue; }
      j.projects.push({ name: f, label: f, root: 'docs/' + f, aliases: [f] });
    }
    if (!dry && add.length) writeJsonAtomic(file, j);
    for (const f of add) { if (!dry) line(`added doc set ${f}`); counts.added++; }
    if (!add.length) line('no new doc folders');
  }

  // 2: rebuild the doc sets that are stale (or have no map yet)
  ustep(2, 'rebuild stale doc sets');
  const projects = loadProjects();
  if (!projects.length) line(`no doc sets yet: put Markdown folders in ${docsRoot}/`);
  for (const p of projects) {
    if (!fs.existsSync(p.root)) { line(`warning: ${p.name}: folder not found (${p.root}), skipped`); continue; }
    if (!mk.hasMap(home, p.name) || mk.stale(home, p.name)) {
      if (dry) { line(`(dry run) would rebuild ${p.name}`); counts.rebuilt++; continue; }
      const r = runNode([path.join(SRC, 'brain.js'), 'build-mk', p.name], { heap: true, capture: true });
      line(`${p.name}: ${mapLine(r)}`);
      if (r.status !== 0) { counts.failed++; line(`${p.name} is not rebuilt. Retry: node "${path.join(SRC, 'brain.js')}" build-mk ${p.name}`); }
      else counts.rebuilt++;
    } else { line(`up to date: ${p.name}`); counts.upToDate++; }
  }

  // 3: suggested cases for new sections only (sets that have reviewed eval-cases.json). Never writes eval-cases.json.
  ustep(3, 'suggest cases for new sections');
  for (const p of projects) {
    const priv = paths.privateDir(p.name), casesFile = path.join(priv, 'eval-cases.json'), sugFile = path.join(priv, 'eval-cases.suggested.json');
    if (!fs.existsSync(casesFile) || !fs.existsSync(p.root)) continue;
    const reviewed = readJson(casesFile), old = readJson(sugFile) || [];
    if (!Array.isArray(reviewed) || !Array.isArray(old)) { line(`${p.name}: eval-cases.json or eval-cases.suggested.json is not a list, skipped`); continue; }
    const { fresh, cases } = newSuggestions(p.name, reviewed, old);   // a section is new only when no reviewed or suggested case covers it
    counts.newCases += fresh.length;
    if (dry) { line(`${p.name}: (dry run) would add ${fresh.length} new suggested case(s)`); continue; }
    if (!fresh.length) { line(`${p.name}: 0 new suggested cases`); continue; }
    writeJsonAtomic(sugFile, cases);
    line(`${p.name}: ${fresh.length} new suggested cases (review them in ${sugFile})`);
  }

  // 4: next steps (printed only, nothing heavy runs)
  ustep(4, 'next steps');
  for (const p of projects) if (fs.existsSync(path.join(paths.privateDir(p.name), 'eval-cases.json'))) line(`run /gabriel:retrain ${p.name} to update the ranker`);
  const embedModel = (() => { try { return loadConfig().embedModel; } catch { return null; } })();
  if (embedModel && embedModel.startsWith('local/')) line('run /gabriel:tune-embeddings to re-tune with the new cases (it keeps the new model only if scores hold)');

  // 5: summary
  ustep(5, 'summary');
  line(`${dry ? '(dry run) ' : ''}summary: ${counts.added} added, ${counts.rebuilt} rebuilt, ${counts.upToDate} up to date, ${counts.newCases} new suggested cases${counts.failed ? `, ${counts.failed} failed` : ''}`);
  return counts.failed ? 1 : 0;
}

// ---- hosts: node src/setup.js --host <codex|gemini> [--apply]   |   node src/setup.js --remove-host <name> --apply ----
// Prints the hook config by default. Writes only with --apply: a backup first, then a JSON check, then the file. Other hooks are never removed.
const HOST_USAGE = 'usage: node src/setup.js --host <claude|codex|gemini|copilot> [--apply]\n       node src/setup.js --remove-host <claude|codex|gemini|copilot> --apply';
const GABRIEL_HOOK = /brain\.js"?\s+(hook|touched)\b/;   // the command gabriel writes: node "<plugin>/src/brain.js" hook|touched --host <name>
const isGabriel = (cmd, name) => typeof cmd === 'string' && GABRIEL_HOOK.test(cmd) && cmd.includes(`--host ${name}`);
const subcommand = (cmd) => (GABRIEL_HOOK.exec(cmd) || [])[1];

// Adds gabriel's groups to hooks (the "hooks" object of the file). A gabriel hook that is already there is updated, never doubled.
function addGabriel(hooks, want, name) {
  const out = { added: [], updated: [] };
  for (const [event, groups] of Object.entries(want)) {
    if (hooks[event] !== undefined && !Array.isArray(hooks[event])) throw new Error(`"${event}" in the hooks file is not a list. Nothing was changed.`);
    const list = hooks[event] || (hooks[event] = []);
    for (const group of groups) {
      const h = group.hooks[0];
      const mine = list.flatMap((g) => (Array.isArray(g.hooks) ? g.hooks : []).filter((x) => isGabriel(x.command, name) && subcommand(x.command) === subcommand(h.command)));
      if (!mine.length) { list.push(structuredClone(group)); out.added.push(`${event}: ${h.command}`); continue; }
      for (const x of mine) if (x.command !== h.command || x.timeout !== h.timeout) { x.command = h.command; x.timeout = h.timeout; out.updated.push(`${event}: ${h.command}`); }
    }
  }
  return out;
}

// Removes only gabriel's hooks for this host. A group is dropped only when removing left it empty.
function removeGabriel(hooks, name) {
  const removed = [];
  for (const event of Object.keys(hooks)) {
    if (!Array.isArray(hooks[event])) continue;
    const keep = [];
    let touched = false;
    for (const group of hooks[event]) {
      if (!Array.isArray(group.hooks)) { keep.push(group); continue; }
      const before = group.hooks.length;
      group.hooks = group.hooks.filter((x) => !isGabriel(x.command, name));
      const n = before - group.hooks.length;
      if (n) { touched = true; removed.push(`${event}: ${n} hook(s)`); }
      if (group.hooks.length || !n) keep.push(group);
    }
    if (!touched) continue;
    if (keep.length) hooks[event] = keep; else delete hooks[event];
  }
  return { removed };
}

function hostSetup(argv) {
  const hostsMod = require('./hosts/index.js');
  const remove = argv.includes('--remove-host'), flag = remove ? '--remove-host' : '--host';
  const name = argv[argv.indexOf(flag) + 1], apply = argv.includes('--apply');
  for (const a of argv) if (![flag, name, '--apply'].includes(a)) throw new Error('unknown option: ' + a);
  if (!name || name.startsWith('--')) throw new Error(`${flag} needs a host name`);
  const host = hostsMod.get(name);
  if (!host.setup) {
    line(host.name === 'claude'
      ? (remove ? 'claude: remove the gabriel plugin in Claude Code (/plugin). setup.js writes nothing for it.' : 'claude: installed as a Claude Code plugin. setup.js writes nothing for it.')
      : host.name === 'copilot'
        ? `copilot: Copilot ignores what a prompt hook prints, so no hook file is written. Add these lines to ${path.join(host.rulesHome(), 'copilot-instructions.md')}:
`
          + `  Before you answer a question about a project, run: node "${path.join(ROOT, 'src', 'brain.js')}" context "<the question>" --host copilot${process.env.GABRIEL_DATA ? ` --data "${process.env.GABRIEL_DATA}"` : ''}
`
          + '  Use its map as a lead: name the doc or file it points to, then confirm in the code.'
        : `${host.name}: no hook file. Call node "${path.join(ROOT, 'src', 'brain.js')}" context "<prompt>" --host ${host.name} from your tool.`);
    return 0;
  }
  const file = host.setup.configFile(), want = host.setup.entries(ROOT);
  let cfg = {};
  if (fs.existsSync(file)) {
    try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file} is not valid JSON (${e.message}). Nothing was changed. Fix it, then run again.`); }
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new Error(`${file} must hold a JSON object. Nothing was changed.`);
  }
  if (cfg.hooks !== undefined && (!cfg.hooks || typeof cfg.hooks !== 'object' || Array.isArray(cfg.hooks))) throw new Error(`"hooks" in ${file} must be an object. Nothing was changed.`);
  const hooks = JSON.parse(JSON.stringify(cfg.hooks || {}));   // work on a copy
  const r = remove ? removeGabriel(hooks, name) : addGabriel(hooks, want, name);
  const changes = remove ? r.removed : [...r.added, ...r.updated];
  line(`${host.name}: ${file}`);
  if (!apply) {
    if (remove) line(changes.length ? `would remove: ${changes.join('; ')}` : 'nothing to remove');
    else { line('hook config gabriel adds:'); console.log(JSON.stringify({ hooks: want }, null, 2).split('\n').map((l) => '  ' + l).join('\n')); line(changes.length ? `not written yet: ${changes.length} change(s). Add --apply to write it (a backup is made first).` : 'already set up: no change'); }
    return 0;
  }
  if (!changes.length) { line(remove ? 'nothing to remove' : 'already set up: nothing to change'); return 0; }
  cfg.hooks = hooks;
  JSON.parse(JSON.stringify(cfg));   // the new file must be valid JSON
  let backup = '';
  if (fs.existsSync(file)) { backup = `${file}.gabriel-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`; fs.copyFileSync(file, backup); }
  writeJsonAtomic(file, cfg);
  line(`${remove ? 'removed' : 'wrote'}: ${changes.join('; ')}`);
  if (backup) line(`backup: ${backup}`);
  return 0;
}

async function main(argv) {
  if (argv[0] === 'add-docs') {
    try { return await addDocs(argv.slice(1)); } catch (e) { console.error(e.message); return 1; }
  }
  if (argv.includes('--host') || argv.includes('--remove-host')) {
    try { return hostSetup(argv); } catch (e) { console.error(e.message + '\n' + HOST_USAGE); return 1; }
  }
  if (argv.includes('--update')) {
    try { return await update(argv.filter((a) => a !== '--update')); } catch (e) { console.error(e.message + '\n' + UPDATE_USAGE); return 1; }
  }
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(e.message + '\nusage: node src/setup.js [--dry-run] [--skip-model] [--skip-test] [--yes] [--data <dir>] [--only model|build|test] [--tune]'); return 2; }
  if (opts.data) process.env.GABRIEL_DATA = path.resolve(expandHome(opts.data));
  return run(opts);
}

// ---- --tune: Python packages for the optional embedding tune run (src/tune). Never part of a normal setup. ----
const venvPython = (venv) => (process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python'));
const tstep = (n, text) => console.log(`[${'#'.repeat(n).padEnd(TUNE_STEPS, '-')}] ${String(Math.round((n * 100) / TUNE_STEPS)).padStart(3)}% tune step ${n}/${TUNE_STEPS}: ${text}`);

// Finds Python 3.10 or newer: python, then py -3, then python3. Returns { cmd, args, version } or null.
function findPython() {
  for (const [cmd, pre] of [['python', []], ['py', ['-3']], ['python3', []]]) {
    const r = spawnSync(cmd, [...pre, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8', windowsHide: true });
    if (r.error || r.status !== 0) continue;
    const version = (r.stdout || '').trim();
    const [maj, min] = version.split('.').map(Number);
    if (maj > 3 || (maj === 3 && min >= 10)) return { cmd, args: pre, version };
    line(`found Python ${version} (${cmd}): too old, need 3.10 or newer`);
  }
  return null;
}

// Total size in bytes of the files under a folder.
function dirBytes(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += dirBytes(p);
    else if (e.isFile()) n += fs.statSync(p).size;
  }
  return n;
}

async function runTune(opts) {
  const paths = require('./paths.js');
  const dry = opts.dryRun;
  const venv = path.join(paths.dataDir(), 'tune-venv');
  const py = venvPython(venv);
  const pipSteps = [
    ['upgrade pip', ['-m', 'pip', 'install', '--upgrade', 'pip']],
    ['install torch (CPU build)', ['-m', 'pip', 'install', 'torch', '--index-url', TORCH_INDEX]],
    ['install the tune packages', ['-m', 'pip', 'install', '-r', TUNE_REQ]],
  ];

  tstep(1, 'find Python 3.10 or newer');
  const found = findPython();
  if (found) line(`Python ${found.version} (${[found.cmd, ...found.args].join(' ')})`);
  else if (dry) line(`(dry run) no Python 3.10 or newer found: a real run stops here. ${PY_HELP}`);
  else { line(`no Python 3.10 or newer found (tried python, py -3, python3). ${PY_HELP}`); return 1; }

  tstep(2, 'create the venv');
  line(venv);
  if (fs.existsSync(py)) line('already there');
  else if (dry) line(`(dry run) would run: ${found ? [found.cmd, ...found.args].join(' ') : 'python'} -m venv "${venv}"`);
  else {
    const r = spawnSync(found.cmd, [...found.args, '-m', 'venv', venv], { stdio: 'inherit', windowsHide: true });
    if (r.status !== 0) { line(`venv failed (exit ${r.status}). Retry: node "${path.join(SRC, 'setup.js')}" --tune`); return 1; }
    line('created');
  }

  for (const [k, [label, args]] of pipSteps.entries()) {
    tstep(3 + k, label);
    if (dry) { line(`(dry run) would run: "${py}" ${args.join(' ')}`); continue; }
    const r = spawnSync(py, args, { stdio: 'inherit', windowsHide: true });
    if (r.status !== 0) { line(`${label} failed (exit ${r.status}). Retry: node "${path.join(SRC, 'setup.js')}" --tune`); return 1; }
  }

  tstep(6, 'check the packages');
  const check = 'import torch, sentence_transformers, onnxruntime, onnx';
  if (dry) line(`(dry run) would run: "${py}" -c "${check}"`);
  else {
    const r = spawnSync(py, ['-c', check], { stdio: 'inherit', windowsHide: true });
    if (r.status !== 0) { line(`package check failed (exit ${r.status}). Retry: node "${path.join(SRC, 'setup.js')}" --tune`); return 1; }
    console.log(`tune packages ready (${venv})`);
    line(`install size: ${(dirBytes(venv) / 1048576).toFixed(0)} MB`);
  }
  if (dry) line('(dry run) nothing changed');
  return 0;
}

async function run(opts) {
  if (opts.tune) return runTune(opts);
  const paths = require('./paths.js');
  const { BASE_MODEL: MODEL } = require('./embed.js');   // setup always fetches the base model, even when a tuned one is set
  const { loadProjects } = require('./projects.js');
  const { migrate } = require('./migrate-data.js');
  const dataDir = paths.dataDir();
  const dry = opts.dryRun;
  const runs = (n) => n === 1 || !opts.only || ONLY_STEPS[opts.only].includes(n);

  // 1: node version
  if (runs(1)) {
    step(1, 'check node (22.5 or newer)');
    const [maj, min] = process.versions.node.split('.').map(Number);
    if (maj < 22 || (maj === 22 && min < 5)) {
      line(`node ${process.version} is too old. Install Node 22.5 or newer from https://nodejs.org/ and open a new terminal.`);
      return 1;
    }
    line(`node ${process.version}`);
  }

  // 2: packages (pinned version in package.json)
  if (runs(2)) {
    step(2, 'install packages');
    const pin = (readJson(path.join(ROOT, 'package.json')) || {}).dependencies?.['@huggingface/transformers'];
    const installed = (readJson(path.join(ROOT, 'node_modules', '@huggingface', 'transformers', 'package.json')) || {}).version;
    if (installed && installed === pin) line(`already installed (${pin})`);
    else if (dry) line(`(dry run) would run: npm ci --omit=dev in ${ROOT}`);
    else {
      const r = spawnSync('npm ci --omit=dev', { cwd: ROOT, shell: true, stdio: 'inherit' });
      if (r.status !== 0) {
        line(`npm install failed. Retry: cd "${ROOT}" && npm ci --omit=dev`);
        return 1;
      }
    }
  }

  // 3: data folders
  if (runs(3)) {
    step(3, 'create the data folder');
    if (dry) line(`(dry run) would create ${dataDir} with docs, docs/stack, private and models`);
    else for (const d of ['docs', path.join('docs', 'stack'), 'private', 'models']) fs.mkdirSync(path.join(dataDir, d), { recursive: true });   // docs/stack: stack docs go here; it becomes a doc set once it has files
    line(dataDir);
  }

  // 4: starter folder when there are no doc sets yet
  if (runs(4)) {
    step(4, 'add a starter folder when there are no doc sets');
    const docs = path.join(dataDir, 'docs');
    const hasProjectsFile = fs.existsSync(paths.projectsFile());
    const { hasFiles } = require('./projects.js');   // an empty folder (like docs/stack from step 3) is not a doc set
    const hasDocFolder = fs.existsSync(docs) && fs.readdirSync(docs, { withFileTypes: true }).some((e) => e.isDirectory() && hasFiles(path.join(docs, e.name)));
    if (hasProjectsFile || hasDocFolder) line('doc sets found, nothing to add');
    else if (dry) line(`(dry run) would create ${path.join(docs, 'README.md')}`);
    else {   // a file, not a folder: a starter folder would become a doc set and block `add-docs <same name>`
      const text = [
        'Make one folder here per topic, and put your Markdown files in it.',
        'Or point gabriel at a folder you already have: /gabriel:add-docs <name> <folder>.',
        'Then run /gabriel:setup again. For code repos, also run /graphify <repo>.',
      ].join('\n') + '\n';
      fs.mkdirSync(docs, { recursive: true });
      fs.writeFileSync(path.join(docs, 'README.md'), text);
      line(`created ${path.join(docs, 'README.md')}`);
    }
  }

  // 5: meaning model
  if (runs(5)) {
    step(5, 'fetch the meaning model');
    const modelsDir = paths.modelsDir();
    const modelFile = path.join(modelsDir, ...MODEL.split('/'), ...MODEL_FILE);
    if (opts.skipModel) line('skipped (--skip-model): words-only mode');
    else if (fs.existsSync(modelFile)) line('already installed');
    else if (dry) line(`(dry run) would download ${MODEL} into ${modelsDir}`);
    else if (await fetchModel(modelsDir, modelFile)) line(`model ${MODEL} installed`);
    else {
      line(`warning: model ${MODEL} not downloaded (words-only mode for now). Retry later: node "${path.join(ROOT, 'src', 'setup.js')}" --only model`);
    }
  }

  // 6: data from the old brain folder (copies only, never deletes)
  if (runs(6)) {
    step(6, 'check for data from the old brain folder');
    const oldDb = path.join(OLD_BRAIN, 'data', 'mk.db');
    const newDb = path.join(dataDir, 'mk.db');
    const migrateCli = path.join(SRC, 'migrate-data.js');
    const cmd = `node "${migrateCli}" --from "${OLD_BRAIN}" --to "${dataDir}"`;
    if (process.env.GABRIEL_SETUP_NO_MIGRATE === '1') line('skipped (GABRIEL_SETUP_NO_MIGRATE=1)');
    else if (!fs.existsSync(oldDb) || fs.existsSync(newDb)) line('nothing to copy');
    else {
      try {
        const r = migrate({ from: OLD_BRAIN, to: dataDir, dryRun: true, log: () => {} });
        line(`found old data in ${OLD_BRAIN}: ${r.planned} file(s) to copy, ${r.bytes} bytes (${r.done} already there)`);
      } catch (e) {
        line(`cannot plan the copy: ${e.message}`);
        return 1;
      }
      line(`exact command: ${cmd}`);
      if (opts.yes && !dry) {
        const r = spawnSync(process.execPath, [migrateCli, '--from', OLD_BRAIN, '--to', dataDir], { stdio: 'inherit' });
        if (r.status !== 0) line(`copy failed (exit ${r.status}). Old data is untouched.`);
        else line('copy done');
      } else line('not copied yet: add --yes to copy');
    }
  }

  // 7: rules graph
  if (runs(7)) {
    step(7, 'build the rules graph');
    const brain = path.join(SRC, 'brain.js');
    if (dry) line(`(dry run) would run: node src/brain.js build`);
    else {
      const r = runNode([brain, 'build'], { skipModel: opts.skipModel });
      if (r.status !== 0) { line(`rules graph failed (exit ${r.status})`); return 1; }
    }
  }

  // 8: doc maps, one per project
  if (runs(8)) {
    step(8, 'build the doc maps');
    const projects = loadProjects();
    if (!projects.length) line(`no doc sets yet: put Markdown folders in ${path.join(dataDir, 'docs')}/`);
    for (const p of projects) {
      if (dry) { line(`(dry run) would build the map for ${p.name}`); continue; }
      const brain = path.join(SRC, 'brain.js');
      const r = runNode([brain, 'build-mk', p.name], { skipModel: opts.skipModel, heap: true, capture: true });
      const out = `${r.stdout || ''}${r.stderr || ''}`.split('\n').map((s) => s.trim()).filter(Boolean);
      const res = out.find((l) => /^map (built|not built)/.test(l)) || out[out.length - 1] || '(no output)';
      line(`${p.name}: ${res}`);
    }
  }

  // 9: tests (a failure is printed, not fatal)
  if (runs(9)) {
    step(9, 'run the tests');
    if (opts.skipTest) line('skipped (--skip-test)');
    else if (dry) line('(dry run) would run: npm test');
    else {
      const r = spawnSync('npm test', { cwd: ROOT, shell: true, stdio: 'inherit' });
      line(r.status === 0 ? 'tests passed' : `tests failed (exit ${r.status}). Setup continues; see the output above.`);
    }
  }

  // 10: summary (read only)
  if (!opts.only) {
    step(10, 'summary');
    line(`data folder: ${dataDir}`);
    let projects = [];
    try { projects = loadProjects(); } catch (e) { line(`cannot read projects: ${e.message}`); }
    line(`${projects.length} project${projects.length === 1 ? '' : 's'}`);
    for (const p of projects) {
      const n = countDocs(p.root, p.extensions);
      line(`  ${p.name}${n === null ? '' : `: ${n} doc${n === 1 ? '' : 's'}`}`);
    }
    if (!fs.existsSync(GRAPHIFY_SKILL)) {
      line('For code repos, install the graphify skill and run /graphify <repo>; gabriel links docs to code through its graphify-out/graph.json.');
    }
    line('Next: /gabriel:add-docs <name> <folder>');
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e && e.stack || e); process.exit(1); });
}

module.exports = { main, expandHome };
