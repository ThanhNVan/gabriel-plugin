// Tests for the host adapters: output shapes, touched paths, and the hook / context commands run per host.
// Every run uses temp folders: HOME, the data folder, CODEX_HOME and the rules folders. The real home is never read.
const assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BRAIN = path.join(ROOT, 'src', 'brain.js');
const hosts = require('../src/hosts/index.js');
const brain = require('../src/brain.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hosts-test-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const fakeHome = path.join(tmp, 'home'), data = path.join(tmp, 'data');
const codexHome = path.join(tmp, 'codex'), rulesDir = path.join(tmp, 'rules');
for (const d of [fakeHome, data, codexHome, rulesDir]) fs.mkdirSync(d, { recursive: true });

// The always-loaded file (AGENTS.md, GEMINI.md, CLAUDE.md) is never injected, so the test rule is a memory note in each rules folder.
const RULE = '---\nname: test-rules\ntype: feedback\n---\n- Run the unit tests before saying the work is done and report the result.\n';
const noteIn = (home) => { const f = path.join(home, 'projects', 'p1', 'memory', 'feedback-tests.md'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, RULE); };
fs.writeFileSync(path.join(codexHome, 'AGENTS.md'), '# Rules\n- Keep answers short.\n');
noteIn(codexHome);
fs.mkdirSync(path.join(fakeHome, '.gemini'), { recursive: true });
fs.writeFileSync(path.join(fakeHome, '.gemini', 'GEMINI.md'), '# Rules\n- Keep answers short.\n');
noteIn(path.join(fakeHome, '.gemini'));
noteIn(rulesDir);

const PROMPT = 'Please run the unit tests and tell me the result before we say done.';
const baseEnv = () => {
  const env = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, GABRIEL_DATA: data, CODEX_HOME: codexHome, GABRIEL_NO_BACKGROUND: '1' };
  for (const k of ['BRAIN_HOME', 'BRAIN_DATA', 'GABRIEL_HOST', 'GABRIEL_RULES_HOME', 'GABRIEL_NO_DOWNLOAD']) delete env[k];
  return env;
};
const run = (args, input, extra = {}) => spawnSync(process.execPath, [BRAIN, ...args], { input, env: { ...baseEnv(), ...extra }, encoding: 'utf8', timeout: 60000 });

// 1: output shapes (no run needed)
{
  const text = 'Relevant rules from the brain graph (matched to this prompt):\n- [CLAUDE.md > x] Run the tests.\n';
  const note = '📏 Rules that apply\n   • Run the tests.';
  // claude: systemMessage first, then hookSpecificOutput (the same key order as before)
  assert.strictEqual(hosts.get('claude').writeOutput({ text, note }), JSON.stringify({ systemMessage: note, hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }));
  assert.strictEqual(hosts.get('claude').writeOutput({ text: '', note: 'hint' }), '{"systemMessage":"hint"}');
  assert.strictEqual(hosts.get('claude').writeOutput({ text: '', note: '' }), '');
  // codex: the same two keys, both optional
  assert.deepStrictEqual(JSON.parse(hosts.get('codex').writeOutput({ text, note })), { systemMessage: note, hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } });
  assert.strictEqual(hosts.get('codex').writeOutput({ text: '', note: '' }), '');
  // gemini: model text only
  assert.deepStrictEqual(JSON.parse(hosts.get('gemini').writeOutput({ text, note })), { hookSpecificOutput: { additionalContext: text } });
  assert.strictEqual(hosts.get('gemini').writeOutput({ text: '', note }), '');
  // generic: plain block only
  assert.strictEqual(hosts.get('generic').writeOutput({ text, note }), text);
  assert.throws(() => hosts.get('vscode'), /unknown host: vscode/);
  console.log('output shapes: ok');
}

// 2: touched paths per host
{
  const patch = '*** Begin Patch\n*** Update File: src/a.js\n@@\n-x\n+y\n*** Add File: docs/new.md\n+hi\n*** Delete File: old.txt\n*** End Patch';
  const cwd = path.join(tmp, 'work');
  const codexFiles = hosts.get('codex').readTouched(JSON.stringify({ tool_name: 'apply_patch', cwd, tool_input: { command: patch } }));
  assert.deepStrictEqual(codexFiles, [path.resolve(cwd, 'src/a.js'), path.resolve(cwd, 'docs/new.md')], 'Delete File is skipped');
  assert.deepStrictEqual(hosts.get('codex').readTouched(JSON.stringify({ tool_name: 'Bash', cwd, tool_input: { command: 'ls -la' } })), []);
  assert.deepStrictEqual(hosts.get('codex').readTouched(JSON.stringify({ tool_name: 'Edit', cwd, tool_input: { file_path: path.join(cwd, 'x.md') } })), [path.join(cwd, 'x.md')]);
  assert.deepStrictEqual(hosts.get('gemini').readTouched(JSON.stringify({ tool_name: 'write_file', cwd, tool_input: { absolute_path: path.join(cwd, 'g.md') } })), [path.join(cwd, 'g.md')]);
  assert.deepStrictEqual(hosts.get('gemini').readTouched(JSON.stringify({ tool_name: 'read_file', cwd, tool_input: {} })), []);
  assert.deepStrictEqual(hosts.get('claude').readTouched(JSON.stringify({ tool_input: { notebook_path: '/n.ipynb' } })), ['/n.ipynb']);
  assert.deepStrictEqual(hosts.get('generic').readTouched('{}'), []);
  console.log('touched paths: ok');
}

