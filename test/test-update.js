// Tests for `node src/setup.js --update`. Temp GABRIEL_DATA and BRAIN_HOME; the model is never downloaded (GABRIEL_NO_DOWNLOAD=1).
const assert = require('node:assert'), crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SETUP = path.join(ROOT, 'src', 'setup.js'), SUGGEST = path.join(ROOT, 'eval', 'suggest-cases.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'update-test-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const home = path.join(tmp, 'home'), data = path.join(tmp, 'data');
const projectsFile = path.join(data, 'projects.json'), docs = path.join(data, 'docs');
const privDir = (name) => path.join(data, 'private', name);
fs.mkdirSync(home, { recursive: true });
fs.writeFileSync(path.join(home, 'CLAUDE.md'), 'Always answer in plain words.\n');
const env = { ...process.env, BRAIN_HOME: home, GABRIEL_DATA: data, GABRIEL_NO_DOWNLOAD: '1', GABRIEL_SETUP_NO_MIGRATE: '1' };
const run = (args) => spawnSync(process.execPath, [SETUP, ...args], { cwd: ROOT, env, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
const text = (r) => `${r.stdout || ''}${r.stderr || ''}`;
const hash = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : 'no file');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeFiles = (dir, files) => {
  for (const [rel, body] of Object.entries(files)) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); }
  return dir;
};

// fixtures: three small docs with one section each, and a filler file of about 120 lines
const filler = ['# Filler', ''];
for (let i = 0; i < 120; i++) filler.push(`${i + 1}. Line ${i + 1} is filler text about gears, chains and wheel checks.`);
const fillerText = filler.join('\n') + '\n';
const bikes = '# Bikes\n\n## Fix a flat tire\n\nRemove the wheel, find the hole, patch the inner tube, pump it up.\n';
const cooking = '# Cooking\n\n## Boil pasta\n\nBring a big pot of salted water to a boil. Add the pasta and stir.\n';
const garden = '# Garden\n\n## Water tomatoes\n\nWater the tomatoes at the root every morning when the soil is dry.\n';
const fixtureA = writeFiles(path.join(tmp, 'fixture-a'), { 'bikes.md': bikes, 'cooking.md': cooking, 'garden.md': garden, 'filler.md': fillerText });

// set "notes": added with --copy, then a reviewed eval-cases.json made from the suggested file
{
  const r = run(['add-docs', 'notes', fixtureA, '--copy']);
  assert.strictEqual(r.status, 0, text(r));
  const s = spawnSync(process.execPath, [SUGGEST, '--project', 'notes'], { cwd: ROOT, env, encoding: 'utf8', timeout: 600000 });
  assert.strictEqual(s.status, 0, text(s));
  fs.copyFileSync(path.join(privDir('notes'), 'eval-cases.suggested.json'), path.join(privDir('notes'), 'eval-cases.json'));
  console.log('setup: set notes added, eval-cases.json written from the suggested file');
}
const casesFile = path.join(privDir('notes'), 'eval-cases.json'), sugFile = path.join(privDir('notes'), 'eval-cases.suggested.json');
const casesHash = hash(casesFile);
const oldSuggested = readJson(sugFile);
assert.ok(oldSuggested.length >= 3, 'suggested cases for the three sections');

// (a) a new folder docs/b/ is registered and built; the old set stays up to date
{
  writeFiles(path.join(docs, 'b'), {
    'chain.md': '# Chain\n\n## Clean the chain\n\nWipe the chain with a rag and oil it after rain.\n',
    'brakes.md': '# Brakes\n\n## Check the pads\n\nCheck the brake pads every 500 km.\n',
    'filler.md': fillerText,
  });
  const before = JSON.stringify(readJson(projectsFile).projects.find((p) => p.name === 'notes'));
  const r = run(['--update']);
  assert.strictEqual(r.status, 0, text(r));
  console.log(text(r).trimEnd().split('\n').map((l) => '  ' + l).join('\n'));
  assert.match(text(r), /added doc set b/);
  assert.match(text(r), /b: map built/);
  assert.match(text(r), /up to date: notes/);
  const pj = readJson(projectsFile).projects;
  assert.deepStrictEqual(pj.find((p) => p.name === 'b'), { name: 'b', label: 'b', root: 'docs/b' });
  assert.strictEqual(JSON.stringify(pj.find((p) => p.name === 'notes')), before, 'existing entries must not change');
  assert.strictEqual(hash(casesFile), casesHash, 'eval-cases.json must not change');
}

// (b) a new section in a file of "notes": the set is rebuilt, one new suggested case is added, eval-cases.json is untouched
{
  fs.appendFileSync(path.join(docs, 'notes', 'bikes.md'), '\n## New section\n\nGears and chains need oil every 300 km.\n');
  const r = run(['--update']);
  assert.strictEqual(r.status, 0, text(r));
  console.log(text(r).trimEnd().split('\n').map((l) => '  ' + l).join('\n'));
  assert.match(text(r), /notes: map built/);
  assert.match(text(r), /notes: 1 new suggested cases/);
  assert.match(text(r), /summary: 0 added, 1 rebuilt, 1 up to date, 1 new suggested cases/);
  const sug = readJson(sugFile);
  assert.strictEqual(sug.length, oldSuggested.length + 1, 'one case added');
  assert.deepStrictEqual(sug.slice(0, oldSuggested.length), oldSuggested, 'old suggested cases are kept as they were');
  const added = sug[sug.length - 1];
  assert.strictEqual(added.sec, 'New section');
  assert.strictEqual(added.id, `S${oldSuggested.length + 1}`);
  assert.strictEqual(hash(casesFile), casesHash, 'eval-cases.json must not change');
}

// (c) a second run right after: nothing added, nothing rebuilt, no new cases, the files do not change
{
  const sugHash = hash(sugFile), pjHash = hash(projectsFile);
  const r = run(['--update']);
  assert.strictEqual(r.status, 0, text(r));
  console.log(text(r).trimEnd().split('\n').map((l) => '  ' + l).join('\n'));
  assert.match(text(r), /summary: 0 added, 0 rebuilt, 2 up to date, 0 new suggested cases/);
  assert.match(text(r), /notes: 0 new suggested cases/);
  assert.strictEqual(hash(sugFile), sugHash);
  assert.strictEqual(hash(projectsFile), pjHash);
}

// (d) dry run after a new folder docs/c/: says what it would add, changes nothing
{
  writeFiles(path.join(docs, 'c'), { 'rope.md': '# Rope\n\n## Tie a knot\n\nLoop the rope twice and pull tight.\n', 'filler.md': fillerText });
  const pjHash = hash(projectsFile), sugHash = hash(sugFile);
  const r = run(['--update', '--dry-run']);
  assert.strictEqual(r.status, 0, text(r));
  console.log(text(r).trimEnd().split('\n').map((l) => '  ' + l).join('\n'));
  assert.match(text(r), /would add doc set c/);
  assert.ok(!readJson(projectsFile).projects.some((p) => p.name === 'c'), 'dry run must not register c');
  assert.strictEqual(hash(projectsFile), pjHash, 'projects.json unchanged');
  assert.strictEqual(hash(sugFile), sugHash, 'suggested file unchanged');
  // a real run then adds it
  const real = run(['--update']);
  assert.strictEqual(real.status, 0, text(real));
  assert.match(text(real), /added doc set c/);
  assert.match(text(real), /c: map built/);
}

console.log('update tests passed');
