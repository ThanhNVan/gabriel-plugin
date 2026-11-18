'use strict';
const assert = require('node:assert');
const { rerankPairs, scenarioAnchors } = require('../src/tune/rerank-pairs.js');
const { codeText } = require('../src/mk.js');
const { mulberry32 } = require('../src/tune/export-pairs.js');
const R = (label, dir) => ({ label, file: `Services/X/X.Application/Commands/${dir}/${label}.cs` });
const rows = [R('CreateCompanyCommandHandler', 'Company/Create'), R('UpdateCompanyCommandHandler', 'Company/Update'),
  R('DeleteCompanyCommandHandler', 'Company/Delete'), R('CreateVesselCommandHandler', 'Vessel/Create'), R('OnVesselCreated', 'Vessel/Events')];
const out = rerankPairs(rows, { seed: 42, negs: 3 });
assert.ok(out.length > 0);
for (const p of out) {
  assert.strictEqual(p.negs.length, 3);
  assert.ok(!p.negs.includes(p.pos), 'positive is never a negative');
  assert.strictEqual(new Set(p.negs).size, 3, 'no repeated negative');
}
const c = out.find((p) => p.pos === codeText(rows[0].label, rows[0].file));
assert.ok(c.negs.some((n) => n.startsWith('update company') || n.startsWith('delete company')), 'hard negative shares a name word: ' + c.negs.join(' | '));
assert.deepStrictEqual(rerankPairs(rows, { seed: 42, negs: 3 }), out, 'same seed, same output');
assert.ok(!rerankPairs(rows, { seed: 42, negs: 3, skip: new Set([out[0].q]) }).some((p) => p.q === out[0].q), 'skip list removes a question');
// scenario questions: long debug/change/workflow/explain text built from the name words and the folders
const sc = scenarioAnchors('.collect_metrics()', 'aipo/metrics/collect.py', mulberry32(42), 2);
assert.strictEqual(sc.length, 2);
for (const q of sc) assert.ok(q.includes('collect metrics'), 'scenario question names the subject: ' + q);
assert.deepStrictEqual(scenarioAnchors('.collect_metrics()', 'aipo/metrics/collect.py', mulberry32(42), 2), sc, 'same seed, same scenario questions');
assert.deepStrictEqual(scenarioAnchors('CreateCompanyCommandHandler', 'Services/Company/Create.cs', mulberry32(1), 2).length, 2);
// a method row (no class name) gets pairs too
const mrows = [{ label: 'distance()', file: 'src/geo.js' }, rows[0]];
const mp = rerankPairs(mrows, { seed: 42, negs: 3 });
const mine = mp.filter((p) => p.pos === codeText('distance()', 'src/geo.js'));
assert.ok(mine.length > 0, 'method row gets pairs');
for (const p of mine) assert.ok(p.q.includes('distance'), 'method question names the method: ' + p.q);
// hardOf labels come first in negs
const hard = rerankPairs(rows, { seed: 42, negs: 3, hardOf: () => ['UpdateCompanyCommandHandler'] });
const cpairs = hard.filter((p) => p.pos === codeText(rows[0].label, rows[0].file));
assert.ok(cpairs.length > 0);
for (const p of cpairs) assert.strictEqual(p.negs[0], codeText(rows[1].label, rows[1].file), 'hardOf negative first');
assert.deepStrictEqual(rerankPairs(rows, { seed: 42, negs: 3, hardOf: () => ['UpdateCompanyCommandHandler'] }), hard, 'hardOf: same seed, same output');
console.log('ALL PASSED');
