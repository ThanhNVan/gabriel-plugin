'use strict';
// Tests for tools/check-public.js. Run: node test/test-check-public.js
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'tools', 'check-public.js');
const made = [];

function mkTmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

// Joins pieces at run time, so the fixtures do not trip the scanner when it scans this file.
const J = (...parts) => parts.join('');

function makeTree(files) {
  const root = mkTmp('check-public-tree-');
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function run(root, args, words, data) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GABRIEL_DATA: data, BRAIN_DATA: '' },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function main() {
  const dataDir = mkTmp('check-public-data-');
  const wordsDir = mkTmp('check-public-words-');
  const words = path.join(wordsDir, 'privacy-words.txt'); // outside every tree under test
  fs.writeFileSync(words, '# owner words\n\nZorblax\n');
  const scan = (root) => run(root, ['--words', words], words, dataDir);
  const missing = path.join(wordsDir, 'no-such-list.txt');

  // word list: case-insensitive, whole word
  let r = scan(makeTree({ 'a.js': "const x = 'Zorblax';\n" }));
  assert.strictEqual(r.status, 1, r.out);
  assert.ok(r.out.includes('a.js:1: word "Zorblax"'), r.out);

  r = scan(makeTree({ 'a.js': 'zorblaxy\n' }));
  assert.strictEqual(r.status, 0, r.out);

  r = scan(makeTree({ 'a.js': 'ZORBLAX\n' }));
  assert.strictEqual(r.status, 1, r.out);
  assert.ok(r.out.includes('a.js:1: word "Zorblax"'), r.out);

  // email; noreply is allowed
  r = scan(makeTree({ 'b.md': J('someone', '@example.org') + '\n' }));
  assert.strictEqual(r.status, 1, r.out);
  assert.ok(r.out.includes('b.md:1: email'), r.out);

  r = scan(makeTree({ 'b.md': J('noreply', '@github.com') + '\n' }));
  assert.strictEqual(r.status, 0, r.out);

  // IPv4; loopback and any-address are allowed
  const ip = ['10', '20', '30', '40'].join('.');
  r = scan(makeTree({ 'c.txt': ip + '\n' }));
  assert.strictEqual(r.status, 1, r.out);
  assert.ok(r.out.includes('c.txt:1: ip'), r.out);

  r = scan(makeTree({ 'c.txt': '127.0.0.1\n0.0.0.0\n' }));
  assert.strictEqual(r.status, 0, r.out);

  // secrets
  const secrets = [
    J('api_', 'key = abcdefgh12345'),
    J('pass', 'word: hunter2'),
    J('-----', 'BEGIN PRIVATE KEY-----'),
  ].join('\n') + '\n';
  r = scan(makeTree({ 'd.js': secrets }));
  assert.strictEqual(r.status, 1, r.out);
  for (const n of [1, 2, 3]) {
    assert.ok(r.out.includes(`d.js:${n}: secret`), r.out);
  }

  // user paths; a placeholder user is allowed
  const userPaths = [
    J('C:', '\\Users\\alice\\x'),
    ['', 'home', 'bob', 'x'].join('/'),
    ['', 'Users', 'carol', 'x'].join('/'),
  ].join('\n') + '\n';
  r = scan(makeTree({ 'e.md': userPaths }));
  assert.strictEqual(r.status, 1, r.out);
  for (const n of [1, 2, 3]) {
    assert.ok(r.out.includes(`e.md:${n}: user path`), r.out);
  }

  r = scan(makeTree({ 'e.md': J('C:', '\\Users\\<user>\\x') + '\n' }));
  assert.strictEqual(r.status, 0, r.out);

  // binary file (NUL byte in first 8 KB) is skipped
  r = scan(makeTree({ 'bin.dat': Buffer.concat([Buffer.from([0]), Buffer.from('Zorblax\n')]) }));
  assert.strictEqual(r.status, 0, r.out);

  // node_modules/ and private/ are skipped
  r = scan(makeTree({
    'node_modules/pkg/x.js': 'Zorblax\n',
    'private/x.txt': 'Zorblax\n' + J('someone', '@example.org') + '\n',
  }));
  assert.strictEqual(r.status, 0, r.out);

  // clean tree
  r = scan(makeTree({ 'ok.js': 'const x = 1;\n' }));
  assert.strictEqual(r.status, 0, r.out);
  assert.ok(r.out.includes('privacy scan: 0 hits'), r.out);

  // missing word list
  r = run(makeTree({ 'ok.js': 'const x = 1;\n' }), ['--words', missing], missing, dataDir);
  assert.strictEqual(r.status, 0, r.out);
  assert.ok(r.out.includes('word list not found, words skipped'), r.out);
  assert.ok(r.out.includes('privacy scan: 0 hits'), r.out);

  r = run(makeTree({ 'x.md': J('someone', '@example.org') + '\n' }), ['--words', missing], missing, dataDir);
  assert.strictEqual(r.status, 1, r.out);
  assert.ok(r.out.includes('x.md:1: email'), r.out);

  r = run(makeTree({ 'ok.js': 'const x = 1;\n' }), ['--words', missing, '--release'], missing, dataDir);
  assert.strictEqual(r.status, 2, r.out);
  assert.ok(r.out.includes('word list required'), r.out);

  // git mode: untracked files are scanned, ignored files are not
  const gitTree = makeTree({
    '.gitignore': 'ignored.js\n',
    'ignored.js': 'Zorblax\n',
    'new.js': 'const x = "Zorblax";\n',
  });
  spawnSync('git', ['-C', gitTree, 'init', '-q'], { encoding: 'utf8' });
  r = scan(gitTree);
  assert.strictEqual(r.status, 1, r.out);
  assert.ok(r.out.includes('new.js:1: word "Zorblax"'), r.out);
  assert.ok(!r.out.includes('ignored.js'), r.out);

  // git mode: a tracked private/ file fails the scan (throwaway repo only)
  const privTree = makeTree({ 'private/x.txt': 'hello\n' });
  spawnSync('git', ['-C', privTree, 'init', '-q'], { encoding: 'utf8' });
  spawnSync('git', ['-C', privTree, 'add', '-f', 'private/x.txt'], { encoding: 'utf8' });
  r = scan(privTree);
  assert.strictEqual(r.status, 1, r.out);
  assert.ok(r.out.includes('private/ file is tracked: private/x.txt'), r.out);

  console.log('ALL PASSED');
}

try {
  main();
} finally {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
}
