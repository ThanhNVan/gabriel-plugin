// Edge cases for the plugin-cache check (paths.insidePluginCache, setup.js pluginPathRefusal) and brain.js isRepoCodeFile.
// Temp GABRIEL_DATA and BRAIN_HOME; the model is never downloaded (GABRIEL_NO_DOWNLOAD=1).
// A block that fails prints "FAILS: <block>: <actual vs expected>" and the others still run. Any failure: exit 1.
const assert = require('node:assert'), crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SETUP = path.join(ROOT, 'src', 'setup.js'), BRAIN = path.join(ROOT, 'src', 'brain.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-cache-test-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const home = path.join(tmp, 'home'), data = path.join(tmp, 'data'), projectsFile = path.join(data, 'projects.json');
fs.mkdirSync(home, { recursive: true });
fs.writeFileSync(path.join(home, 'CLAUDE.md'), 'Always answer in plain words.\n');
const env = { ...process.env, BRAIN_HOME: home, GABRIEL_DATA: data, GABRIEL_NO_DOWNLOAD: '1', GABRIEL_SETUP_NO_MIGRATE: '1' };
const runWith = (e, args) => spawnSync(process.execPath, [SETUP, 'add-docs', ...args], { cwd: ROOT, env: e, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
const run = (args) => runWith(env, args);
const text = (r) => `${r.stdout || ''}${r.stderr || ''}`;
const hashProjects = () => (fs.existsSync(projectsFile) ? crypto.createHash('sha256').update(fs.readFileSync(projectsFile)).digest('hex') : 'no file');
const readProjects = () => JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
const entry = (name) => readProjects().projects.find((p) => p.name === name);
const writeFiles = (dir, files) => {
  for (const [rel, body] of Object.entries(files)) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); }
  return dir;
};
const git = (cwd, ...args) => require('node:child_process').execFileSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' });

// fixtures (same shape as test-add-docs.js)
const bikes = '# Bikes\n\n## Fix a flat tire\n\nRemove the wheel, find the hole, patch the inner tube, pump it up.\n';
const fixture = writeFiles(path.join(tmp, 'fixture'), { 'bikes.md': bikes });
const graphJson = {
  nodes: [
    { id: 'tire', label: 'TireRepair', source_file: 'src/tire.cs', source_location: 'L10', community: 0 },
    { id: 'tube', label: 'PatchTube', source_file: 'src/tube.cs', source_location: 'L4', community: 0 },
  ],
  links: [{ source: 'tire', target: 'tube', relation: 'calls', confidence_score: 1 }],
};
const cacheHome = path.join(tmp, 'cachehome');   // a fake user home with a plugin cache inside it
const cacheDocs = (n) => path.join(cacheHome, '.claude', 'plugins', 'cache', 'g', String(n), 'docs');

// failure log: a block's assertion error, with actual and expected when there are both
const fmt = (e) => (e && 'actual' in e && 'expected' in e ? `actual ${JSON.stringify(e.actual)} vs expected ${JSON.stringify(e.expected)}` : String(e && e.message).split('\n').slice(0, 3).join(' | '));
let failed = 0;
const block = (name, fn) => {
  try { fn(); console.log(`ok: ${name}`); }
  catch (e) { failed++; console.log(`FAILS: ${name}: ${fmt(e)}`); }
};
const outside = (out, msg) => assert.ok(out.includes(msg), `expected "${msg}" in output: ${out.slice(0, 400)}`);

// 1: insidePluginCache true
block('1 insidePluginCache true cases', () => {
  const { insidePluginCache } = require('../src/paths.js');
  const base = path.join(tmp, '.claude', 'plugins', 'cache', 'x');
  assert.strictEqual(insidePluginCache(base + path.sep), true, 'trailing slash');
  const rel = path.relative(process.cwd(), base);
  assert.strictEqual(insidePluginCache(rel), true, `relative path from cwd: ${rel}`);
  const spaced = path.join(tmp, '.claude', 'plugins', 'cache', 'my plugin', 'docs');
  assert.strictEqual(insidePluginCache(spaced), true, 'folder name with spaces');
  const uni = path.join(tmp, '.claude', 'plugins', 'cache', 'ca phê', 'docs');
  assert.strictEqual(insidePluginCache(uni), true, 'folder name with Unicode');
  if (process.platform === 'win32') {
    assert.strictEqual(insidePluginCache(base.replace(/\\/g, '/')), true, 'forward slashes on win32');
  } else {
    console.log('  (forward-slash case skipped: not win32)');
  }
});

// 2: insidePluginCache false cases
block('2 insidePluginCache false cases', () => {
  const { insidePluginCache } = require('../src/paths.js');
  assert.strictEqual(insidePluginCache(path.join(tmp, '.claude', 'plugins')), false, '.claude/plugins itself');
  assert.strictEqual(insidePluginCache(path.join(tmp, '.claude', 'plugins', 'cache-old', 'x')), false, 'cache-old');
  assert.strictEqual(insidePluginCache(path.join(tmp, 'claude', 'plugins', 'cache', 'x')), false, 'no dot before claude');
  assert.strictEqual(insidePluginCache(path.join(data, 'this-machine-repo-docs', 'my set')), false, 'this-machine-repo-docs folder');
});

// 3: add-docs refuses a docs folder in the cache given as ~/...
block('3 add-docs refuses ~/ path into cache', () => {
  const folder = writeFiles(cacheDocs(1), { 'a.md': '# A\n\nSome text about tires.\n' });
  const before = hashProjects();
  const e = { ...env, HOME: cacheHome, USERPROFILE: cacheHome };
  const r = runWith(e, ['tilde-set', '~/.claude/plugins/cache/g/1/docs']);
  assert.notStrictEqual(r.status, 0, `expected non-zero exit, got 0: ${text(r)}`);
  outside(text(r), 'inside the plugin cache');
  assert.strictEqual(hashProjects(), before, 'projects.json must not change');
  assert.ok(fs.existsSync(path.join(folder, 'a.md')));
});

// 4: --copy from a cache folder is allowed (copy goes to <data>/docs/<name>); a graph left in the cache is not linked
block('4 add-docs --copy from cache is allowed', () => {
  const folder = cacheDocs(4);
  writeFiles(folder, { 'a.md': '# A\n\nSome text about tires.\n', 'graphify-out/graph.json': JSON.stringify(graphJson) });
  const r = run(['cache-copy', folder, '--copy']);
  assert.strictEqual(r.status, 0, `exit status: ${r.status}: ${text(r).slice(0, 300)}`);
  assert.strictEqual(entry('cache-copy').root, 'docs/cache-copy', 'entry root');
  assert.ok(!entry('cache-copy').graph, 'no graph link into the cache');
  outside(text(r), 'its code graph is not linked');
  assert.ok(fs.existsSync(path.join(data, 'docs', 'cache-copy', 'a.md')), 'docs copied out of the cache');
});

// 5: --code inside cache is refused even with --copy
block('5 --code inside cache refused with --copy', () => {
  const codeDir = path.join(cacheDocs(5), '..', 'code');
  writeFiles(codeDir, { 'graphify-out/graph.json': JSON.stringify(graphJson) });
  const r = run(['cache-code', fixture, '--code', codeDir, '--copy']);
  assert.notStrictEqual(r.status, 0, `expected non-zero exit, got 0: ${text(r)}`);
  outside(text(r), 'inside the plugin cache');
});

// 6: the refusal message names <GABRIEL_DATA>/this-machine-repo-docs/<name> (data path with a space)
block('6 refusal message names data path with a space', () => {
  const spaceData = path.join(tmp, 'data with space');
  const folder = cacheDocs(6);
  writeFiles(folder, { 'a.md': '# A\n\nSome text.\n' });
  const e = { ...env, HOME: cacheHome, USERPROFILE: cacheHome, GABRIEL_DATA: spaceData };
  const r = runWith(e, ['nm', folder]);
  assert.notStrictEqual(r.status, 0, `expected non-zero exit, got 0: ${text(r)}`);
  const want = path.join(path.resolve(spaceData), 'this-machine-repo-docs', 'nm');
  outside(text(r), want);
});

// 7: a docs folder and --code both under <data>/this-machine-repo-docs/my-set is accepted
block('7 docs and code under this-machine-repo-docs accepted', () => {
  const setDir = path.join(data, 'this-machine-repo-docs', 'my-set');
  writeFiles(setDir, { 'bikes.md': bikes, 'graphify-out/graph.json': JSON.stringify(graphJson) });
  const r = run(['my-set', setDir, '--code', setDir]);
  assert.strictEqual(r.status, 0, `exit status: ${r.status}: ${text(r).slice(0, 400)}`);
});

// 8: --relink --repo alone is never refused by the cache check
block('8 --relink --repo is not refused by cache check', () => {
  const repo = path.join(tmp, 'outside-repo');
  fs.mkdirSync(repo, { recursive: true });
  const r = run(['--relink', 'my-set', '--repo', repo]);
  assert.ok(!text(r).includes('inside the plugin cache'), `unexpected cache refusal: ${text(r).slice(0, 300)}`);
});

// 9: isRepoCodeFile on win32: repo at a C:\ style temp path, file name with different letter case is counted
block('9 isRepoCodeFile case-insensitive on win32', () => {
  if (process.platform !== 'win32') { console.log('  (skipped: not win32)'); return; }
  const repo = path.join(tmp, 'X', 'Repo');
  writeFiles(repo, { 'src/tire.cs': 'class T {}\n', 'src/tube.cs': 'class U {}\n', 'README.md': '# R\n' });
  git(repo, 'init', '-q');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'c');
  const graphNoCommit = { nodes: graphJson.nodes, links: graphJson.links };
  writeFiles(repo, { 'graphify-out/graph.json': JSON.stringify(graphNoCommit) });
  const csDocs = writeFiles(path.join(tmp, 'cs-docs'), { 'bikes.md': bikes });
  const a = run(['cs-set', csDocs, '--code', repo, '--repo', repo]);
  assert.strictEqual(a.status, 0, `setup add-docs: ${text(a).slice(0, 400)}`);
  const caseFile = path.join(tmp, 'x', 'repo', 'src', 'TIRE.CS');
  const c = spawnSync(process.execPath, ['-e', 'const b=require(process.argv[1]);console.log(String(b.isRepoCodeFile("cs-set", process.argv[2])))', BRAIN, caseFile], { cwd: ROOT, env, encoding: 'utf8' });
  assert.strictEqual(c.stdout.trim(), 'true', `isRepoCodeFile: ${c.stdout} ${c.stderr}`);
});

if (failed) {
  console.log(`${failed} block(s) failed`);
  process.exitCode = 1;
} else {
  console.log('ALL PASSED');
}
