'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg-test-'));
process.env.GABRIEL_DATA = DATA;
delete process.env.BRAIN_DATA;
const { debug } = require('../src/debuglog.js');
const file = path.join(DATA, 'debug.log');
try {
  delete process.env.GABRIEL_DEBUG;
  debug('mapFor', new Error('boom'));
  assert.strictEqual(fs.existsSync(file), false, 'off by default: no file');
  process.env.GABRIEL_DEBUG = '1';
  debug('mapFor', new Error('boom'));
  const line = fs.readFileSync(file, 'utf8');
  assert.match(line, /^\d{4}-\d\d-\d\dT[\d:.]+Z mapFor: boom\n$/);
  fs.writeFileSync(file, 'x'.repeat(1024 * 1024 + 1));
  debug('hook', 'plain text');
  assert.ok(fs.statSync(file).size < 1000, 'over 1 MB: the file starts again');
  process.env.GABRIEL_DATA = path.join(DATA, 'missing', '\0bad');
  assert.doesNotThrow(() => debug('hook', new Error('x')), 'a folder that cannot be written never throws');
  console.log('ALL PASSED');
} finally { fs.rmSync(DATA, { recursive: true, force: true }); }
