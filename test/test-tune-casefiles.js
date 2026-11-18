'use strict';
// The code case files: one list, used both to score the code total (tune.js) and to keep their questions out of training (export-pairs.js).
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { CODE_CASE_FILES, CASE_FILES } = require('../src/tune/export-pairs.js');
assert.deepStrictEqual(CODE_CASE_FILES, ['eval-cases-exact.json', 'eval-cases-chain.json', 'eval-cases-scenario.json', 'eval-cases-written.json']);
for (const f of CODE_CASE_FILES) assert.ok(CASE_FILES.includes(f), f + ' questions must be kept out of training');
assert.ok(CASE_FILES.includes('eval-cases.json'));

// a project with only a scenario file still takes part (code score only); one with no case file does not
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'gtest-casefiles-'));
process.env.GABRIEL_DATA = data;
const { caseFilesOf } = require('../src/tune/tune.js');
const mkp = (n, files) => { const d = path.join(data, 'private', n); fs.mkdirSync(d, { recursive: true }); for (const f of files) fs.writeFileSync(path.join(d, f), '[]'); };
mkp('alpha', ['eval-cases.json', 'eval-cases-exact.json']);
mkp('beta', ['eval-cases-scenario.json']);
mkp('gamma', []);
assert.deepStrictEqual(caseFilesOf('alpha'), { main: true, code: [path.join(data, 'private', 'alpha', 'eval-cases-exact.json')] });
assert.deepStrictEqual(caseFilesOf('beta'), { main: false, code: [path.join(data, 'private', 'beta', 'eval-cases-scenario.json')] });
assert.deepStrictEqual(caseFilesOf('gamma'), { main: false, code: [] });
fs.rmSync(data, { recursive: true, force: true });
console.log('ALL PASSED');