// Tests for `node src/setup.js add-docs`. Temp GABRIEL_DATA and BRAIN_HOME; the model is never downloaded (GABRIEL_NO_DOWNLOAD=1).
const assert = require('node:assert'), crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SETUP = path.join(ROOT, 'src', 'setup.js'), BRAIN = path.join(ROOT, 'src', 'brain.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'add-docs-test-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const home = path.join(tmp, 'home'), data = path.join(tmp, 'data'), projectsFile = path.join(data, 'projects.json');
fs.mkdirSync(home, { recursive: true });
fs.writeFileSync(path.join(home, 'CLAUDE.md'), 'Always answer in plain words.\n');
const env = { ...process.env, BRAIN_HOME: home, GABRIEL_DATA: data, GABRIEL_NO_DOWNLOAD: '1', GABRIEL_SETUP_NO_MIGRATE: '1' };
const run = (args) => spawnSync(process.execPath, [SETUP, 'add-docs', ...args], { cwd: ROOT, env, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
const text = (r) => `${r.stdout || ''}${r.stderr || ''}`;
const hashProjects = () => (fs.existsSync(projectsFile) ? crypto.createHash('sha256').update(fs.readFileSync(projectsFile)).digest('hex') : 'no file');
const readProjects = () => JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
const entry = (name) => readProjects().projects.find((p) => p.name === name);
const writeFiles = (dir, files) => {
  for (const [rel, body] of Object.entries(files)) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); }
  return dir;
};

// 0: insidePluginCache: any .claude/plugins/cache is a refused home; a git clone of the plugin and siblings are not
{
  const { insidePluginCache } = require('../src/paths.js');
  assert.strictEqual(insidePluginCache(path.join(ROOT, 'repo-docs')), false, 'a git clone of the plugin (dev repo, Codex or Gemini install) is not replaced on update');
  assert.strictEqual(insidePluginCache(path.join(os.homedir(), '.claude', 'plugins', 'cache', 'gabriel', '0.3.0', 'd')), true);
  assert.strictEqual(insidePluginCache(path.join(os.homedir(), '.claude', 'plugins', 'cache-old', 'd')), false);
  assert.strictEqual(insidePluginCache(ROOT + '-docs'), false);
  assert.strictEqual(insidePluginCache(path.join(os.homedir(), '.gabriel', 'this-machine-repo-docs', 'x')), false);
  if (process.platform === 'win32') assert.strictEqual(insidePluginCache('C:\\USERS\\X\\.Claude\\Plugins\\Cache\\g\\1\\d'), true);
}

// 0b: moveIntoPlace retries a rename that Windows refuses for a moment (antivirus or indexer lock), then gives up cleanly
{
  const { moveIntoPlace } = require('../src/paths.js');
  const real = fs.renameSync;
  const dst = path.join(tmp, 'locked.json'), src = dst + '.tmp';
  let calls = 0;
  try {
    fs.writeFileSync(src, '{"ok":1}');
    fs.renameSync = (a, b) => { if (++calls < 3) throw Object.assign(new Error('locked'), { code: 'EPERM' }); return real(a, b); };
    moveIntoPlace(src, dst);
    assert.strictEqual(fs.readFileSync(dst, 'utf8'), '{"ok":1}');
    assert.strictEqual(calls, 3, 'two refused renames, then success');
    fs.writeFileSync(src, '{"ok":2}');
    fs.renameSync = () => { throw Object.assign(new Error('locked'), { code: 'EPERM' }); };
    assert.throws(() => moveIntoPlace(src, dst), /locked/);
    assert.strictEqual(fs.existsSync(src), false, 'temp file removed after giving up');
  } finally { fs.renameSync = real; }
  console.log('  moveIntoPlace: retries a locked rename, removes the temp file when it gives up');
}

// fixtures
const words = ['gate', 'river', 'token', 'report', 'budget', 'frame', 'signal', 'matrix', 'ledger', 'harbor', 'vector', 'cabin', 'orbit'];
const filler = ['# Filler', ''];
for (let i = 0; i < 120; i++) filler.push(`${i + 1}. ${words[i % words.length]} and ${words[(i * 5 + 3) % words.length]} check item ${(i * 7) % 53}.`);
const bikes = '# Bikes\n\n## Fix a flat tire\n\nRemove the wheel, find the hole, patch the inner tube, pump it up.\n';
const cooking = '# Cooking\n\n## Boil pasta\n\nBring a big pot of salted water to a boil. Add the pasta and stir.\n';
const garden = '# Garden\n\n## Water tomatoes\n\nWater the tomatoes at the root every morning when the soil is dry.\n';
const fixture = writeFiles(path.join(tmp, 'fixture'), { 'bikes.md': bikes, 'cooking.md': cooking, 'garden.md': garden, 'filler.md': filler.join('\n') + '\n' });
const graphJson = {
  nodes: [
    { id: 'tire', label: 'TireRepair', source_file: 'src/tire.cs', source_location: 'L10', community: 0 },
    { id: 'tube', label: 'PatchTube', source_file: 'src/tube.cs', source_location: 'L4', community: 0 },
  ],
  links: [{ source: 'tire', target: 'tube', relation: 'calls', confidence_score: 1 }],
  built_at_commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
};

// 1: --copy: copies the docs, adds the entry, builds the map, and the map answers a question
{
  const r = run(['recipes', fixture, '--copy']);
  assert.strictEqual(r.status, 0, text(r));
  console.log(text(r).trimEnd());
  assert.strictEqual(entry('recipes').root, 'docs/recipes');
  assert.strictEqual(entry('recipes').graph, null);
  assert.ok(fs.existsSync(path.join(data, 'docs', 'recipes', 'bikes.md')), 'bikes.md must be copied');
  assert.ok(fs.existsSync(path.join(data, 'mk.db')), 'mk.db must exist');
  assert.match(text(r), /added recipes: 4 docs/);

  const q = spawnSync(process.execPath, [BRAIN, 'mk', 'how do I fix a flat tire on my bike', '--no-meaning'], { cwd: ROOT, env, encoding: 'utf8', timeout: 600000 });
  assert.strictEqual(q.status, 0, text(q));
  assert.match(q.stdout, /bikes\.md/, q.stdout);
  assert.match(q.stdout, /Fix a flat tire/, q.stdout);
  console.log('  mk query: block names bikes.md and "Fix a flat tire"');
}

// 2: linked: no copy, the root is the absolute folder
{
  const r = run(['linked', fixture]);
  assert.strictEqual(r.status, 0, text(r));
  console.log(text(r).trimEnd());
  assert.strictEqual(entry('linked').root, path.resolve(fixture));
  assert.ok(!fs.existsSync(path.join(data, 'docs', 'linked')), 'linked must not copy');
  assert.match(text(r), /added linked: 4 docs/);
}

// 3: errors: exit 1, the message, and projects.json unchanged
{
  const before = hashProjects();
  const emptyDir = path.join(tmp, 'empty');
  fs.mkdirSync(emptyDir, { recursive: true });
  const missing = path.join(tmp, 'no-such-folder');
  const cases = [
    [['empty', emptyDir], `0 docs found in ${emptyDir}`],
    [['ghost', missing], `folder not found: ${missing}`],
    [['recipes', fixture], 'project recipes already exists'],
    [['Bad Name', fixture], 'bad project name: Bad Name'],
  ];
  for (const [args, msg] of cases) {
    const r = run(args);
    assert.strictEqual(r.status, 1, text(r));
    assert.ok(text(r).includes(msg), `expected "${msg}" in: ${text(r)}`);
    console.log(`  error: ${text(r).trim()}`);
  }
  assert.strictEqual(hashProjects(), before, 'projects.json must not change on errors');
  console.log('  projects.json unchanged after 4 errors');
}

// 4: a code graph in the docs folder is linked; graphify-out is not counted as docs
{
  const dir = writeFiles(path.join(tmp, 'with-graph'), { 'bikes.md': bikes, 'graphify-out/graph.json': JSON.stringify(graphJson) });
  const r = run(['coded', dir]);
  assert.strictEqual(r.status, 0, text(r));
  console.log(text(r).trimEnd());
  assert.match(text(r), /code graph found/);
  assert.strictEqual(entry('coded').graph, 'graphify-out/graph.json');
  assert.match(text(r), /added coded: 1 docs/);
}

// 5: code files and no graph: the /graphify hint is printed
{
  const dir = writeFiles(path.join(tmp, 'code-hint'), { 'a.md': '# A\n\nSome text about alpha things.\n', 'src/x.cs': 'class X {}\n' });
  const r = run(['hints', dir]);
  assert.strictEqual(r.status, 0, text(r));
  console.log(text(r).trimEnd());
  assert.match(text(r), /\/graphify/);
  assert.strictEqual(entry('hints').graph, null);
}

// 6: --code: the graph is in another folder, stored relative to the docs root and still found by the map build
{
  const repo = writeFiles(path.join(tmp, 'repo'), { 'src/tire.cs': 'class TireRepair {}\n', 'graphify-out/graph.json': JSON.stringify(graphJson) });
  const docs = writeFiles(path.join(tmp, 'repo-docs'), { 'bikes.md': bikes });
  const r = run(['repo-docs', docs, '--code', repo]);
  assert.strictEqual(r.status, 0, text(r));
  console.log(text(r).trimEnd());
  const graph = entry('repo-docs').graph;
  assert.ok(graph && !path.isAbsolute(graph), `graph must be relative: ${graph}`);
  assert.ok(fs.existsSync(path.join(docs, graph)), 'relative graph must resolve from the docs root');
  assert.match(text(r), /code graph found/);
  assert.match(text(r), /map built/);
}

// 7: a leading ~ in the folder path is the home folder (HOME and USERPROFILE of the child point to a temp home)
{
  const userHome = path.join(tmp, 'userhome');
  writeFiles(path.join(userHome, 'notes'), { 'bikes.md': bikes, 'cooking.md': cooking, 'garden.md': garden, 'filler.md': filler.join('\n') + '\n' });
  const r = spawnSync(process.execPath, [SETUP, 'add-docs', 'tilde', '~/notes'], { cwd: ROOT, env: { ...env, HOME: userHome, USERPROFILE: userHome }, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  assert.strictEqual(r.status, 0, text(r));
  assert.strictEqual(entry('tilde').root, path.join(userHome, 'notes'));
  assert.match(text(r), /added tilde: 4 docs/);
  // the helper itself: ~, ~/x, ~\x expand; other paths do not
  const { expandHome } = require(SETUP);
  assert.strictEqual(expandHome('~'), os.homedir());
  assert.strictEqual(expandHome('~/x'), path.join(os.homedir(), 'x'));
  assert.strictEqual(expandHome('~\\x'), path.join(os.homedir(), 'x'));
  assert.strictEqual(expandHome(path.join(tmp, 'abs')), path.join(tmp, 'abs'));
  assert.strictEqual(expandHome('a~b'), 'a~b');
  console.log('  ~ expands: add-docs tilde ~/notes -> ' + path.join(userHome, 'notes'));
}

// 9: --code with no graphify-out/graph.json in that repo: fails before any write (no docs-folder fallback)
{
  const before = hashProjects();
  const docs = writeFiles(path.join(tmp, 'nograph-docs'), { 'bikes.md': bikes, 'graphify-out/graph.json': JSON.stringify(graphJson) });
  const repo = path.join(tmp, 'repo-no-graph');
  fs.mkdirSync(repo, { recursive: true });
  const r = run(['nograph', docs, '--code', repo]);
  assert.strictEqual(r.status, 1, text(r));
  assert.match(text(r), /no graphify-out\/graph.json in /, text(r));
  assert.strictEqual(hashProjects(), before, 'projects.json must not change');
  assert.strictEqual(entry('nograph'), undefined, 'no entry for the failed name');
  console.log(`  error: ${text(r).trim()}`);
}

// 10: the wrong-repo warning: docs that name none of the code graph get it; docs that name a class do not
{
  const repo = writeFiles(path.join(tmp, 'warn-repo'), { 'src/tire.cs': 'class TireRepair {}\n', 'graphify-out/graph.json': JSON.stringify(graphJson) });
  const named = writeFiles(path.join(tmp, 'warn-named'), { 'bikes.md': bikes + '\nCall `TireRepair` to start.\n' });
  assert.strictEqual(run(['named-code', named, '--code', repo]).status, 0);
  const unnamed = writeFiles(path.join(tmp, 'warn-unnamed'), { 'cooking.md': cooking, 'garden.md': garden });
  const added = run(['unnamed-code', unnamed, '--code', repo]);
  assert.strictEqual(added.status, 0);
  assert.match(text(added), /warning: the docs name almost none/, 'add-docs shows the wrong-repo warning too');
  // build-mk prints the whole build log
  const build = (name) => spawnSync(process.execPath, [BRAIN, 'build-mk', name], { cwd: ROOT, env, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  const a = build('named-code');
  assert.strictEqual(a.status, 0, text(a));
  assert.match(text(a), /map built .*, \d+ doc sections linked to code/, text(a));
  assert.doesNotMatch(text(a), /warning: the docs name almost none/, text(a));
  const b = build('unnamed-code');
  assert.strictEqual(b.status, 0, text(b));
  assert.match(text(b), /warning: the docs name almost none of this graph's code \(0 of \d+ sections link to it\); is the code graph the right repo\?/, text(b));
  assert.match(text(b), /map built .*, 0 doc sections linked to code/, text(b));
  console.log('  warning: unnamed docs warned; named docs not warned');
}

// 11: --relink: only the graph of an existing set changes (other fields kept), the map is rebuilt; bad calls fail
{
  const repoA = writeFiles(path.join(tmp, 'relink-a'), { 'src/tire.cs': 'class TireRepair {}\n', 'graphify-out/graph.json': JSON.stringify(graphJson) });
  const docsR = writeFiles(path.join(tmp, 'relink-docs'), { 'bikes.md': bikes });
  assert.strictEqual(run(['relinked', docsR, '--code', repoA]).status, 0);
  const before = entry('relinked');
  const repoB = writeFiles(path.join(tmp, 'relink-b'), { 'src/tire.cs': 'class TireRepair {}\n', 'graphify-out/graph.json': JSON.stringify({ ...graphJson, built_at_commit: 'ffff0000aaaa1111bbbb2222cccc3333dddd4444' }) });
  const r = run(['relinked', '--code', repoB, '--relink']);
  assert.strictEqual(r.status, 0, text(r));
  const after = entry('relinked');
  const wantGraph = path.relative(docsR, path.join(repoB, 'graphify-out', 'graph.json')).split(path.sep).join('/');
  assert.strictEqual(after.graph, wantGraph);
  const restBefore = { ...before, graph: null }, restAfter = { ...after, graph: null };
  assert.deepStrictEqual(restAfter, restBefore, 'other fields must not change');
  assert.match(text(r), /relinked relinked: graph /);
  assert.match(text(r), /map built/);
  console.log(`  relink: graph ${before.graph} -> ${after.graph}; map rebuilt`);

  const hash = hashProjects();
  const errs = [
    [['ghost-x', '--code', repoB, '--relink'], 'unknown doc set: ghost-x'],
    [['relinked', '--relink'], '--relink needs --code <repo>'],
    [['relinked', '--code', path.join(tmp, 'relink-missing'), '--relink'], 'code folder not found'],
  ];
  fs.mkdirSync(path.join(tmp, 'relink-none'), { recursive: true });
  errs.push([['relinked', '--code', path.join(tmp, 'relink-none'), '--relink'], 'no graphify-out/graph.json in']);
  for (const [args, msg] of errs) {
    const e = run(args);
    assert.strictEqual(e.status, 1, text(e));
    assert.ok(text(e).includes(msg), `expected "${msg}" in: ${text(e)}`);
  }
  assert.strictEqual(hashProjects(), hash, 'projects.json must not change on relink errors');
  console.log('  relink errors: unknown set, no --code, no graph: exit 1, projects.json unchanged');
}

// 12: cwdHints come from --code: the lower-case repo name; a code folder inside a git repo uses the git repo root's name
{
  const repo = writeFiles(path.join(tmp, 'Hint-Repo'), { 'src/tire.cs': 'class TireRepair {}\n', 'graphify-out/graph.json': JSON.stringify(graphJson) });
  const docs = writeFiles(path.join(tmp, 'hint-docs'), { 'bikes.md': bikes });
  const r = run(['hinted', docs, '--code', repo]);
  assert.strictEqual(r.status, 0, text(r));
  assert.deepStrictEqual(entry('hinted').cwdHints, ['hint-repo'], 'add-docs --code sets a lower-case cwd hint');

  const gitRepo = writeFiles(path.join(tmp, 'Git-Root'), { 'sub/graphify-out/graph.json': JSON.stringify(graphJson), 'sub/src/tire.cs': 'class TireRepair {}\n' });
  fs.mkdirSync(path.join(gitRepo, '.git'));
  const docs2 = writeFiles(path.join(tmp, 'git-docs'), { 'bikes.md': bikes });
  const r2 = run(['gitsub', docs2, '--code', path.join(gitRepo, 'sub')]);
  assert.strictEqual(r2.status, 0, text(r2));
  assert.deepStrictEqual(entry('gitsub').cwdHints, ['git-root'], 'a code folder inside a git repo uses the git repo root name');
  console.log('  cwdHints: --code repo name (lower case); git repo root name for a folder inside it');
}

// 7b: a docs or --code folder inside the plugin cache is refused (an update replaces it); projects.json is unchanged
{
  const inPlugin = path.join(tmp, '.claude', 'plugins', 'cache', 'gabriel', '0.3.0', 'docs');
  fs.mkdirSync(inPlugin, { recursive: true });
  try {
    writeFiles(inPlugin, { 'bikes.md': bikes, 'graphify-out/graph.json': JSON.stringify(graphJson) });
    const before = hashProjects();
    let r = run(['incache', inPlugin]);
    assert.notStrictEqual(r.status, 0, text(r));
    assert.match(text(r), /refused: .* is inside the plugin cache, which a plugin update replaces/);
    assert.strictEqual(hashProjects(), before);
    r = run(['outside', fixture, '--code', inPlugin]);
    assert.notStrictEqual(r.status, 0, text(r));
    assert.match(text(r), /inside the plugin cache/);
    r = run(['recipes', '--code', inPlugin, '--relink']);
    assert.notStrictEqual(r.status, 0, text(r));
    assert.match(text(r), /inside the plugin cache/);
    assert.strictEqual(hashProjects(), before);
    console.log('  plugin-cache paths refused by add-docs and --relink, projects.json unchanged');
  } finally { fs.rmSync(inPlugin, { recursive: true, force: true }); }
}

// 8: no half-written files are left in the data folder
assert.deepStrictEqual(fs.readdirSync(data).filter((f) => f.endsWith('.tmp')), []);

console.log('ALL PASSED');
