// Tests for src/migrate-data.js. Uses temp folders only, never the real brain folder.
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { migrate, MOVES } = require('../src/migrate-data');

// the target of rank.json comes from the move table in src, so no private folder name is written here
const RANK_TO = MOVES.find(([from]) => from === 'rank.json')[1].replace('<p>', 'default');   // migrate() defaults to project 'default'

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const noop = () => {};

// Map of relative path (forward slashes) -> SHA-256, for every file under dir.
function listing(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p).split(path.sep).join('/')] = sha(p);
    }
  };
  walk(dir);
  return out;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-test-'));
try {
  const old = path.join(tmp, 'old');
  const neu = path.join(tmp, 'new');
  fs.mkdirSync(path.join(old, 'data'), { recursive: true });
  fs.mkdirSync(path.join(old, 'history', 'sub'), { recursive: true });
  fs.writeFileSync(path.join(old, 'data', 'mk.db'), '0123456789'); // 10 bytes
  fs.writeFileSync(path.join(old, 'rank.json'), '{"w":[1]}');
  fs.writeFileSync(path.join(old, 'history', 'a.jsonl'), '{"a":1}\n');
  fs.writeFileSync(path.join(old, 'history', 'sub', 'b.jsonl'), '{"b":2}\n');
  fs.mkdirSync(neu);
  const oldBefore = listing(old);

  // 1. dry run: plans 4, writes nothing
  const logs = [];
  const dry = migrate({ from: old, to: neu, dryRun: true, log: (m) => logs.push(m) });
  assert.strictEqual(dry.planned, 4);
  assert.strictEqual(dry.copied, 0);
  assert.deepStrictEqual(listing(neu), {});
  assert.deepStrictEqual(listing(old), oldBefore);
  assert.strictEqual(logs.filter((m) => m.startsWith('would copy ')).length, 4);
  console.log('ok dry run');

  // 2. real run: copies 4 files with equal hashes, sources kept, log has 4 lines
  const real = migrate({ from: old, to: neu, log: noop });
  assert.strictEqual(real.copied, 4);
  assert.strictEqual(real.done, 0);
  const pairs = [
    ['data/mk.db', 'mk.db'],
    ['rank.json', RANK_TO],
    ['history/a.jsonl', 'history/a.jsonl'],
    ['history/sub/b.jsonl', 'history/sub/b.jsonl'],
  ];
  for (const [src, dst] of pairs) {
    assert.strictEqual(sha(path.join(neu, dst)), sha(path.join(old, src)), dst);
  }
  assert.deepStrictEqual(listing(old), oldBefore);
  const logLines = fs.readFileSync(path.join(neu, 'migration.log'), 'utf8').split('\n').filter(Boolean);
  assert.strictEqual(logLines.length, 4);
  console.log('ok real run');

  // 3. second run: nothing to copy
  const again = migrate({ from: old, to: neu, log: noop });
  assert.strictEqual(again.copied, 0);
  assert.strictEqual(again.done, 4);
  console.log('ok second run');

  // 4. partial: a missing file is copied again, the rest is done
  fs.unlinkSync(path.join(neu, 'history', 'sub', 'b.jsonl'));
  const partial = migrate({ from: old, to: neu, log: noop });
  assert.strictEqual(partial.copied, 1);
  assert.strictEqual(partial.done, 3);
  assert.strictEqual(sha(path.join(neu, 'history', 'sub', 'b.jsonl')), sha(path.join(old, 'history', 'sub', 'b.jsonl')));
  console.log('ok partial resume');

  // 5. conflict: throws before copying anything (mk.db is missing, so it must stay missing)
  fs.unlinkSync(path.join(neu, 'mk.db'));
  fs.mkdirSync(path.dirname(path.join(neu, RANK_TO)), { recursive: true });
  fs.writeFileSync(path.join(neu, RANK_TO), '{"w":[2]}');
  const beforeConflict = listing(neu);
  assert.throws(() => migrate({ from: old, to: neu, log: noop }), (e) => e.message.includes('conflict: ' + RANK_TO));
  assert.deepStrictEqual(listing(neu), beforeConflict);
  console.log('ok conflict');

  // 6. projects: written once, never overwritten
  const pj1 = path.join(tmp, 'projects-1.json');
  const pj2 = path.join(tmp, 'projects-2.json');
  const to3 = path.join(tmp, 'new3');
  fs.writeFileSync(pj1, '{"version":1,"projects":[]}');
  fs.writeFileSync(pj2, '{"version":1,"projects":["other"]}');
  migrate({ from: old, to: to3, projects: pj1, log: noop });
  const projFile = path.join(to3, 'projects.json');
  assert.strictEqual(fs.readFileSync(projFile, 'utf8'), '{"version":1,"projects":[]}');
  migrate({ from: old, to: to3, projects: pj2, log: noop });
  assert.strictEqual(fs.readFileSync(projFile, 'utf8'), '{"version":1,"projects":[]}');
  console.log('ok projects');

  // 7. CLI
  const script = path.join(__dirname, '..', 'src', 'migrate-data.js');
  const noArgs = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.strictEqual(noArgs.status, 3);
  const cliTo = path.join(tmp, 'cli');
  const cliDry = spawnSync(process.execPath, [script, '--from', old, '--to', cliTo, '--dry-run'], { encoding: 'utf8' });
  assert.strictEqual(cliDry.status, 0, cliDry.stderr);
  assert.match(cliDry.stdout, /planned/);
  assert.ok(!fs.existsSync(cliTo));
  console.log('ok cli');

  console.log('ALL PASSED');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
