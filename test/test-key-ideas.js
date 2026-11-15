'use strict';
// Rewrite check: a shorter doc that keeps every key idea passes; one that drops two fails. Temp folders only.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const KEY = path.resolve(__dirname, '..', 'tools', 'key-ideas.js');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'key-ideas-test-'));

function write(file, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

function check(args) {
  return spawnSync(process.execPath, [KEY, ...args], { encoding: 'utf8' });
}

try {
  // Before: 4 key ideas outside the fence (`check-docs.js`, guide.md, 10 min, 99 characters). The 42 inside the fence is not one.
  const before = ['# A', '', 'Run `check-docs.js` every 10 min. See [guide](guide.md).', 'Limit is 99 characters.', '', '```text', 'hidden 42', '```'];
  write(path.join(ROOT, 'before', 'a.md'), before);
  write(path.join(ROOT, 'after-ok', 'a.md'), ['# A', '', 'Run `check-docs.js` every 10 min.']);
  // The moved facts live in another doc of the after set: they count as kept.
  write(path.join(ROOT, 'after-ok', 'moved.md'), ['See [guide](guide.md) and 99 characters.']);
  write(path.join(ROOT, 'after-bad', 'a.md'), ['# A', '', 'Run `check-docs.js` every 10 min.']);

  let r = check([path.join(ROOT, 'before'), path.join(ROOT, 'after-ok')]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(r.stdout.trim().split('\n'), [
    'a.md: 8 -> 3 lines, key ideas kept: 4/4',
    'key-ideas: 0 lost',
  ]);

  r = check([path.join(ROOT, 'before'), path.join(ROOT, 'after-bad')]);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.deepStrictEqual(r.stdout.trim().split('\n'), [
    'a.md: 8 -> 3 lines, key ideas kept: 2/4',
    '  lost: guide.md',
    '  lost: 99 characters',
    'key-ideas: 2 lost',
  ]);

  // Two files compare as they are: the same loss, with the after file's name.
  r = check([path.join(ROOT, 'before', 'a.md'), path.join(ROOT, 'after-bad', 'a.md')]);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^a\.md: 8 -> 3 lines, key ideas kept: 2\/4$/m);
  assert.match(r.stdout, /key-ideas: 2 lost/);

  // A doc removed in "after" is still checked: its ideas must be in another after doc.
  write(path.join(ROOT, 'before2', 'gone.md'), ['Keep `kept.js` and `lostFn()`.']);
  write(path.join(ROOT, 'after2', 'other.md'), ['Now `kept.js` lives here.']);
  r = check([path.join(ROOT, 'before2'), path.join(ROOT, 'after2')]);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.deepStrictEqual(r.stdout.trim().split('\n'), ['gone.md: 1 -> 0 lines, key ideas kept: 1/2', '  lost: lostFn()', 'key-ideas: 1 lost']);

  console.log('ALL PASSED');
} finally {
  fs.rmSync(ROOT, { recursive: true, force: true });
}
