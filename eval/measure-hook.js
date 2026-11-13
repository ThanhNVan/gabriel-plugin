// Cold-process timing of the real hook against the selected BRAIN_HOME.
// Prompts: measure-prompts.json in the private data folder of the default project when it exists (a list of {prompt, cwd}),
// else 3 generic prompts. With the owner's list, the first 3 prompts must get a map.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const paths = require('../src/paths.js');
const mk = require('../src/mk.js');
const SRC = path.join(__dirname, '..', 'src');

const GENERIC = [
  { prompt: 'How do I add a new page to the docs site?', cwd: process.cwd() },
  { prompt: 'What does the build script do before a release?', cwd: process.cwd() },
  { prompt: 'How do I remove a coffee stain from cotton?', cwd: process.cwd() },
];

let project = 'default';
try { project = mk.defaultProject() || 'default'; } catch { project = 'default'; }
const ownFile = path.join(paths.privateDir(project), 'measure-prompts.json');
const owner = fs.existsSync(ownFile);
const cases = owner ? JSON.parse(fs.readFileSync(ownFile, 'utf8')) : GENERIC;

const rows = [], RUN = Date.now();   // a new session per run: dedupe would hide items a fixed session id already got
for (const [i, c] of cases.entries()) {
  const start = Date.now();
  const child = spawnSync(process.execPath, [path.join(SRC, 'brain.js'), 'hook'], { env: process.env, input: JSON.stringify({ ...c, session_id: `retrieval-timing-${RUN}-${i}` }), encoding: 'utf8', timeout: 15000 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  const output = child.stdout.trim() ? JSON.parse(child.stdout) : {};
  const text = output.hookSpecificOutput?.additionalContext || '';
  rows.push({ prompt: c.prompt, ms: Date.now() - start, map: /\bmap \(/.test(text), chars: text.length });
  console.log(JSON.stringify(rows.at(-1)));
}
if (owner) assert.ok(rows.slice(0, 3).every((r) => r.map), 'relevant prompts must retain a map within the timeout');
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(rows, null, 2) + '\n');
console.log(owner ? 'hook timing PASSED (owner prompts)' : 'hook timing PASSED (generic prompts)');
