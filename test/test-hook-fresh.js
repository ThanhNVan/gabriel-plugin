// Self-test: the first-run setup hint in the brain hook. Uses only temporary folders, removed at the end.
const assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');

const brain = path.resolve(__dirname, '..', 'src', 'brain.js');
const tmp = [];
const mkTmp = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); tmp.push(d); return d; };

const dataDir = mkTmp('gabriel-fresh-data-');              // empty: no setup yet
const home = mkTmp('gabriel-fresh-home-');
fs.writeFileSync(path.join(home, 'CLAUDE.md'), '# Rules\n- Always run the unit tests before saying done.\n');
const cwd = mkTmp('gabriel-fresh-cwd-');
const env = { ...process.env, GABRIEL_DATA: dataDir, BRAIN_HOME: home };
const SETUP = '/gabriel:setup';

const run = (session, prompt = 'please run the unit tests before saying done on this change') => {
  const t = Date.now();
  const r = spawnSync(process.execPath, [brain, 'hook'], { input: JSON.stringify({ prompt, session_id: session, cwd }), env, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, ms: Date.now() - t };
};

try {
  // first prompt of session s1: hint shown
  const a = run('s1');
  assert.strictEqual(a.status, 0, 'hook exit status');
  assert.ok(a.ms < 3000, 'hook too slow: ' + a.ms + ' ms');
  const outA = JSON.parse(a.stdout);
  assert.ok(outA.systemMessage.includes(SETUP), 'first run must show the setup hint');

  // second prompt of the same session: hint not repeated
  const b = run('s1');
  assert.strictEqual(b.status, 0, 'hook exit status (second)');
  assert.ok(b.ms < 3000, 'hook too slow (second): ' + b.ms + ' ms');
  assert.ok(!b.stdout.includes(SETUP), 'hint repeated in the same session');

  // a new session: hint shown again
  const c = run('s2');
  assert.strictEqual(c.status, 0, 'hook exit status (s2)');
  assert.ok(JSON.parse(c.stdout).systemMessage.includes(SETUP), 'new session must show the hint again');

  // touched before setup: no mk.db, so no output and exit 0
  const t = spawnSync(process.execPath, [brain, 'touched'], { input: JSON.stringify({ session_id: 's1', tool_input: { file_path: 'x.js' } }), env, encoding: 'utf8' });
  assert.strictEqual(t.status, 0, 'touched exit status');
  assert.strictEqual(t.stdout, '', 'touched must print nothing before setup');

  console.log('ALL PASSED');
} finally {
  for (const d of tmp) fs.rmSync(d, { recursive: true, force: true });
}
