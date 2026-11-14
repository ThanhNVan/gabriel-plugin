'use strict';
// Doc checker: each rule hits in a bad fixture, the clean doc and known false hits stay quiet. Temp folders only.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CHECK = path.resolve(__dirname, '..', 'tools', 'check-docs.js');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'check-docs-test-'));

function write(file, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

function check(args) {
  return spawnSync(process.execPath, [CHECK, ...args], { encoding: 'utf8' });
}

try {
  const repo = path.join(ROOT, 'repo');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'real.js'), '');
  const dir = path.join(ROOT, 'docs');

  const bad = ['# Bad doc', '', '## Planned', '', 'TBD: fill this in.', '', 'See cli.js:123 for the flow.', '',
    '[gone](nope.md) is missing.', '', '`src/nope.js` is gone.', '',
    '```text', 'a', 'b', 'c', 'd', 'e', 'f', '```'];
  while (bad.length < 305) bad.push('Filler line.');
  write(path.join(dir, 'bad.md'), bad);
  const flow = [];
  while (flow.length < 121) flow.push('Step line.');
  write(path.join(dir, 'workflows', 'W01-flow.md'), flow);
  write(path.join(dir, 'clean.md'), ['# Clean', '', 'See [bad](bad.md) and `src/real.js`. Run at 10:30.',
    'Open https://example.com:8080/x for more.', '',
    '```mermaid', 'flowchart LR', 'a-->b', 'b-->c', 'c-->d', 'd-->e', 'e-->f', '```', '',
    '```text', 'TBD in code and cite cli.js:5', '```']);
  write(path.join(dir, 'node_modules', 'junk.md'), ['TBD']);
  write(path.join(dir, 'false-hits.md'), ['# False hits', '', 'Never leave a "TBD" section or "maybe later" text.',
    'Step 6 is planned only when the file exists.', '', '```text', '├─ docs/', '│  └─ README.md',
    '└─ src/', '   ├─ a.js', '   ├─ b.js', '   └─ c.js', '```']);

  let r = check([dir, '--code', repo]);
  assert.strictEqual(r.status, 1);
  for (const rule of ['size', 'code-block', 'line-number', 'placeholder', 'link', 'path']) {
    assert.match(r.stdout, new RegExp(': ' + rule + ':'), rule);
  }
  assert.match(r.stdout, /workflows\/W01-flow\.md:\d+: size:/);
  assert.match(r.stdout, /bad\.md:3: placeholder: word "Planned"/, 'planned as a heading is a marker');
  assert.doesNotMatch(r.stdout, /clean\.md/);
  assert.doesNotMatch(r.stdout, /junk\.md/, 'node_modules is skipped');
  assert.doesNotMatch(r.stdout, /false-hits\.md/, 'quoted words, a planned condition and a folder tree are not hits');
  assert.match(r.stdout, /check-docs: \d+ hits/);

  r = check([dir, '--code', repo, '--no-size']);
  assert.strictEqual(r.status, 1, 'other rules still hit');
  assert.doesNotMatch(r.stdout, /: size:/, '--no-size turns off size');

  r = check([dir]);
  assert.doesNotMatch(r.stdout, /: path:/, 'no --code: no path rule');

  write(path.join(ROOT, 'ok', 'clean.md'), ['# Ok', '', 'Fine.']);
  r = check([path.join(ROOT, 'ok'), '--code', repo]);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /check-docs: 0 hits/);

  console.log('ALL PASSED');
} finally {
  fs.rmSync(ROOT, { recursive: true, force: true });
}
