'use strict';
// Per-project eval and training: suggest-cases, eval-map (one project, --all, no cases), train-rank, retrain, and the question index path.
// Uses temp data and brain folders. The steps that need the local meaning model run only when it is installed; otherwise they are marked SKIP
// and the no-model paths are checked instead.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'train-test-'));
const DATA = path.join(base, 'data'), HOME = path.join(base, 'home'), CORPUS = path.join(base, 'corpus'), EMPTY = path.join(base, 'empty');
const env = { ...process.env, GABRIEL_DATA: DATA, BRAIN_HOME: HOME, GABRIEL_NO_DOWNLOAD: '1' };
delete env.BRAIN_DATA;
const node = (args) => spawnSync(process.execPath, args, { encoding: 'utf8', env, cwd: ROOT, timeout: 600000 });
const cli = (script, args) => node([path.join(ROOT, script), ...args]);
const step = (msg) => console.log('  ok: ' + msg);
const privateDir = (name) => path.join(DATA, 'private', name);

try {
  for (const d of [DATA, HOME, CORPUS, EMPTY]) fs.mkdirSync(d, { recursive: true });
  // the meaning model lives in the data folder: link the owner's model folder into the temp data folder when it is installed
  const outerData = process.env.GABRIEL_DATA || process.env.BRAIN_DATA || path.join(os.homedir(), '.claude', 'gabriel-data');
  if (fs.existsSync(path.join(outerData, 'models'))) fs.symlinkSync(path.join(outerData, 'models'), path.join(DATA, 'models'), 'junction');
  const hasModel = node(['-e', `require(${JSON.stringify(path.join(ROOT, 'src', 'embed.js'))}).getEmbedder(false).then((e) => { process.stdout.write(e ? 'yes' : 'no'); process.exit(0); })`]).stdout === 'yes';

  // fixture: three small docs with one ## section each (the # title is not a section), and a filler file so the corpus is not tiny
  fs.writeFileSync(path.join(CORPUS, 'cooking.md'), '# Cooking\n\n## Boil pasta\n\nFill a large pot with water and salt, then bring it to a rolling boil before adding the pasta.\n');
  fs.writeFileSync(path.join(CORPUS, 'garden.md'), '# Garden\n\n## Water tomatoes\n\nWater the tomato plants at the base in the morning so the leaves stay dry.\n');
  fs.writeFileSync(path.join(CORPUS, 'bikes.md'), '# Bikes\n\n## Fix a flat tire\n\nRemove the wheel, pull out the tube, find the hole and patch it before you refit the tire.\n');
  const vocab = ['river', 'stone', 'lamp', 'window', 'market', 'violin', 'orbit', 'copper', 'meadow', 'ledger', 'harbor', 'velvet', 'thunder', 'pencil', 'glacier', 'basket'];
  fs.writeFileSync(path.join(CORPUS, 'filler.md'), Array.from({ length: 120 }, (_, i) => `${vocab[i % 16]} ${vocab[(i * 7 + 3) % 16]} ${vocab[(i * 5 + 1) % 16]} notes number ${i}.`).join('\n\n') + '\n');
  fs.writeFileSync(path.join(DATA, 'projects.json'), JSON.stringify({ version: 1, projects: [
    { name: 'sample', root: CORPUS, layout: 'all-md', graph: null },
    { name: 'bare', root: EMPTY, layout: 'all-md', graph: null }] }));

  let r = cli('src/brain.js', ['build-mk', 'sample']);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  step('map built for sample');

  // suggest-cases: one case per ## / ### section, the right doc, never eval-cases.json
  r = cli('eval/suggest-cases.js', ['--project', 'sample']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /wrote 3 suggested cases to .*eval-cases\.suggested\.json; review them, then save as eval-cases\.json/);
  assert.ok(!fs.existsSync(path.join(privateDir('sample'), 'eval-cases.json')));
  const sug = JSON.parse(fs.readFileSync(path.join(privateDir('sample'), 'eval-cases.suggested.json'), 'utf8'));
  assert.strictEqual(sug.length, 3);
  for (const [heading, file] of [['Boil pasta', 'cooking.md'], ['Water tomatoes', 'garden.md'], ['Fix a flat tire', 'bikes.md']]) {
    const hit = sug.filter((c) => new RegExp(c.sec, 'i').test(heading) && new RegExp(c.doc, 'i').test(file));
    assert.strictEqual(hit.length, 1, heading);
    assert.ok(hit[0].q.startsWith(heading + ': ') && hit[0].q.length <= 160, hit[0].q);
    assert.strictEqual(hit[0].set, 'suggested');
  }
  step('suggest-cases: 3 cases, one per section, right doc');

  // the review step: save the suggestions as the cases file (set renamed to dev so train-rank uses them)
  fs.writeFileSync(path.join(privateDir('sample'), 'eval-cases.json'), JSON.stringify(sug.map((c) => ({ ...c, set: 'dev' }))));
  step('suggestions saved as eval-cases.json (set dev)');

  r = cli('eval/eval-map.js', ['--project', 'sample']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ {2}sample questions\s+strict \d+\/3 /m);
  step('eval-map --project sample prints a strict line');

  r = cli('eval/eval-map.js', ['--all']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /== project sample/);
  assert.ok(!/== project bare/.test(r.stdout), 'bare has no cases file');
  step('eval-map --all: only projects with a cases file');

  r = cli('eval/eval-map.js', ['--project', 'bare']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /no eval cases for bare: see docs\/EVAL\.md/);
  step('eval-map with no cases file: note, exit 0');

  if (hasModel) {
    r = cli('src/train-rank.js', ['--project', 'sample', '--write']);
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    const rank = JSON.parse(fs.readFileSync(path.join(privateDir('sample'), 'rank.json'), 'utf8'));
    assert.strictEqual(rank.w.length, 23);
    step('train-rank --write -> private/sample/rank.json');
  } else {
    r = cli('src/train-rank.js', ['--project', 'sample', '--write']);
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /needs the local meaning model/);
    step('SKIP train-rank write (no meaning model here): the no-model message is checked instead');
  }

  r = cli('src/retrain.js', ['sample']);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /current weights/);
  if (hasModel) assert.match(r.stdout, /new weights: strict \d+\/\d+/);
  else assert.match(r.stdout, /train-rank failed/);
  step('retrain sample: prints the scores, exit 0');

  r = cli('src/retrain.js', ['bare']);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no eval cases for bare yet/);
  step('retrain with no cases: suggests them, exit 0');

  r = node(['-e', `process.stdout.write(String(require(${JSON.stringify(path.join(ROOT, 'src', 'dq.js'))}).load(process.env.BRAIN_HOME, 'sample')))`]);
  assert.strictEqual(r.stdout, 'null');
  step('question index: no dq.sample.bin -> no index (map works without it)');

  console.log(hasModel ? 'ALL PASSED' : 'ALL PASSED (meaning steps skipped: no local model installed)');
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}
