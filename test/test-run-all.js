'use strict';
// Checks the pure helpers in test/run-all.js: a skip line gives SKIP, and the summary counts skips.
const assert = require('node:assert');
const { statusOf, summaryLine } = require('./run-all.js');

const MERMAID = 'mermaid check skipped (dev packages missing: run npm install)';
const LINT = 'lint skipped (dev package eslint missing: run npm install)';

// a skip line with exit 0 is SKIP, and keeps the skip line as the reason
assert.deepStrictEqual(statusOf(MERMAID + '\n', 0), { status: 'SKIP', reason: MERMAID });
assert.deepStrictEqual(statusOf('some output\n' + LINT + '\n', 0), { status: 'SKIP', reason: LINT });

// a normal pass and a failure keep their status
assert.strictEqual(statusOf('all good\n', 0).status, 'PASS');
assert.strictEqual(statusOf('pdf skipped (pdfjs-dist missing)\nALL PASSED\n', 0).status, 'PASS', 'a skipped part followed by passing checks is a PASS');
assert.strictEqual(statusOf('boom\n', 1).status, 'FAIL');
assert.strictEqual(statusOf(MERMAID, 1).status, 'FAIL');

// the summary counts skips only when there are some
assert.strictEqual(summaryLine(0, 0), 'all checks passed');
assert.strictEqual(summaryLine(0, 1), 'all checks passed (1 skipped)');
assert.strictEqual(summaryLine(0, 2), 'all checks passed (2 skipped)');
assert.strictEqual(summaryLine(1, 1), '1 check(s) failed');

console.log('run-all status and summary: ok');
