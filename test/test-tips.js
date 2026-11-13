'use strict';
// Tips: one per session, in order, off with "tips": false, none before setup. Temp data folder only.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tips-test-'));
process.env.GABRIEL_DATA = DATA;
delete process.env.BRAIN_DATA;
const { TIPS, tipFor } = require('../src/tips.js');

try {
  assert.strictEqual(tipFor('s1'), '', 'no projects.json yet (before setup): no tip');
  fs.writeFileSync(path.join(DATA, 'projects.json'), JSON.stringify({ version: 1, projects: [] }));
  assert.strictEqual(tipFor('s1'), '💡 Tip: ' + TIPS[0]);
  assert.strictEqual(tipFor('s1'), '', 'one tip per session');
  assert.strictEqual(tipFor('s2'), '💡 Tip: ' + TIPS[1], 'next session: next tip');
  assert.strictEqual(tipFor(''), '', 'no session id: no tip');
  fs.writeFileSync(path.join(DATA, 'tip-index'), String(TIPS.length - 1));
  assert.strictEqual(tipFor('s3'), '💡 Tip: ' + TIPS[TIPS.length - 1]);
  assert.strictEqual(tipFor('s4'), '💡 Tip: ' + TIPS[0], 'starts over after the last tip');
  fs.writeFileSync(path.join(DATA, 'projects.json'), JSON.stringify({ version: 1, projects: [], tips: false }));
  assert.strictEqual(tipFor('s5'), '', 'tips: false turns them off');
  console.log('ALL PASSED');
} finally {
  fs.rmSync(DATA, { recursive: true, force: true });
}