// 3: capText cuts at a line break and leaves short text alone
{
  assert.strictEqual(brain.capText('short', 9000), 'short');
  assert.strictEqual(brain.capText('line one\nline two\nline three', 20), 'line one\nline two\n');
  assert.strictEqual(brain.capText('no breaks here at all', 5), 'no br\n');
  console.log('capText: ok');
}

// 4: codex hook, with the stdin shape Codex sends (transcript_path may be null)
{
  const input = JSON.stringify({ session_id: 'codex-s1', transcript_path: null, cwd: tmp, hook_event_name: 'UserPromptSubmit', model: 'm', turn_id: 't1', prompt: PROMPT });
  const r = run(['hook', '--host', 'codex'], input, { CODEX_HOME: codexHome });
  assert.strictEqual(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(out.hookSpecificOutput.additionalContext, /Run the unit tests before saying the work is done/);
  assert.ok(out.hookSpecificOutput.additionalContext.length <= 9000);
  assert.ok(fs.existsSync(path.join(data, 'graph.codex.json')), 'codex graph file');
  assert.ok(!fs.existsSync(path.join(data, 'graph.json')), 'codex must not write graph.json (claude keeps that name)');
  console.log('codex hook: JSON with hookSpecificOutput.additionalContext, graph.codex.json written');
}

// 5: gemini hook, with the BeforeAgent stdin shape (rules come from ~/.gemini)
{
  const input = JSON.stringify({ session_id: 'gem-s1', transcript_path: '', cwd: tmp, hook_event_name: 'BeforeAgent', timestamp: '2026-11-13T00:00:00Z', prompt: PROMPT });
  const r = run(['hook', '--host', 'gemini'], input, { GABRIEL_HOST: '' });
  assert.strictEqual(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.match(out.hookSpecificOutput.additionalContext, /Run the unit tests before saying the work is done/);
  assert.ok(fs.existsSync(path.join(data, 'graph.gemini.json')), 'gemini graph file');
  console.log('gemini hook: JSON with hookSpecificOutput.additionalContext, graph.gemini.json written');
}

// 6: context command: plain text for any tool, rules from GABRIEL_RULES_HOME; short prompts print nothing
{
  const r = run(['context', PROMPT, '--host', 'generic'], '', { GABRIEL_RULES_HOME: rulesDir });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Relevant rules from the brain graph/);
  assert.match(r.stdout, /Run the unit tests before saying the work is done/);
  const short = run(['context', 'too short', '--host', 'generic'], '', { GABRIEL_RULES_HOME: rulesDir });
  assert.strictEqual(short.stdout, '');
  // with --session, the same items are not printed again in that session
  const s1 = run(['context', PROMPT, '--host', 'generic', '--session', 'chat-7'], '', { GABRIEL_RULES_HOME: rulesDir });
  const s2 = run(['context', PROMPT, '--host', 'generic', '--session', 'chat-7'], '', { GABRIEL_RULES_HOME: rulesDir });
  assert.match(s1.stdout, /Run the unit tests/);
  assert.ok(!/Run the unit tests/.test(s2.stdout), 'second prompt in the same session repeats nothing: ' + s2.stdout);
  // a pin command gives its reply, not a search; with no session id it cannot pin
  const pinOk = run(['context', 'gabriel use auto', '--host', 'generic', '--session', 'chat-pin'], '', { GABRIEL_RULES_HOME: rulesDir });
  assert.match(pinOk.stdout, /pin removed/);
  const pinNoSid = run(['context', 'gabriel use auto', '--host', 'generic'], '', { GABRIEL_RULES_HOME: rulesDir });
  assert.match(pinNoSid.stdout, /could not pin/);
  console.log('context command: plain text, short prompt prints nothing, --session stops repeats, pin commands reply');
}

// 7: the claude hook output for a fixed input is the same bytes as before (golden string from the baseline check)
{
  const claudeHome = path.join(tmp, 'claude-home'), claudeData = path.join(tmp, 'claude-data');
  fs.mkdirSync(claudeHome, { recursive: true });
  fs.writeFileSync(path.join(claudeHome, 'CLAUDE.md'), '# Rules\n- Never commit or push anything. The user does.\n');
  fs.writeFileSync(path.join(claudeHome, 'preferences.md'), '');   // an own preferences.md (even empty) keeps the plugin defaults out of the golden bytes
  fs.mkdirSync(path.join(claudeHome, 'projects', 'p1', 'memory'), { recursive: true });
  fs.writeFileSync(path.join(claudeHome, 'projects', 'p1', 'memory', 'feedback-tests.md'), '---\nname: test-rules\ntype: feedback\n---\n- Run the unit tests before saying the work is done and report the result.\n');
  const input = JSON.stringify({ session_id: 'golden-1', cwd: 'C:\\work\\demo', prompt: PROMPT });
  const r = run(['hook'], input, { BRAIN_HOME: claudeHome, GABRIEL_DATA: claudeData });
  assert.strictEqual(r.status, 0, r.stderr);
  const golden = '{"systemMessage":"📏 Rules that apply\\n   • Run the unit tests before saying the work is done and report the result.  (test-rules)\\ngabriel is not set up yet. Run /gabriel:setup to finish the install.","hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Relevant rules from the brain graph (matched to this prompt):\\n- [memory/feedback-tests.md > test-rules] Run the unit tests before saying the work is done and report the result."}}';
  assert.strictEqual(r.stdout, golden);
  assert.ok(fs.existsSync(path.join(claudeData, 'graph.json')), 'claude keeps graph.json');
  console.log('claude hook: output bytes match the golden string');
}

console.log('ALL PASSED');
