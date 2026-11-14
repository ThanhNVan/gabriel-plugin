// Tests for src/setup.js. Every run uses a temp data folder and a temp rules home; the model is never downloaded.
const assert = require('node:assert'), crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SETUP = path.join(ROOT, 'src', 'setup.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-test-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const home = path.join(tmp, 'home');
fs.mkdirSync(home, { recursive: true });
fs.writeFileSync(path.join(home, 'CLAUDE.md'), 'Always answer in plain words.\n');

const env = { ...process.env, GABRIEL_SETUP_NO_MIGRATE: '1', BRAIN_HOME: home };
const run = (args) => spawnSync(process.execPath, [SETUP, ...args], { cwd: ROOT, env, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
const hashTree = (dir) => {
  const h = crypto.createHash('sha256');
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(d, e.name); h.update(path.relative(dir, p)); if (e.isDirectory()) walk(p); else h.update(fs.readFileSync(p)); } };
  walk(dir);
  return h.digest('hex');
};

// 1: dry run prints 10 steps and changes nothing on disk
{
  const d1 = path.join(tmp, 'd1');
  const r = run(['--dry-run', '--data', d1]);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const stepLines = r.stdout.split('\n').filter((l) => /step \d+\/10/.test(l));
  assert.strictEqual(stepLines.length, 10, r.stdout);
  assert.ok(!fs.existsSync(d1), 'dry run must not create the data folder');
  console.log('dry run: 10 step lines, no data folder created');
}

// 2: a real run with a tiny corpus builds the map (no model, no tests)
const d2 = path.join(tmp, 'd2');
const docs2 = path.join(d2, 'docs', 'sample');
fs.mkdirSync(docs2, { recursive: true });
fs.writeFileSync(path.join(docs2, 'a.md'), '# Alpha\n\nAlpha notes about the first topic.\nKeep the alpha list short.\n');
fs.writeFileSync(path.join(docs2, 'b.md'), '# Beta\n\nBeta notes about the second topic.\nBeta rules are checked each week.\n');
const words = ['gate', 'river', 'token', 'report', 'budget', 'frame', 'signal', 'matrix', 'ledger', 'harbor', 'vector', 'cabin', 'orbit'];
const filler = ['# Filler', ''];
for (let i = 0; i < 120; i++) filler.push(`${i + 1}. ${words[i % words.length]} and ${words[(i * 5 + 3) % words.length]} check item ${i * 7 % 53}.`);
fs.writeFileSync(path.join(docs2, 'filler.md'), filler.join('\n') + '\n');

const t0 = Date.now();
const r2 = run(['--skip-model', '--skip-test', '--data', d2]);
const d2Ms = Date.now() - t0;
assert.strictEqual(r2.status, 0, r2.stdout + r2.stderr);
assert.ok(fs.existsSync(path.join(d2, 'mk.db')), 'mk.db must exist after the first run');
assert.match(r2.stdout, /\b1 project\b/, r2.stdout);
const before = hashTree(path.join(d2, 'docs'));
console.log(`d2 first run: exit 0, mk.db built, ${d2Ms} ms`);

// 3: running again is safe and leaves the docs alone
const t1 = Date.now();
const r3 = run(['--skip-model', '--skip-test', '--data', d2]);
const d3Ms = Date.now() - t1;
assert.strictEqual(r3.status, 0, r3.stdout + r3.stderr);
assert.strictEqual(hashTree(path.join(d2, 'docs')), before, 'docs folder changed on the second run');
console.log(`d2 second run: exit 0, docs unchanged, ${d3Ms} ms`);

// 4: empty data folder gets a starter README file, and no doc set (so `add-docs notes …` stays free)
const d3 = path.join(tmp, 'd3');
fs.mkdirSync(d3, { recursive: true });
const r5 = run(['--skip-model', '--skip-test', '--data', d3]);
assert.strictEqual(r5.status, 0, r5.stdout + r5.stderr);
assert.ok(fs.existsSync(path.join(d3, 'docs', 'README.md')), 'starter README must be created');
assert.ok(!fs.readdirSync(path.join(d3, 'docs'), { withFileTypes: true }).some((e) => e.isDirectory() && e.name !== 'stack'), 'no starter folder');
assert.ok(fs.existsSync(path.join(d3, 'docs', 'stack')), 'setup makes the empty docs/stack folder');
assert.match(r5.stdout, /no doc sets yet/);
console.log('d3 empty folder: exit 0, starter README created, output says "no doc sets yet"');

// 5: --tune dry run prints the venv path and the pip commands, and creates nothing
{
  const d5 = path.join(tmp, 'd5');
  const r = run(['--tune', '--dry-run', '--data', d5]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes(path.join(d5, 'tune-venv')), r.stdout);
  assert.match(r.stdout, /pip install torch --index-url https:\/\/download\.pytorch\.org\/whl\/cpu/);
  assert.match(r.stdout, /pip install -r .*requirements\.txt/);
  assert.ok(!fs.existsSync(d5), 'tune dry run must not create the data folder');
  console.log('tune dry run: exit 0, venv path and pip commands printed, nothing created');
}

// --only with a name that is not a step: the error lists every accepted value (tune is mapped to --tune)
{
  const r = run(['--only', 'nosuch']);
  assert.strictEqual(r.status, 2, r.stdout + r.stderr);
  assert.strictEqual((r.stderr || '').split('\n')[0], '--only must be model, build, test or tune', 'the error lists every accepted value');
  console.log('--only error: model, build, test or tune');
}

console.log('ALL PASSED');
