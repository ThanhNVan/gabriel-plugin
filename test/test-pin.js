'use strict';
// Pin: "gabriel use <name>..." parsing and the per-session pin file. Temp data folder only.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-test-'));
// dataDir(home) resolves to <home>/brain/data for a home other than the real one, so GABRIEL_DATA is set to that same folder.
const HOME = DATA;
process.env.GABRIEL_DATA = path.join(DATA, 'brain', 'data');
delete process.env.BRAIN_DATA;
const { parsePin, getPins, setPins, getMode, setMode, nearName, touchPin, MAX_PINS } = require('../src/pin.js');

const pinFile = (sid) => path.join(process.env.GABRIEL_DATA, 'seen', sid + '.pin');

try {
  assert.deepStrictEqual(parsePin('gabriel use makillez'), { names: ['makillez'] });
  assert.deepStrictEqual(parsePin('gabriel use makillez esg'), { names: ['makillez', 'esg'] });
  assert.deepStrictEqual(parsePin('  Gabriel USE +aipo '), { add: ['aipo'] });
  assert.deepStrictEqual(parsePin('gabriel use +aipo +esg'), { add: ['aipo', 'esg'] });
  assert.deepStrictEqual(parsePin('gabriel use a +b'), { names: ['a', 'b'] });   // C1: mixed sets the list
  assert.deepStrictEqual(parsePin('gabriel use auto'), { auto: true });
  assert.deepStrictEqual(parsePin('gabriel use AUTO'), { auto: true });
  assert.strictEqual(parsePin('gabriel use auto esg'), null);
  assert.deepStrictEqual(parsePin('gabriel use Manual'), { manual: true });
  assert.strictEqual(parsePin('gabriel use manual esg'), null);
  // session mode: null until chosen, then the saved value; a bad id never writes
  assert.strictEqual(getMode(HOME, 'm1'), null);
  assert.strictEqual(setMode(HOME, 'm1', 'manual'), true);
  assert.strictEqual(getMode(HOME, 'm1'), 'manual');
  setMode(HOME, 'm1', 'auto');
  assert.strictEqual(getMode(HOME, 'm1'), 'auto');
  assert.strictEqual(setMode(HOME, '../x', 'manual'), false);
  assert.strictEqual(parsePin('gabriel use'), null);
  assert.deepStrictEqual(parsePin('gabriel use +'), { names: ['+'] }, 'bad word kept raw: the note says it is unknown');
  assert.deepStrictEqual(parsePin('gabriel use ++a'), { names: ['++a'] });
  assert.deepStrictEqual(parsePin('gabriel use ?'), { names: ['?'] });   // one word: command, any non-space word
  assert.deepStrictEqual(parsePin('gabriel use makillez please'), { names: ['makillez', 'please'] });   // shape only; pinNote decides (C1b)
  assert.strictEqual(parsePin('gabriel use the map, then find X'), null, 'punctuation: not a command');
  assert.strictEqual(parsePin('gabriel use a b c d e f g'), null, 'over MAX_PINS + 1 words: not a command');
  assert.strictEqual(parsePin('how do I use gabriel'), null);
  // nearName: a typo of at most 2 letters, and under half the word; the closest name wins
  assert.strictEqual(nearName('mkllez', ['makillez', 'esg']), 'makillez');
  assert.strictEqual(nearName('ESQ', ['makillez', 'esg']), 'esg');
  assert.strictEqual(nearName('nottes', ['notes2', 'notes']), 'notes');
  assert.strictEqual(nearName('apio', ['aipo']), 'aipo', 'two swapped letters count as one typo');
  for (const w of ['docs', 'for', 'this', 'is', 'nope', 'please']) assert.strictEqual(nearName(w, ['makillez', 'esg', 'aipo', 'gabriel', 'notes']), null, w);
  assert.strictEqual(parsePin(undefined), null);
  assert.strictEqual(MAX_PINS, 5);

  assert.strictEqual(setPins(HOME, 's1', ['makillez', 'esg']), true);
  assert.strictEqual(fs.readFileSync(pinFile('s1'), 'utf8'), 'makillez\nesg');
  assert.deepStrictEqual(getPins(HOME, 's1'), ['makillez', 'esg']);
  assert.deepStrictEqual(getPins(HOME, 's2'), []);
  fs.writeFileSync(pinFile('old'), 'makillez');                  // D5: old one-name file
  assert.deepStrictEqual(getPins(HOME, 'old'), ['makillez']);
  fs.writeFileSync(pinFile('crlf'), 'a\r\n\r\n b \r\n');         // Review Focus 4
  assert.deepStrictEqual(getPins(HOME, 'crlf'), ['a', 'b']);
  // a corrupt or hand-edited file: duplicates dropped, at most MAX_PINS names
  fs.writeFileSync(pinFile('big'), 'a\n'.repeat(100000) + 'b\nc\nd\ne\nf\ng\n');
  assert.deepStrictEqual(getPins(HOME, 'big'), ['a', 'b', 'c', 'd', 'e']);
  assert.strictEqual(setPins(HOME, 's1', null), true);
  assert.strictEqual(fs.existsSync(pinFile('s1')), false);
  assert.strictEqual(setPins(HOME, 's1', []), true);
  assert.strictEqual(setPins(HOME, '../x', ['a']), false);
  assert.deepStrictEqual(getPins(HOME, ''), []);

  // touchPin: a pin used now is refreshed (its mtime is the 7-day cleanup clock); no file or a bad id gives false, never a throw
  fs.writeFileSync(pinFile('t1'), 'makillez');
  const old = new Date(Date.now() - 6 * 864e5);
  fs.utimesSync(pinFile('t1'), old, old);
  assert.strictEqual(touchPin(HOME, 't1'), true);
  assert.ok(Math.abs(fs.statSync(pinFile('t1')).mtimeMs - Date.now()) < 5000, 'mtime must be about now');
  assert.strictEqual(touchPin(HOME, 'missing'), false, 'no pin file: false');
  assert.strictEqual(touchPin(HOME, '../x'), false, 'bad session id: false');
  assert.strictEqual(touchPin(HOME, undefined), false, 'no session id: false');

  console.log('ALL PASSED');
} finally {
  fs.rmSync(DATA, { recursive: true, force: true });
}
