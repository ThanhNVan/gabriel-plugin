'use strict';
// Graph check: a clean graph built at HEAD passes; a graph with a dangling link, an excluded node and an old commit fails. Temp folders only.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const STATS = path.resolve(__dirname, '..', 'tools', 'graph-stats.js');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-stats-test-'));

function git(repo, args) {
  // A fixed commit identity through the environment, so the test does not depend on the machine's git config.
  const env = { ...process.env, GIT_AUTHOR_NAME: 'test', GIT_COMMITTER_NAME: 'test', GIT_AUTHOR_EMAIL: '', GIT_COMMITTER_EMAIL: '' };
  const r = spawnSync('git', ['-C', repo, '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', env });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout.trim();
}

function stats(args) {
  return spawnSync(process.execPath, [STATS, ...args], { encoding: 'utf8' });
}

try {
  const repo = path.join(ROOT, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q']);
  git(repo, ['commit', '-q', '--allow-empty', '-m', 'init']);
  const head = git(repo, ['rev-parse', 'HEAD']);

  const good = path.join(ROOT, 'good.json');
  fs.writeFileSync(good, JSON.stringify({
    built_at_commit: head,
    nodes: [{ id: 'a', source_file: 'src/a.js', community: 0 }, { id: 'b', source_file: 'src\\b.js', community: 1 }],
    links: [{ source: 'a', target: 'b' }],
  }));

  let r = stats([good, '--repo', repo]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(r.stdout.trim().split('\n'), [
    'nodes 2',
    'links 1',
    'communities 2',
    `built_at_commit ${head}`,
    'graph-stats: 0 hits',
  ]);

  // Dangling link to ghost, a node under private/, and a graph built at an old commit.
  const bad = path.join(ROOT, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({
    built_at_commit: 'deadbeef',
    nodes: [{ id: 'a', source_file: 'src/a.js' }, { id: 'p', source_file: 'private\\x.js' }],
    edges: [{ source: 'a', target: 'ghost' }],
  }));

  r = stats([bad, '--repo', repo]);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.deepStrictEqual(r.stdout.trim().split('\n'), [
    'nodes 2',
    'links 1',
    'built_at_commit deadbeef',
    'dangling link: a -> ghost',
    'excluded node: p private/x.js',
    `commit mismatch: graph deadbeef head ${head}`,
    'graph-stats: 3 hits',
  ]);

  console.log('ALL PASSED');
} finally {
  fs.rmSync(ROOT, { recursive: true, force: true });
}
