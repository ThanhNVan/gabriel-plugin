// Tests for `node src/setup.js --host <name>` and `--remove-host <name> --apply`. Temp HOME and USERPROFILE: the real ~/.codex and ~/.gemini are never touched.
const assert = require('node:assert'), crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SETUP = path.join(ROOT, 'src', 'setup.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-hosts-test-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const home = path.join(tmp, 'home');
const codexFile = path.join(home, '.codex', 'hooks.json'), geminiFile = path.join(home, '.gemini', 'settings.json');
const env = { ...process.env, HOME: home, USERPROFILE: home, GABRIEL_SETUP_NO_MIGRATE: '1' };
delete env.CODEX_HOME; delete env.BRAIN_HOME; delete env.GABRIEL_HOST;
const run = (args) => spawnSync(process.execPath, [SETUP, ...args], { cwd: ROOT, env, encoding: 'utf8', timeout: 120000 });
const text = (r) => `${r.stdout || ''}${r.stderr || ''}`;
const hash = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : 'no file');
const backups = (f) => fs.readdirSync(path.dirname(f)).filter((n) => n.startsWith(path.basename(f) + '.gabriel-backup-'));
const write = (f, obj) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)); };
const gabrielCommands = (cfg) => Object.values(cfg.hooks || {}).flat().flatMap((g) => g.hooks || []).map((h) => h.command).filter((c) => /brain\.js/.test(c));

// fixture: codex already has one hook of its own and a setting that must survive
const otherCodex = { model: 'kept', hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'echo other-tool', timeout: 10 }] }] } };
write(codexFile, otherCodex);
const originalHash = hash(codexFile);

// 1: dry run prints the config and writes nothing
{
  const r = run(['--host', 'codex']);
  assert.strictEqual(r.status, 0, text(r));
  assert.match(r.stdout, /hook config gabriel adds/);
  assert.match(r.stdout, /hook --host codex/);
  assert.match(r.stdout, /not written yet/);
  assert.strictEqual(hash(codexFile), originalHash, 'dry run must not change the file');
  assert.strictEqual(backups(codexFile).length, 0);
  console.log('codex dry run: config printed, file unchanged');
}

// 2: apply merges: the other hook and the setting stay, gabriel adds its two events, a backup is made
{
  const r = run(['--host', 'codex', '--apply']);
  assert.strictEqual(r.status, 0, text(r));
  const cfg = JSON.parse(fs.readFileSync(codexFile, 'utf8'));
  assert.strictEqual(cfg.model, 'kept', 'other settings kept');
  assert.strictEqual(cfg.hooks.UserPromptSubmit[0].hooks[0].command, 'echo other-tool', 'other hook kept, first');
  assert.strictEqual(cfg.hooks.UserPromptSubmit.length, 2);
  assert.ok(cfg.hooks.PostToolUse, 'PostToolUse added');
  const cmds = gabrielCommands(cfg);
  assert.ok(cmds.some((c) => /brain\.js" hook --host codex( --data "[^"]+")?$/.test(c)), cmds.join(' | '));
  assert.ok(cmds.some((c) => /brain\.js" touched --host codex( --data "[^"]+")?$/.test(c)), cmds.join(' | '));
  assert.strictEqual(cfg.hooks.UserPromptSubmit[1].hooks[0].timeout, 60, 'codex timeouts are seconds');
  const bk = backups(codexFile);
  assert.strictEqual(bk.length, 1, 'one backup');
  assert.strictEqual(hash(path.join(path.dirname(codexFile), bk[0])), originalHash, 'backup is the original file');
  console.log('codex apply: other hooks and settings kept, gabriel entries added, backup made');
}

// 3: apply again adds nothing and makes no new backup
{
  const before = hash(codexFile);
  const r = run(['--host', 'codex', '--apply']);
  assert.strictEqual(r.status, 0, text(r));
  assert.match(r.stdout, /already set up/);
  assert.strictEqual(hash(codexFile), before, 'second apply must not change the file');
  assert.strictEqual(backups(codexFile).length, 1, 'no new backup');
  console.log('codex second apply: nothing added, no new backup');
}

// 4: remove takes out only gabriel's entries; the other hook stays; the emptied event goes
{
  const r = run(['--remove-host', 'codex', '--apply']);
  assert.strictEqual(r.status, 0, text(r));
  const cfg = JSON.parse(fs.readFileSync(codexFile, 'utf8'));
  assert.deepStrictEqual(cfg.hooks, { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'echo other-tool', timeout: 10 }] }] });
  assert.strictEqual(cfg.model, 'kept');
  assert.strictEqual(backups(codexFile).length, 2, 'remove also makes a backup');
  console.log('codex remove: only gabriel entries removed');
}

// 5: gemini: a file with other settings and a BeforeAgent hook; milliseconds timeouts; no duplicates on a second run
{
  write(geminiFile, { theme: 'dark', hooks: { BeforeAgent: [{ hooks: [{ type: 'command', command: 'echo gem-other', timeout: 1000 }] }] } });
  const r = run(['--host', 'gemini', '--apply']);
  assert.strictEqual(r.status, 0, text(r));
  const cfg = JSON.parse(fs.readFileSync(geminiFile, 'utf8'));
  assert.strictEqual(cfg.theme, 'dark');
  assert.strictEqual(cfg.hooks.BeforeAgent.length, 2);
  assert.strictEqual(cfg.hooks.BeforeAgent[0].hooks[0].command, 'echo gem-other');
  assert.strictEqual(cfg.hooks.BeforeAgent[1].hooks[0].timeout, 60000, 'gemini timeouts are milliseconds');
  assert.ok(cfg.hooks.AfterTool && cfg.hooks.AfterTool[0].matcher, 'AfterTool with a matcher');
  const again = hash(geminiFile);
  assert.strictEqual(run(['--host', 'gemini', '--apply']).status, 0);
  assert.strictEqual(hash(geminiFile), again, 'second gemini apply changes nothing');
  console.log('gemini apply: other settings and hooks kept, ms timeouts, no duplicates');
}

// 6: a broken file is never touched
{
  write(codexFile, '{ "hooks": ');
  const before = hash(codexFile);
  const r = run(['--host', 'codex', '--apply']);
  assert.strictEqual(r.status, 1, text(r));
  assert.match(r.stderr, /not valid JSON/);
  assert.strictEqual(hash(codexFile), before, 'broken file unchanged');
  console.log('broken JSON: refused, file unchanged');
}

// 7: claude, generic and copilot have no hook file to write
{
  const c = run(['--host', 'claude']);
  assert.strictEqual(c.status, 0, text(c));
  assert.match(c.stdout, /Claude Code plugin/);
  const g = run(['--host', 'generic']);
  assert.strictEqual(g.status, 0, text(g));
  assert.match(g.stdout, /context "<prompt>"/);
  const cp = run(['--host', 'copilot', '--apply']);
  assert.strictEqual(cp.status, 0, text(cp));
  assert.match(cp.stdout, /copilot-instructions\.md/);
  assert.match(cp.stdout, /context "<the question>" --host copilot/);
  assert.ok(!fs.existsSync(path.join(home, '.copilot')), 'copilot: nothing written, even with --apply');
  const bad = run(['--host', 'nope']);
  assert.strictEqual(bad.status, 1);
  assert.match(bad.stderr, /unknown host: nope/);
  console.log('claude / generic / copilot / unknown host: messages only');
}

console.log('ALL PASSED');
