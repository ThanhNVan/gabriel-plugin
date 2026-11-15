'use strict';
// Claim checker: a doc whose claims all exist passes; a doc with made-up path, function, constant and flag claims fails. Temp folders only.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CHECK = path.resolve(__dirname, '..', 'tools', 'check-claims.js');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'check-claims-test-'));

function write(file, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

function check(args) {
  return spawnSync(process.execPath, [CHECK, ...args], { encoding: 'utf8' });
}

try {
  const repo = path.join(ROOT, 'repo');
  write(path.join(repo, 'src', 'real.js'), ['function realFn() {', '  return MAX_ITEMS_HERE;', '}', 'const MAX_ITEMS_HERE = 1;', 'module.exports = { realFn };']);
  write(path.join(repo, 'skills', 'demo', 'SKILL.md'), ['Use --relink to fix.']);

  // Every claim here exists, or is skipped on purpose (fence, placeholder, command with spaces, URL).
  const good = path.join(ROOT, 'good');
  write(path.join(good, 'guide', 'a.md'), ['# Good', '',
    'See `src/real.js`, `realFn()` and `MAX_ITEMS_HERE`.',
    'Flag `--relink` and file `helper/b.js` next door.',
    'Skipped: `<name>/x.js`, `node tools/x.js run`, `https://example.com/a.md`.', '',
    '```text', 'Inside a fence: `src/gone.js` and `goneFn()`.', '```']);
  write(path.join(good, 'guide', 'helper', 'b.js'), ['']);

  let r = check([good, '--code', repo]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.strictEqual(r.stdout.trim(), 'check-claims: 0 hits');

  // Four false claims, one per kind. The true claim on line 7 is not reported.
  const bad = path.join(ROOT, 'bad');
  write(path.join(bad, 'bad.md'), ['# Bad', '',
    'Path `src/nope.js` is gone.',
    'Call `ghostFn()` now.',
    'Const `NO_SUCH_CONST` too.',
    'Flag `--nope-flag` too.',
    '', '`realFn()` is fine.']);

  r = check([bad, '--code', repo]);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.deepStrictEqual(r.stdout.trim().split('\n'), [
    'bad.md:3: path not found: src/nope.js',
    'bad.md:4: function not found: ghostFn()',
    'bad.md:5: constant not found: NO_SUCH_CONST',
    'bad.md:6: flag not found: --nope-flag',
    'check-claims: 4 hits',
  ]);

  // A short path matches a repo file that ends with it; home, data-folder and --ignore paths are skipped.
  write(path.join(repo, 'deep', 'hosts', 'only.js'), ['']);
  const short = path.join(ROOT, 'short');
  write(path.join(short, 's.md'), ['# S', '',
    'Short path `hosts/only.js` is under deep/.',
    'Home `~/.codex/hooks.json`, data `history/graph.db`, other repo `docs/README.md`.',
    'Missing `hosts/none.js`.']);
  r = check([short, '--code', repo, '--ignore', 'docs/README.md']);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.deepStrictEqual(r.stdout.trim().split('\n'), ['s.md:5: path not found: hosts/none.js', 'check-claims: 1 hits']);

  console.log('ALL PASSED');
} finally {
  fs.rmSync(ROOT, { recursive: true, force: true });
}
