'use strict';
// Runs the Python self-test of src/tune/hard_negs.py (hard negative mining, no model). Needs the tune venv (private/tune-venv).
// Without the venv this test prints a skip line and exits 0.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PY = process.platform === 'win32'
  ? path.join(ROOT, 'private', 'tune-venv', 'Scripts', 'python.exe')
  : path.join(ROOT, 'private', 'tune-venv', 'bin', 'python');
if (!fs.existsSync(PY)) { console.log('SKIP: no tune venv'); process.exit(0); }

const r = spawnSync(PY, ['-I', path.join(ROOT, 'src', 'tune', 'hard_negs.py'), '--self-test'], { encoding: 'utf8' });
assert.strictEqual(r.status, 0, `hard_negs self-test exit ${r.status}: ${r.stdout}${r.stderr}`);
assert.ok(r.stdout.includes('ok'), `no ok line in: ${r.stdout}`);
console.log(r.stdout.trim());

const TRAIN = path.join(ROOT, 'src', 'tune', 'train.py');
const s = spawnSync(PY, ['-I', TRAIN, '--stages', '2', '--pairs', 'x', '--out', 'y'], { encoding: 'utf8' });
assert.strictEqual(s.status, 2, `--stages 2 without --hard-negs exit ${s.status}: ${s.stdout}${s.stderr}`);
assert.ok(s.stderr.includes('--stages 2 needs --hard-negs'), `no stages message in stderr: ${s.stderr}`);
const c = spawnSync(PY, ['-I', TRAIN, '--ce-filter', 'x', '--pairs', 'x', '--out', 'y'], { encoding: 'utf8' });
assert.strictEqual(c.status, 2, `--ce-filter without --hard-negs exit ${c.status}: ${c.stdout}${c.stderr}`);
assert.ok(c.stderr.includes('--ce-filter needs --hard-negs'), `no ce-filter message in stderr: ${c.stderr}`);
const lb = spawnSync(PY, ['-I', TRAIN, '--loss', 'bogus', '--pairs', 'x', '--out', 'y'], { encoding: 'utf8' });
assert.strictEqual(lb.status, 2, `--loss bogus exit ${lb.status}: ${lb.stdout}${lb.stderr}`);
assert.ok(lb.stderr.includes("argument --loss: invalid choice: 'bogus'"), `no --loss choice error in stderr: ${lb.stderr}`);
const mm = spawnSync(PY, ['-I', TRAIN, '--loss', 'margin-mse', '--pairs', 'x', '--out', 'y'], { encoding: 'utf8' });
assert.strictEqual(mm.status, 2, `--loss margin-mse without --hard-negs exit ${mm.status}: ${mm.stdout}${mm.stderr}`);
assert.ok(mm.stderr.includes('--loss margin-mse needs --hard-negs 1'), `no margin-mse message in stderr: ${mm.stderr}`);
const h = spawnSync(PY, ['-I', TRAIN, '--help'], { encoding: 'utf8' });
assert.ok(h.stdout.includes('--stages'), `--help has no --stages: ${h.stdout}`);
console.log('train.py --stages checks ok');
console.log('ALL PASSED');
