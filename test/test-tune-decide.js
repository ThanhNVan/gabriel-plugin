'use strict';
// Pure test of the keep rule in src/tune/tune.js decide(): the code total (exact + chain cases) must not fall.
// No files, no models, no child processes.
const assert = require('node:assert');
const { decide } = require('../src/tune/tune.js');

const held = { makillez: { n: 10, t: 20 } };
const heldUp = { makillez: { n: 12, t: 20 } };
const full = { makillez: { n: 50, t: 60 } };
const fullUp = { makillez: { n: 51, t: 60 } };
const quiet = { makillez: { n: 30, t: 31 } };

// 1: code total fell, everything else wins -> not kept, reason named
{
  const base = { held, full, quiet, code: { makillez: { n: 60, t: 100 } } };
  const tuned = { held: heldUp, full: fullUp, quiet, code: { makillez: { n: 55, t: 100 } } };
  const d = decide(base, tuned);
  assert.strictEqual(d.keep, false);
  assert.ok(d.reasons.includes('code total fell (60 -> 55)'), `reasons: ${d.reasons.join('; ')}`);
  console.log('  ok: code total fell -> keep false, reason named');
}

// 2: no code key on either side -> same as today (kept when doc numbers win)
{
  const d = decide({ held, full, quiet }, { held: heldUp, full: fullUp, quiet });
  assert.strictEqual(d.keep, true, `reasons: ${(d.reasons || []).join('; ')}`);
  console.log('  ok: no code scores -> keep true, as before');
}

// 3: code total rose -> kept
{
  const base = { held, full, quiet, code: { makillez: { n: 60, t: 100 } } };
  const tuned = { held: heldUp, full: fullUp, quiet, code: { makillez: { n: 66, t: 100 } } };
  const d = decide(base, tuned);
  assert.strictEqual(d.keep, true, `reasons: ${d.reasons.join('; ')}`);
  console.log('  ok: code total rose -> keep true');
}

// 4: --no-keep is read; --no-keep with --force is refused (they contradict)
{
  const { parseArgs } = require('../src/tune/tune.js');
  assert.strictEqual(parseArgs(['--no-keep']).noKeep, true);
  assert.strictEqual(parseArgs([]).noKeep, false);
  assert.throws(() => parseArgs(['--no-keep', '--force']), /--no-keep and --force/);
  console.log('  ok: parseArgs reads --no-keep');
}

console.log('ALL PASSED');
