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

    // 4: code pairs (src/tune/code-pairs.js): anchors from code names, positive = codeText(label, file)
    const { codePairs } = require(path.join(ROOT, 'src', 'tune', 'code-pairs.js'));
    const { codeText } = require(path.join(ROOT, 'src', 'mk.js'));
    const DEL = { label: 'DeleteProjectCommandHandler', file: 'Services/Vessels/Vessels.Application/Commands/Project/Delete/DeleteProjectCommandHandler.cs' };
    const EVT = { label: 'OnVesselCreated', file: 'Services/Vessels/Vessels.Application/Events/OnVesselCreated.cs' };
    const REPO = { label: 'CompanyRepository', file: 'Services/Companies/Companies.Infrastructure/Repositories/CompanyRepository.cs' };
    const DOTTED = { label: 'Metizoft.Vessels.Application', file: 'Services/Vessels/Vessels.Application/Foo.cs' };
    const delAnchors = codePairs([DEL], { seed: 42 }).map((p) => p.anchor);
    assert.ok(delAnchors.includes('what happens when a project is deleted'), 'delete anchor: ' + delAnchors.join(' | '));
    const evtAnchors = codePairs([EVT], { seed: 42 }).map((p) => p.anchor);
    assert.ok(evtAnchors.some((a) => a.startsWith('what happens after vessel')), 'event anchor: ' + evtAnchors.join(' | '));
    const repoAnchors = codePairs([REPO], { seed: 42 }).map((p) => p.anchor);
    assert.ok(repoAnchors.some((a) => a.includes('database')), 'repository anchor: ' + repoAnchors.join(' | '));
    const skipped = codePairs([DEL], { seed: 42, skip: new Set(['what happens when a project is deleted']) }).map((p) => p.anchor);
    assert.ok(!skipped.includes('what happens when a project is deleted'), 'skip set removes the anchor');
    assert.deepStrictEqual(codePairs([DEL, EVT, REPO], { seed: 7 }), codePairs([DEL, EVT, REPO], { seed: 7 }), 'same seed, same output');
    assert.strictEqual(codePairs([DOTTED], { seed: 42 }).length, 0, 'namespace label gives 0 pairs');
    assert.strictEqual(codePairs([{ label: 'Some.Dotted', file: DEL.file }], { seed: 42 }).length, 0, 'any label with a dot gives 0 pairs');
    for (const r of [DEL, EVT, REPO]) {
      for (const p of codePairs([r], { seed: 42 })) assert.strictEqual(p.positive, codeText(r.label, r.file), 'positive is codeText');
    }
    console.log('  ok: code pairs: anchors from names, skip set, seed, namespace labels dropped, positive = codeText');

    // 5: a project with code in the map but no eval-cases.json still gets code pairs; its case questions stay out
    fs.writeFileSync(path.join(DATA, 'projects.json'), JSON.stringify({ version: 1, projects: [
      { name: 'demo', root: DOCS, layout: 'all-md', graph: null }, { name: 'other', root: DOCS, layout: 'all-md', graph: null }] }));
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(mk.dbFile());
    const ins = db.prepare("INSERT INTO nodes(kind, label, file, deg, project) VALUES ('code', ?, ?, 1, 'other')");
    ins.run(DEL.label, DEL.file); ins.run(EVT.label, EVT.file);
    db.close();
    fs.mkdirSync(path.join(DATA, 'private', 'other'), { recursive: true });
    fs.writeFileSync(path.join(DATA, 'private', 'other', 'eval-cases-scenario.json'), JSON.stringify([{ id: 'SC-1', q: 'what happens when a project is deleted', code: '^DeleteProjectCommandHandler$' }]));
    const e = exportPairs({ out: path.join(base, 'out-e'), seed: 42, min: 10 });
    assert.ok(e.codeCounts.other > 0, 'code pairs for a project with no eval-cases.json: ' + JSON.stringify(e.codeCounts));
    assert.strictEqual(e.train + e.heldout - Object.values(e.codeCounts).reduce((s, n) => s + n, 0), NF * NS, 'doc pairs still come only from demo');
    let anchors = readJsonl(path.join(base, 'out-e', 'pairs.train.jsonl')).filter((p) => p.project === 'other').map((p) => p.anchor);
    assert.ok(!anchors.includes('what happens when a project is deleted'), 'a scenario question is never a training anchor');
    // a question of ANOTHER project is never an anchor either (one skip list for all projects)
    fs.rmSync(path.join(DATA, 'private', 'other', 'eval-cases-scenario.json'));
    fs.writeFileSync(path.join(DATA, 'private', 'demo', 'eval-cases-exact.json'), JSON.stringify([{ id: 'EX-1', q: 'what happens when a project is deleted', code: 'x' }]));
    exportPairs({ out: path.join(base, 'out-f'), seed: 42, min: 10 });
    anchors = readJsonl(path.join(base, 'out-f', 'pairs.train.jsonl')).map((p) => p.anchor);
    assert.ok(!anchors.includes('what happens when a project is deleted'), 'a question of project demo is never an anchor for project other');
    console.log('  ok: code pairs for every project with code in the map; scenario questions stay out');

    console.log('ALL PASSED');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
