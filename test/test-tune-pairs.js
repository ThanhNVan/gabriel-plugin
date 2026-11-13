'use strict';
// Tests for src/tune/export-pairs.js: one pair per case, split by doc file (no held-out file in training), same seed = same split,
// different seed = different split, held-out cases file, and the refusal with too few cases. Temp data folder; no model needed.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tune-pairs-test-'));
const DATA = path.join(base, 'data'), DOCS = path.join(base, 'docs'), HOME = path.join(base, 'home');
process.env.GABRIEL_DATA = DATA;
process.env.BRAIN_HOME = HOME;
delete process.env.BRAIN_DATA;
delete process.env.GABRIEL_EMBED_MODEL;

const NF = 8, NS = 8;   // 8 doc files, 8 sections each: 64 cases
const readJsonl = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

(async () => {
  try {
    for (const d of [DATA, DOCS, HOME]) fs.mkdirSync(d, { recursive: true });
    for (let i = 0; i < NF; i++) {
      let text = `# Doc ${i}\n\n`;
      for (let k = 1; k <= NS; k++) text += `## Sec ${k}\n\nFile ${i} section ${k} talks about topic${i}x${k} in plain words.\n\n`;
      fs.writeFileSync(path.join(DOCS, `f${i}.md`), text);
    }
    fs.writeFileSync(path.join(DOCS, 'filler.md'), '# Filler\n\n## Notes\n\n' + 'Filler words about nothing special here. '.repeat(20) + '\n');
    fs.writeFileSync(path.join(DATA, 'projects.json'), JSON.stringify({ version: 1, projects: [{ name: 'demo', root: DOCS, layout: 'all-md', graph: null }] }));

    // the map (no meaning numbers: noEmbed), then the eval cases: one per section
    const mk = require(path.join(ROOT, 'src', 'mk.js'));
    await mk.build(undefined, { project: 'demo', noEmbed: true });
    const cases = [];
    for (let i = 0; i < NF; i++) for (let k = 1; k <= NS; k++) {
      cases.push({ id: `T-${i}-${k}`, q: `What does file ${i} say in part ${k}?`, doc: `^f${i}\\.md$`, sec: `Sec ${k}$`, set: 'dev', tier: 'easy' });
    }
    fs.mkdirSync(path.join(DATA, 'private', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(DATA, 'private', 'demo', 'eval-cases.json'), JSON.stringify(cases));

    const { exportPairs } = require(path.join(ROOT, 'src', 'tune', 'export-pairs.js'));

    // 1: one pair per case; the split is by file; held-out files never reach training
    const outA = path.join(base, 'out-a');
    const a = exportPairs({ out: outA, seed: 42, min: 10 });
    const train = readJsonl(path.join(outA, 'pairs.train.jsonl')), held = readJsonl(path.join(outA, 'pairs.heldout.jsonl'));
    const split = readJson(path.join(outA, 'split.json'));
    const heldFiles = new Set(split.heldout_files);
    assert.strictEqual(train.length + held.length, NF * NS, 'one pair per case');
    assert.strictEqual(a.train, train.length);
    assert.strictEqual(a.heldout, held.length);
    assert.ok(heldFiles.size >= 1 && heldFiles.size < NF, 'some files held out, some kept for training');
    assert.strictEqual(held.length, heldFiles.size * NS, 'held-out pairs = held-out files x sections');
    assert.strictEqual(train.length, (NF - heldFiles.size) * NS, 'train pairs = train files x sections');
    assert.ok(held.every((p) => heldFiles.has(p.file)), 'held-out pairs only from held-out files');
    assert.ok(train.every((p) => !heldFiles.has(p.file)), 'no held-out file in training');
    assert.ok(train.every((p) => p.positive.includes(': File ') && p.anchor.startsWith('What does file')), 'anchor and positive text');
    console.log(`  ok: ${train.length} train + ${held.length} held-out pairs, split by file (${heldFiles.size} held-out files)`);

    // the held-out cases file: only cases whose doc file is held out
    const hc = readJson(path.join(outA, 'demo.heldout-cases.json'));
    assert.strictEqual(hc.length, held.length);
    assert.ok(hc.every((c) => [...heldFiles].some((f) => new RegExp(c.doc).test(f))), 'held-out cases point at held-out files');
    console.log('  ok: demo.heldout-cases.json holds only held-out cases');

    // 2: same seed = same split; different seed = different split
    const outB = path.join(base, 'out-b');
    exportPairs({ out: outB, seed: 42, min: 10 });
    assert.deepStrictEqual(readJson(path.join(outB, 'split.json')), split, 'same seed, same split');
    let other = null;
    for (const seed of [7, 8, 9, 10, 11, 12]) {   // a seed that gives another split (the first one that differs)
      const outC = path.join(base, 'out-c-' + seed);
      exportPairs({ out: outC, seed, min: 10 });
      const s = readJson(path.join(outC, 'split.json'));
      if (JSON.stringify(s.heldout_files) !== JSON.stringify(split.heldout_files)) { other = s; break; }
    }
    assert.ok(other, 'some other seed gives another split');
    console.log('  ok: same seed gives the same split, another seed gives another split');

    // 3: refusal with too few cases: exit 1 message, nothing written
    assert.throws(() => exportPairs({ out: path.join(base, 'out-x'), min: 1000 }),
      /too few cases: add or review more in eval-cases\.json \(have \d+, need 1000\)/);
    assert.ok(!fs.existsSync(path.join(base, 'out-x')), 'nothing written on refusal');
    const cli = spawnSync(process.execPath, [path.join(ROOT, 'src', 'tune', 'export-pairs.js'), '--min', '1000', '--out', path.join(base, 'out-y')],
      { encoding: 'utf8', env: process.env });
    assert.strictEqual(cli.status, 1, cli.stdout + cli.stderr);
    assert.match(cli.stderr, /too few cases: add or review more in eval-cases\.json \(have \d+, need 1000\)/);
    console.log('  ok: too few cases -> exit 1 with the message');

    console.log('ALL PASSED');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
