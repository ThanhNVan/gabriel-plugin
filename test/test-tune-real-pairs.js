'use strict';
const assert = require('node:assert');
const { realPairs } = require('../src/tune/real-pairs.js');
const { codeText } = require('../src/mk.js');

const pool = [
  { label: 'Alpha', file: 'src/a/Alpha.cs' },
  { label: 'Beta', file: 'src/b/Beta.cs' },
  { label: 'Gamma', file: 'src/c/Gamma.cs' },
];
const searchFn = () => ({ code: null, pool });

// case 1: the answer is in the pool
const r1 = realPairs([{ id: '1', q: 'q1', code: '^Beta$', project: 'x' }], searchFn);
assert.strictEqual(r1.rows.length, 1);
assert.strictEqual(r1.rows[0].q, 'q1');
assert.strictEqual(r1.rows[0].project, 'x');
assert.strictEqual(r1.rows[0].pos, codeText('Beta', 'src/b/Beta.cs'));
assert.deepStrictEqual(r1.rows[0].negs, [codeText('Alpha', 'src/a/Alpha.cs'), codeText('Gamma', 'src/c/Gamma.cs')]);
assert.strictEqual(r1.stats.inPool, 1);

// case 2: the answer is not in the pool, so the target is used
const r2 = realPairs([{ id: '2', q: 'q2', code: '^Delta$', project: 'x', target: { label: 'Delta', file: 'src/d/Delta.cs' } }], searchFn);
assert.strictEqual(r2.rows.length, 1);
assert.strictEqual(r2.rows[0].pos, codeText('Delta', 'src/d/Delta.cs'));
assert.strictEqual(r2.rows[0].negs.length, 3);
assert.strictEqual(r2.stats.notInPool, 1);

// the answer is not in the pool and there is no target: the case is skipped
const r3 = realPairs([{ id: '3', q: 'q3', code: '^Delta$', project: 'x' }], searchFn);
assert.strictEqual(r3.rows.length, 0);
assert.strictEqual(r3.stats.notInPool, 0);

// file regex must match too
const r4 = realPairs([{ id: '4', q: 'q4', code: '^Beta$', file: 'c/Beta', project: 'x' }], searchFn);
assert.strictEqual(r4.rows.length, 0);

// no search result: counted, no row
const r5 = realPairs([{ id: '5', q: 'q5', code: '^Beta$', project: 'x' }], () => null);
assert.strictEqual(r5.rows.length, 0);
assert.strictEqual(r5.stats.noResult, 1);

// the negs option limits the negatives
const r6 = realPairs([{ id: '1', q: 'q1', code: '^Beta$', project: 'x' }], searchFn, { negs: 1 });
assert.strictEqual(r6.rows[0].negs.length, 1);

// stats over several cases
const all = realPairs([
  { id: '1', q: 'q1', code: '^Beta$', project: 'x' },
  { id: '2', q: 'q2', code: '^Delta$', project: 'x', target: { label: 'Delta', file: 'src/d/Delta.cs' } },
  { id: '5', q: 'q5', code: '^Beta$', project: 'x' },
], (c) => (c.id === '5' ? null : { code: null, pool }));
assert.deepStrictEqual(all.stats, { cases: 3, inPool: 1, notInPool: 1, noResult: 1 });
assert.strictEqual(all.rows.length, 2);

// textOf: a custom text function is used for the positive and the negatives
const r7 = realPairs([{ id: '1', q: 'q1', code: '^Beta$', project: 'x' }], searchFn, { textOf: (l) => 'T:' + l });
assert.strictEqual(r7.rows[0].pos, 'T:Beta');
assert.deepStrictEqual(r7.rows[0].negs, ['T:Alpha', 'T:Gamma']);

console.log('ALL PASSED');
