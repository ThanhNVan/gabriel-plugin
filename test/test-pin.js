'use strict';
// Pin: "gabriel use <name>" parsing and the per-session pin file. Temp data folder only.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-test-'));
// dataDir(home) resolves to <home>/brain/data for a home other than the real one, so GABRIEL_DATA is set to that same folder.
const HOME = DATA;
process.env.GABRIEL_DATA = path.join(DATA, 'brain', 'data');
delete process.env.BRAIN_DATA;
const { parsePin, getPin, setPin } = require('../src/pin.js');

try {
  assert.deepStrictEqual(parsePin('gabriel use makillez'), { name: 'makillez' });
  assert.deepStrictEqual(parsePin('  Gabriel USE esg '), { name: 'esg' });
  assert.deepStrictEqual(parsePin('gabriel use auto'), { auto: true });
  assert.deepStrictEqual(parsePin('gabriel use AUTO'), { auto: true });
  assert.deepStrictEqual(parsePin('gabriel use ?'), { name: '?' });
  assert.strictEqual(parsePin('gabriel use makillez please'), null);
  assert.strictEqual(parsePin('how do I use gabriel'), null);
  assert.strictEqual(parsePin(undefined), null);

  assert.strictEqual(setPin(HOME, 's1', 'makillez'), true);
  assert.strictEqual(fs.readFileSync(path.join(process.env.GABRIEL_DATA, 'seen', 's1.pin'), 'utf8'), 'makillez');
  assert.strictEqual(getPin(HOME, 's1'), 'makillez');
  assert.strictEqual(getPin(HOME, 's2'), null, 'other session: no pin');

  assert.strictEqual(setPin(HOME, 's1', null), true);
  assert.strictEqual(getPin(HOME, 's1'), null);
  assert.strictEqual(fs.existsSync(path.join(process.env.GABRIEL_DATA, 'seen', 's1.pin')), false);

  assert.strictEqual(setPin(HOME, '../x', 'a'), false, 'bad session id: nothing written');
  assert.strictEqual(getPin(HOME, ''), null, 'empty session id: no pin');
  console.log('ALL PASSED');
} finally {
  fs.rmSync(DATA, { recursive: true, force: true });
}
