'use strict';
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-desc-'));
const data = path.join(root, 'data'), repo = path.join(root, 'repo');
fs.mkdirSync(data); fs.mkdirSync(repo);
process.env.GABRIEL_DATA = data;
fs.writeFileSync(path.join(data, 'projects.json'), JSON.stringify({ version: 1, projects: [{ name: 'demo', root: 'docs', repo }] }));
const dir = path.join(data, 'private', 'demo');
fs.mkdirSync(dir, { recursive: true });
const target = path.join(dir, 'code-desc.json');
fs.writeFileSync(target, JSON.stringify({ AlphaService: 'Already here.' }));
const db = new DatabaseSync(path.join(data, 'mk.db'));
db.exec('CREATE TABLE nodes (kind TEXT, label TEXT, file TEXT, deg INTEGER, project TEXT)');
const insert = db.prepare('INSERT INTO nodes VALUES (?, ?, ?, ?, ?)');
for (const label of ['AlphaService', 'BravoService', 'CharlieService', 'DeltaService', 'EchoService']) {
  const file = label + '.ts';
  fs.writeFileSync(path.join(repo, file), 'export class ' + label + ' {\n  run() {}\n}\n');
  insert.run('code', label, file, 1, 'demo');
}
insert.run('code', 'MissingService', 'missing.ts', 1, 'demo');
db.close();
const { run } = require('../src/tune/code-desc.js');
let calls = 0;
try {
  run({ project: 'demo', batch: 2 }, { callLlm: (prompt) => {
    calls++;
    assert.ok(!prompt.includes('=== AlphaService'));
    if (prompt.includes('=== BravoService')) return JSON.stringify({ BravoService: '  Orders: Creates an order.  ', CharlieService: 'Orders: Checks an order.', Extra: 'Ignore me.' });
    return 'not JSON';
  } });
  assert.strictEqual(calls, 3, 'the failed batch retries once');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(target, 'utf8')), { AlphaService: 'Already here.', BravoService: 'Orders: Creates an order.', CharlieService: 'Orders: Checks an order.' });
  let dryCalls = 0;
  run({ project: 'demo', dryRun: true }, { callLlm: () => { dryCalls++; } });
  assert.strictEqual(dryCalls, 0);
  const labels = path.join(root, 'labels.json');
  fs.writeFileSync(labels, JSON.stringify(['DeltaService']));
  run({ project: 'demo', labels }, { callLlm: () => JSON.stringify({ DeltaService: 'Orders: Saves the order.' }) });
  assert.strictEqual(JSON.parse(fs.readFileSync(target, 'utf8')).DeltaService, 'Orders: Saves the order.');
  // --questions: 3 questions per label go to code-questions.json; a value that is not an array is dropped
  const qLabels = path.join(root, 'q-labels.json');
  fs.writeFileSync(qLabels, JSON.stringify(['DeltaService', 'EchoService']));
  let qPrompt = '';
  run({ project: 'demo', questions: true, labels: qLabels }, { callLlm: (prompt) => {
    qPrompt = prompt;
    return JSON.stringify({ DeltaService: ['a b c d?', 'e f g h?', 'i j k l?'], EchoService: 'not an array' });
  } });
  assert.ok(qPrompt.includes('write 3 short questions'), 'the questions instruction is used');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'code-questions.json'), 'utf8')), { DeltaService: ['a b c d?', 'e f g h?', 'i j k l?'] });
  assert.strictEqual(JSON.parse(fs.readFileSync(target, 'utf8')).DeltaService, 'Orders: Saves the order.', 'description file unchanged');
  console.log('ALL PASSED');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
