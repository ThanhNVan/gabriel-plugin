const assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-')); delete process.env.BRAIN_DATA; process.env.GABRIEL_DATA = dir;
const P = () => { for (const m of ['../src/paths.js', '../src/projects.js']) delete require.cache[require.resolve(m)]; return require('../src/projects.js'); };
const W = (j) => fs.writeFileSync(path.join(dir, 'projects.json'), JSON.stringify(j));
// 1: no file -> one project per folder under docs/, defaults applied, no legacy tag, default rule files
fs.mkdirSync(path.join(dir, 'docs', 'recipes'), { recursive: true });
let ps = P().loadProjects();
assert.deepStrictEqual(ps.map((p) => p.name), ['recipes']);
assert.strictEqual(ps[0].root, path.join(dir, 'docs', 'recipes'));
assert.strictEqual(ps[0].layout, 'auto'); assert.strictEqual(ps[0].graph, null); assert.strictEqual(ps[0].learn, true);
assert.strictEqual(ps[0].rank, path.join(dir, 'private', 'recipes', 'rank.json'));
assert.strictEqual(ps[0].coreDocs, null);
assert.strictEqual(P().loadConfig().legacyProject, null);
assert.deepStrictEqual(P().loadConfig().ruleFiles, ['CLAUDE.md']);
// 2: file wins; file ORDER is kept (no sort); ~ and relative roots resolve; rootEnv value is used raw; rank path may point at another project
W({ version: 1, legacyProject: 'zeta', ruleFiles: ['CLAUDE.md', 'extra.md'], projects: [
  { name: 'zeta', root: '~/x', coreDocs: '^(01-a|02-b)$' }, { name: 'b', root: 'docs/b', rootEnv: 'B_DOCS', rank: 'private/zeta/rank.json' }, { name: 'a', root: 'corpus/t', fallback: true } ] });
process.env.B_DOCS = 'rel/elsewhere';
ps = P().loadProjects();
assert.deepStrictEqual(ps.map((p) => p.name), ['zeta', 'b', 'a']);
assert.strictEqual(ps[0].root, path.join(os.homedir(), 'x'));
assert.strictEqual(ps[1].root, 'rel/elsewhere');
assert.strictEqual(ps[1].rank, path.join(dir, 'private', 'zeta', 'rank.json'));
assert.strictEqual(ps[0].coreDocs, '^(01-a|02-b)$');
assert.strictEqual(P().getProject('a').fallback, true);
assert.strictEqual(P().getProject('nope'), undefined);
assert.deepStrictEqual(P().projectNames(), ['zeta', 'b', 'a']);
assert.strictEqual(P().loadConfig().legacyProject, 'zeta');
assert.deepStrictEqual(P().loadConfig().ruleFiles, ['CLAUDE.md', 'extra.md']);
delete process.env.B_DOCS;
// 3: bad name, duplicate, bad legacy tag -> clear error
W({ version: 1, projects: [{ name: '../x', root: 'a' }] }); assert.throws(() => P().loadProjects(), /bad project name/);
W({ version: 1, projects: [{ name: 'a', root: 'a' }, { name: 'a', root: 'b' }] }); assert.throws(() => P().loadProjects(), /duplicate project/);
W({ version: 1, legacyProject: 'gone', projects: [{ name: 'a', root: 'a' }] }); assert.throws(() => P().loadProjects(), /legacyProject gone/);
// 4: unknown version -> error naming the version
W({ version: 9, projects: [] }); assert.throws(() => P().loadProjects(), /projects.json version 9/);
// 5: empty list -> []
W({ version: 1, projects: [] }); assert.deepStrictEqual(P().loadProjects(), []);
// 6: cache: same mtime -> same array object; rewrite -> new data
W({ version: 1, projects: [{ name: 'a', root: 'a' }] }); const m = P(); const x1 = m.loadProjects(); assert.strictEqual(m.loadProjects(), x1);
const later = new Date(Date.now() + 5000); W({ version: 1, projects: [{ name: 'c', root: 'c' }] }); fs.utimesSync(path.join(dir, 'projects.json'), later, later);
assert.deepStrictEqual(m.loadProjects().map((p) => p.name), ['c']);
fs.rmSync(dir, { recursive: true, force: true });
console.log('ALL PASSED');
