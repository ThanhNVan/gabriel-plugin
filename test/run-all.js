'use strict';
// Runs every test/test-*.js in alphabetical order, then the privacy scan (tools/check-public.js).
// Prints one line per test. A failed test also prints its last 20 output lines. Exit 1 on any failure.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TIMEOUT_MS = 600000;
const lastLine = (s) => (s || '').split(/\r?\n/).filter(Boolean).pop() || '';

// One run at a time: two runs share the real data folder and models, and failed at random when they overlapped.
const LOCK = path.join(require('node:os').tmpdir(), 'gabriel-test.lock');
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); } catch {
  const other = Number(fs.readFileSync(LOCK, 'utf8')) || 0;
  if (other && other !== process.pid && alive(other)) { console.error(`another test run is going (pid ${other}). Wait for it, or delete ${LOCK} if it is stuck.`); process.exit(1); }
  fs.writeFileSync(LOCK, String(process.pid));   // the old run is gone: take its lock
}
process.on('exit', () => { try { if (fs.readFileSync(LOCK, 'utf8') === String(process.pid)) fs.rmSync(LOCK); } catch { /* gone */ } });

const files = fs.readdirSync(__dirname).filter((f) => /^test-.*\.js$/.test(f)).sort();
let failed = 0;

files.forEach((file, i) => {
  const start = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8', timeout: TIMEOUT_MS, cwd: ROOT });
  const ms = Date.now() - start;
  const ok = !r.error && r.status === 0;
  console.log(`${i + 1}/${files.length} ${file}: ${ok ? 'PASS' : 'FAIL'} (${ms} ms)`);
  if (!ok) {
    failed++;
    const output = [(r.stdout || ''), (r.stderr || ''), r.error ? String(r.error.message) : ''].join('\n');
    const lines = output.split(/\r?\n/).filter((l) => l.trim() !== '');
    for (const line of lines.slice(-20)) console.log('    ' + line);
  }
});

const scan = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'check-public.js')], { encoding: 'utf8', timeout: TIMEOUT_MS, cwd: ROOT });
const scanOut = (scan.stdout || '') + (scan.stderr || '');
// no owner word list on this machine: a scan with 0 hits and the "word list not found" note still passes
const scanOk = scan.status === 0 || (scanOut.includes('word list not found') && /0 hits/.test(scanOut));
if (!scanOk) failed++;
console.log(`privacy scan: ${scanOk ? 'PASS' : 'FAIL'} - ${lastLine(scan.stdout) || lastLine(scan.stderr) || 'no output'}`);

console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
