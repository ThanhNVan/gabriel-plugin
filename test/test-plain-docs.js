// Test for a docs-only project (projects.json "graph": null) in mk.js: build, search, format, status, stale.
// Runs in a temp folder. Prints ALL PASSED or the first failure.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-'));
const data = path.join(tmp, 'data'), home = path.join(tmp, 'home');
process.env.GABRIEL_DATA = data;
process.env.BRAIN_HOME = home;
fs.mkdirSync(data, { recursive: true });
fs.mkdirSync(home, { recursive: true });

const mk = require('../src/mk.js');

async function main() {
  const docs = path.join(data, 'docs', 'sample');
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, 'cooking.md'), '# Cooking\n\n## Boil pasta\n\nBring salted water to a rolling boil, add the pasta, stir.\n');
  fs.writeFileSync(path.join(docs, 'garden.md'), '# Garden\n\n## Water tomatoes\n\nWater at the base in the morning, twice a week.\n');
  fs.writeFileSync(path.join(docs, 'bikes.md'), '# Bikes\n\n## Fix a flat tire\n\nRemove the wheel, find the hole, patch the inner tube, pump it up.\n');
  // filler docs: word rarity (idf) only means something when there are many chunks (test-mk.js does the same); without them the gate (0.65) is not reached
  fs.writeFileSync(path.join(docs, 'filler.md'), ['# Filler', '', ...Array.from({ length: 120 }, (_, i) => `Filler note ${i} about subject${i} and gadget${i}.\n`)].join('\n'));
  fs.writeFileSync(path.join(data, 'projects.json'), JSON.stringify({ version: 1, projects: [
    { name: 'sample', label: 'Sample', root: 'docs/sample', graph: null, layout: 'all-md' },
    { name: 'withgraph', label: 'With graph', root: 'docs/sample', graph: 'graphify-out/graph.json', layout: 'all-md' },
  ] }));

  // 1. build a docs-only map (noEmbed: no local model needed)
  const built = await mk.build(home, { project: 'sample', noEmbed: true });
  assert.strictEqual(built.code, 0, 'a docs-only project has 0 code nodes');
  assert.ok(built.docs >= 4, 'the 4 files give at least 4 doc chunks');

  // 2. search finds the bike section; an off-topic question finds nothing
  const r1 = mk.search(home, 'how do I fix a flat tire on my bike', { project: 'sample', pv: null });
  assert.ok(r1, 'search returns a result for the bike question');
  assert.ok(r1.docs.length > 0, 'at least one doc');
  assert.strictEqual(r1.docs[0].n.file, 'bikes.md', 'first doc is bikes.md');
  assert.match(r1.docs[0].n.section, /Fix a flat tire/);
  assert.deepStrictEqual(r1.code, [], 'no code results');

  const r2 = mk.search(home, 'stock market prices today', { project: 'sample', pv: null });
  assert.strictEqual(r2, null, 'off-topic question returns null');

  // 3. format of the docs-only result
  const text = mk.format(r1);
  assert.ok(text.startsWith('Sample map ('), 'header starts with "Sample map ("');
  assert.ok(text.includes('spreading search over docs'), 'header says docs only');
  assert.ok(!text.split('\n').some((l) => l.startsWith('- code ')), 'no code lines');

  // 4. status and stale do not throw; stale is false right after the build
  const st = mk.status(home, 'sample');
  assert.ok(st && typeof st === 'object', 'status returns an object');
  assert.strictEqual(mk.stale(home, 'sample'), false, 'not stale right after the build');

  // 5. a project that names a graph file which does not exist is refused
  await assert.rejects(
    mk.build(home, { project: 'withgraph', noEmbed: true }),
    (e) => /graphify-out[\\/]graph\.json/.test(e.message),
    'build with a missing graph file must reject with the graph path'
  );

  console.log('ALL PASSED');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* still in use */ } });
