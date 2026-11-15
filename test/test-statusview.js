'use strict';
const assert = require('node:assert');
const { statusBlock } = require('../src/statusview.js');
const built = Date.UTC(2026, 10, 14, 9, 12);
assert.deepStrictEqual(statusBlock({ label: 'Alpha', name: 'alpha', s: { nCode: 12, nDoc: 34, built, mapCommit: 'f59545cd1234', stale: false }, graphPath: '/x/graphify-out/graph.json', graphExists: true, repo: '/x/code', repoExists: true, fix: null }), [
  'Alpha  ok',
  '  map    12 code + 34 doc neurons, built 2026-11-14 09:12, @f59545cd',
  '  graph  /x/graphify-out/graph.json',
  '  repo   /x/code',
]);
assert.deepStrictEqual(statusBlock({ label: 'Notes', name: 'notes', s: { stale: false }, graphPath: null, graphExists: false, repo: null, repoExists: false, fix: 'node src/brain.js build-mk notes' }), [
  'Notes  no map',
  '  fix: node src/brain.js build-mk notes',
]);
const gone = statusBlock({ label: 'B', name: 'b', s: { nCode: 1, nDoc: 2, built, stale: true }, graphPath: '/g.json', graphExists: false, repo: null, repoExists: false, fix: 'x' });
assert.strictEqual(gone[0], 'B  GRAPH MISSING');
assert.ok(gone.includes('  graph  /g.json   GRAPH MISSING'));
assert.ok(gone.includes('  repo   none (add-docs b --repo <folder> --relink)'));
assert.ok(!gone.join('\n').includes('undefined'));
assert.deepStrictEqual(statusBlock({ label: 'Alpha', name: 'alpha', s: { nCode: 1, nDoc: 2, built, stale: false }, graphPath: '/g.json', graphExists: true, repo: '/code', repoExists: true, fix: null, drift: { commits: 3, changed: 12 } }).slice(3), [
  '  repo   /code',
  '  drift  3 commits behind, 12 code files changed',
]);
assert.deepStrictEqual(statusBlock({ label: 'A', name: 'a', s: { nCode: 1, nDoc: 2, built, stale: false }, graphPath: null, graphExists: false, repo: '/code', repoExists: true, fix: null, drift: { commits: 0, changed: 0, docsBehindDays: 9.4 } }).slice(-1), [
  '  drift  docs 9 days behind',
]);
assert.deepStrictEqual(statusBlock({ label: 'A', name: 'a', s: { nCode: 1, nDoc: 2, built, stale: false }, graphPath: null, graphExists: false, repo: '/code', repoExists: true, fix: null, drift: { commits: null, changed: null, docsBehindDays: 3 } }).some((l) => l.includes('drift')), false, 'docs under 7 days and no graph drift: no drift line');
console.log('ALL PASSED');
