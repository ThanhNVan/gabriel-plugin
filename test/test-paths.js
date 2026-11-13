const assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');

// A temp home: os.homedir() reads HOME / USERPROFILE on each call, so the real home is never checked.
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'paths-home-'));
process.on('exit', () => fs.rmSync(tmpHome, { recursive: true, force: true }));
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const load = (env) => {
  for (const k of ['GABRIEL_DATA', 'BRAIN_DATA', 'BRAIN_HOME', 'GABRIEL_HOST', 'CODEX_HOME', 'GABRIEL_RULES_HOME']) delete process.env[k];
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../src/paths.js')];
  return require('../src/paths.js');
};

// 1: new install: no old folder, so the data folder is ~/.gabriel; the rules folder is ~/.claude
let p = load({});
assert.strictEqual(p.dataDir(), path.join(tmpHome, '.gabriel'));
assert.strictEqual(p.rulesHome(), path.join(tmpHome, '.claude'));
assert.strictEqual(p.modelsDir(), path.join(p.dataDir(), 'models'));
assert.strictEqual(p.docsDir('notes'), path.join(p.dataDir(), 'docs', 'notes'));
assert.strictEqual(p.privateDir('notes'), path.join(p.dataDir(), 'private', 'notes'));
assert.strictEqual(p.projectsFile(), path.join(p.dataDir(), 'projects.json'));
assert.strictEqual(p.pluginRoot(), path.resolve(__dirname, '..'));
assert.deepStrictEqual(p.defaultRuleFiles(), ['CLAUDE.md']);

// 2: old installs: ~/.claude/gabriel-data is still used when it exists
const old = path.join(tmpHome, '.claude', 'gabriel-data');
fs.mkdirSync(old, { recursive: true });
p = load({});
assert.strictEqual(p.dataDir(), old);
fs.rmSync(path.join(tmpHome, '.claude'), { recursive: true, force: true });

// 3: env wins: GABRIEL_DATA, then BRAIN_DATA; BRAIN_HOME sets the claude rules folder
p = load({ GABRIEL_DATA: '/tmp/gd', BRAIN_DATA: '/tmp/bd', BRAIN_HOME: '/tmp/home' });
assert.strictEqual(p.dataDir(), path.resolve('/tmp/gd'));
assert.strictEqual(p.rulesHome(), path.resolve('/tmp/home'));
p = load({ BRAIN_DATA: '/tmp/bd' });
assert.strictEqual(p.dataDir(), path.resolve('/tmp/bd'));

// 4: hosts: GABRIEL_HOST picks the adapter; setHost() beats the env; each host has its own rules folder and default file
p = load({ GABRIEL_HOST: 'codex', CODEX_HOME: '/tmp/cx' });
assert.strictEqual(p.activeHost(), 'codex');
assert.strictEqual(p.rulesHome(), path.resolve('/tmp/cx'));
assert.deepStrictEqual(p.defaultRuleFiles(), ['AGENTS.md']);
assert.strictEqual(p.contextFile(), 'AGENTS.md');
p = load({});
assert.strictEqual(p.setHost('gemini'), 'gemini');
assert.strictEqual(p.rulesHome(), path.join(tmpHome, '.gemini'));
assert.deepStrictEqual(p.defaultRuleFiles(), ['GEMINI.md']);
assert.throws(() => p.setHost('nope'), /unknown host: nope/);
assert.strictEqual(p.setHost('claude'), 'claude');

// 5: names are checked
assert.throws(() => p.docsDir('../x'), /bad project name/);
assert.throws(() => p.privateDir('A B'), /bad project name/);
console.log('ALL PASSED');
