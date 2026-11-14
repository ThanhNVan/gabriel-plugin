'use strict';
// Tests for src/repo.js checkRepo(): is this folder the code repo of a graph? Temp folders only; git runs in them.
const assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkRepo, defLine, exactLines } = require('../src/repo.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-test-'));
const git = (dir, args) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t', '-c', 'commit.gpgsign=false', ...args], { stdio: 'pipe' });
const writeFiles = (dir, files) => {
  for (const [rel, body] of Object.entries(files)) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); }
  return dir;
};
const writeGraph = (name, obj) => { const f = path.join(tmp, name); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
const headOf = (dir) => execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

try {
  // a git repo with one commit: src/a.js and src/b.js
  const repo = writeFiles(path.join(tmp, 'repo'), { 'src/a.js': 'function a() {}\n', 'src/b.js': 'function b() {}\n' });
  git(repo, ['init', '-q']);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'init']);
  const commit = headOf(repo);

  // 1: both graph files are here (b.js written with a backslash, as Windows graphs do)
  const good = writeGraph('good.json', { built_at_commit: commit, nodes: [
    { id: 'a', label: 'a()', source_file: 'src/a.js' },
    { id: 'b', label: 'b()', source_file: 'src\\b.js' },
  ] });
  assert.deepStrictEqual(checkRepo(repo, good), { ok: true, reason: '', found: 2, sampled: 2, base: '' });

  // 2: a folder that is not a git repo
  const plain = writeFiles(path.join(tmp, 'plain'), { 'src/a.js': 'x\n' });
  const r2 = checkRepo(plain, good);
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.reason, 'not a git repo');

  // 3: the graph commit is not in this repo
  const badCommit = writeGraph('badcommit.json', { built_at_commit: '0'.repeat(40), nodes: [{ id: 'a', label: 'a()', source_file: 'src/a.js' }] });
  const r3 = checkRepo(repo, badCommit);
  assert.strictEqual(r3.ok, false);
  assert.match(r3.reason, /^graph commit 0000000 not in this repo$/);

  // 4: only 1 of 2 graph files are here (0.5 < 0.8)
  const half = writeGraph('half.json', { built_at_commit: commit, nodes: [
    { id: 'a', label: 'a()', source_file: 'src/a.js' },
    { id: 'm', label: 'm()', source_file: 'src/missing.js' },
  ] });
  const r4 = checkRepo(repo, half);
  assert.strictEqual(r4.ok, false);
  assert.strictEqual(r4.reason, 'only 1 of 2 graph files are here');
  assert.strictEqual(r4.found, 1);
  assert.strictEqual(r4.sampled, 2);

  // 5: not a folder at all
  assert.strictEqual(checkRepo(path.join(tmp, 'nope'), good).reason, 'not a folder');

  // 6: src/ base: the graph paths are relative to the repo's src/ folder (Makillez style: Services/X.cs = src/Services/X.cs)
  const srcRepo = writeFiles(path.join(tmp, 'srcrepo'), { 'src/Services/X.cs': 'class X {}\n', 'src/Services/Y.cs': 'class Y {}\n' });
  git(srcRepo, ['init', '-q']);
  git(srcRepo, ['add', '.']);
  git(srcRepo, ['commit', '-q', '-m', 'init']);
  const srcGraph = writeGraph('src.json', { built_at_commit: headOf(srcRepo), nodes: [
    { id: 'x', label: 'X', source_file: 'Services/X.cs' },
    { id: 'y', label: 'Y', source_file: 'Services/Y.cs' },
  ] });
  assert.deepStrictEqual(checkRepo(srcRepo, srcGraph), { ok: true, reason: '', found: 2, sampled: 2, base: 'src' });

  // defLine: the definition beats an earlier call; a whole-word match beats nothing; '$' is escaped
  assert.strictEqual(defLine('const x = searchAll(a);\nfunction searchAll(h) {}', 'searchAll'), 2);
  assert.strictEqual(defLine('public async Task<Result> Handle(X q)\n', 'Handle'), 1);
  assert.strictEqual(defLine('record CreateZoneDto(int A);', 'CreateZoneDto'), 1);
  assert.strictEqual(defLine('nothing here', 'Missing'), 0);
  assert.strictEqual(defLine('x handle2\ny', 'handle'), 0);
  assert.strictEqual(defLine('const $x = 1;\nfunction f() { return $x; }', '$x'), 1);
  assert.strictEqual(defLine('class A {\n  handle(x) {\n  }\n}', 'handle'), 2);
  assert.strictEqual(defLine('const h = (a) => a;\nh(1);', 'h'), 1);

  // exactLines: fixture files (no git needed); 31 small files for the cap, one 2 MB+ file for the size limit
  const fx = writeFiles(path.join(tmp, 'lines'), {
    'src/c.cs': 'using X;\nclass Outer {\n  // Handle is mentioned here\n  public async Task<Result> Handle(X q)\n  {\n  }\n}\n',
    'src/b.js': 'function b() {}\n',
    'src/dollar.js': 'const $x = 1;\n',
    'src/big.js': 'function big() {}\n' + 'x'.repeat(2 * 1024 * 1024),
    ...Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`src/f${i}.js`, `function f${i}() {}\n`])),
  });
  const item = (label, file, loc = 'L99') => ({ n: { label, file, loc } });

  // '.Handle()' label: the C# method line (4), not the comment line above it (3)
  const dot = item('.Handle()', 'src/c.cs');
  exactLines(fx, [dot]);
  assert.deepStrictEqual([dot.n.loc, dot.n.exact], ['L4', true]);

  // backslash path and a different letter case; neighbour-shaped item (no n wrapper)
  const nb = { label: 'b', file: 'src\\B.js', loc: 'L9' };
  exactLines(fx, [nb]);
  assert.deepStrictEqual([nb.loc, nb.exact], ['L1', true]);

  // base 'src': the file path is relative to <repo>/src
  const bs = item('Handle', 'c.cs');
  exactLines(fx, [bs], 'src');
  assert.deepStrictEqual([bs.n.loc, bs.n.exact], ['L4', true]);

  // '$' in the name
  const dl = item('$x', 'src/dollar.js');
  exactLines(fx, [dl]);
  assert.deepStrictEqual([dl.n.loc, dl.n.exact], ['L1', true]);

  // not a plain name: left exactly as it was, no exact key
  const notPlain = item('R33 a code graph must exist', 'src/b.js');
  exactLines(fx, [notPlain]);
  assert.deepStrictEqual(notPlain.n,{ label: 'R33 a code graph must exist', file: 'src/b.js', loc: 'L99' });

  // missing file, and a name that is not in the file: exact false
  const miss = item('b', 'src/nope.js'), notIn = item('zzz', 'src/b.js');
  exactLines(fx, [miss, notIn]);
  assert.deepStrictEqual([miss.n.exact, notIn.n.exact], [false, false]);

  // a file over 2 MB is left alone
  const big = item('big', 'src/big.js', 'L7');
  exactLines(fx, [big]);
  assert.deepStrictEqual([big.n.loc, 'exact' in big.n], ['L7', false]);

  // at most 30 distinct files per call: the 31st is left alone
  const many = Array.from({ length: 31 }, (_, i) => item(`f${i}`, `src/f${i}.js`));
  exactLines(fx, many);
  assert.strictEqual(many.slice(0, 30).every((x) => x.n.exact === true), true);
  assert.strictEqual('exact' in many[30].n, false);

  // bad items never throw
  assert.doesNotThrow(() => exactLines(fx, [null, {}, { n: null }, { n: { label: 'b' } }]));

  // 6a: moved file. src/b.js is now lib/b2.js (committed): the name is found there, with the real line
  const mv = writeFiles(path.join(tmp, 'moved'), { 'lib/b2.js': '// moved\nfunction b() {}\n', 'src/keep.js': 'x\n' });
  git(mv, ['init', '-q']);
  git(mv, ['add', '.']);
  git(mv, ['commit', '-q', '-m', 'init']);
  const mvItem = item('b', 'src/b.js');
  exactLines(mv, [mvItem]);
  assert.deepStrictEqual([mvItem.n.file, mvItem.n.loc, mvItem.n.exact, mvItem.n.moved], ['lib/b2.js', 'L2', true, true]);

  // a name that exists nowhere: exact false, not moved
  const nowhere = item('zzzNope', 'src/old.js');
  exactLines(mv, [nowhere]);
  assert.deepStrictEqual([nowhere.n.exact, 'moved' in nowhere.n], [false, false]);

  // a file that is missing and not a git repo: exact false, no throw
  const notGit = item('a', 'src/gone.js');
  exactLines(plain, [notGit]);
  assert.strictEqual(notGit.n.exact, false);

  // the same name in two files: the one with the old basename (lib/b.js) wins over aaa/first.js
  const pref = writeFiles(path.join(tmp, 'pref'), { 'aaa/first.js': 'function b() {}\n', 'lib/b.js': '\n\nfunction b() {}\n' });
  git(pref, ['init', '-q']);
  git(pref, ['add', '.']);
  git(pref, ['commit', '-q', '-m', 'init']);
  const prefItem = item('b', 'src/b.js');
  exactLines(pref, [prefItem]);
  assert.deepStrictEqual([prefItem.n.file, prefItem.n.loc], ['lib/b.js', 'L3']);

  // base 'src': the new path is given relative to <repo>/src
  const srcMv = writeFiles(path.join(tmp, 'srcmoved'), { 'src/lib/b2.js': 'function b() {}\n' });
  git(srcMv, ['init', '-q']);
  git(srcMv, ['add', '.']);
  git(srcMv, ['commit', '-q', '-m', 'init']);
  const srcMvItem = item('b', 'b.js');
  exactLines(srcMv, [srcMvItem], 'src');
  assert.deepStrictEqual([srcMvItem.n.file, srcMvItem.n.loc, srcMvItem.n.moved], ['lib/b2.js', 'L1', true]);

  // at most 2 lookups per call: the third missing file is not looked up
  const three = [item('b', 'src/p1.js'), item('b', 'src/p2.js'), item('b', 'src/p3.js')];
  exactLines(mv, three);
  assert.deepStrictEqual(three.map((x) => x.n.exact), [true, true, false]);

  console.log('ALL PASSED');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
