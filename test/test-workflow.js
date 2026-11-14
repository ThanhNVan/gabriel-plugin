'use strict';
// End-to-end test of a new user's full journey: setup, add a doc folder, the prompt hook for Claude and Codex,
// the generic `context` command, updating the maps, the eval loop, and the Codex hook file.
// Every child process runs in a temp HOME with its own data folder. The real ~/.claude and ~/.codex are never touched.
const assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SETUP = path.join(ROOT, 'src', 'setup.js'), BRAIN = path.join(ROOT, 'src', 'brain.js');
const RETRAIN = path.join(ROOT, 'src', 'retrain.js'), SUGGEST = path.join(ROOT, 'eval', 'suggest-cases.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gabriel-workflow-'));
const HOME = path.join(TMP, 'home');
const DATA = path.join(TMP, 'gdata');
const NOTES = path.join(TMP, 'notes');
const CLAUDE_HOME = path.join(HOME, '.claude'), CODEX_HOME = path.join(HOME, '.codex');
const PROMPT = 'how do I fix a flat tire on my bike';

// A clean environment: no GABRIEL_* or BRAIN_* variable from the user's shell leaks in.
const BASE_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GABRIEL|BRAIN)_/.test(k) && k !== 'CODEX_HOME'));
const ENV = {
  ...BASE_ENV,
  HOME, USERPROFILE: HOME,
  GABRIEL_DATA: DATA, BRAIN_HOME: CLAUDE_HOME, CODEX_HOME,
  GABRIEL_NO_DOWNLOAD: '1', GABRIEL_SETUP_NO_MIGRATE: '1', GABRIEL_NO_BACKGROUND: '1',
};

// Runs `node <script> <args>` in the repo root with the temp environment.
const node = (script, args = [], input) => spawnSync(process.execPath, [script, ...args], {
  cwd: ROOT, env: ENV, input, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
});
const show = (r) => `exit ${r.status}\n--- stdout ---\n${r.stdout}\n--- stderr ---\n${r.stderr}`;
// The hook runs from a neutral working folder (the temp HOME). The session gate is off by default (projects.json "sessionGate"),
// so a weak, unnamed match shows from any folder. The gate itself is covered in test-map.js.
const hookStdin = (prompt, sessionId, cwd = HOME) => JSON.stringify({ prompt, session_id: sessionId, cwd, transcript_path: '' });
const parseHook = (r) => { assert.strictEqual(r.status, 0, show(r)); return JSON.parse(r.stdout); };

// Fixtures: two small topic notes, one filler file (so the corpus is not too small to pass the map gate).
function writeFixtures() {
  fs.mkdirSync(NOTES, { recursive: true });
  fs.writeFileSync(path.join(NOTES, 'bikes.md'), [
    '# Bike care', '', '## Fix a flat tire', '',
    'Take the wheel off the bike. Pull the tube out and find the hole. Patch the hole, put the tube back, and pump the tire to the side wall pressure.', '',
  ].join('\n'));
  fs.writeFileSync(path.join(NOTES, 'cooking.md'), [
    '# Cooking', '', '## Boil pasta', '',
    'Bring a large pot of salted water to a rolling boil. Add the pasta and stir. Cook until just tender, then drain.', '',
  ].join('\n'));
  // 12 sections of 10 short lines. Sections (not one long list) make enough neurons for the map's word scores to clear its gate.
  const things = ['garden hose', 'kitchen timer', 'river bridge', 'window glass', 'paper map', 'wooden desk', 'winter coat', 'morning train', 'village market', 'pencil case'];
  const verbs = ['needs oiling', 'was moved last week', 'stays in the shed', 'is checked every spring', 'belongs to the old house', 'was bought second hand'];
  const topics = ['Garden tools', 'Kitchen gear', 'Travel notes', 'Winter clothes', 'Home repairs', 'Old furniture', 'Weekly chores', 'Village life', 'Reading list', 'Storage shed', 'Window care', 'Train timetables'];
  const lines = ['# Household notes', ''];
  let n = 0;
  for (const topic of topics) {
    lines.push(`## ${topic}`, '');
    for (let j = 0; j < 10; j++, n++) lines.push(`- The ${things[(n * 3) % things.length]} ${verbs[(n * 7) % verbs.length]}, item ${(n * 11) % 97}.`);
    lines.push('');
  }
  fs.writeFileSync(path.join(NOTES, 'filler.md'), lines.join('\n') + '\n');
}

const steps = [];
function step(name, fn) {
  try { fn(); console.log(`ok - ${name}`); steps.push(name); }
  catch (e) { console.log(`not ok - ${name}`); throw e; }
}

try {
  writeFixtures();

  // 1
  step('setup on an empty data folder: exit 0, starter README, "no doc sets yet"', () => {
    const r = node(SETUP, ['--skip-model', '--skip-test']);
    assert.strictEqual(r.status, 0, show(r));
    assert.ok(fs.existsSync(path.join(DATA, 'docs', 'README.md')), 'docs/README.md must exist');
    assert.match(r.stdout, /no doc sets yet/, show(r));
  });

  // 2
  step('add-docs notes: exit 0, "added notes"', () => {
    const r = node(SETUP, ['add-docs', 'notes', NOTES]);
    assert.strictEqual(r.status, 0, show(r));
    assert.match(r.stdout, /added notes/, show(r));
  });

  // 3
  step('Claude hook: the notes map and bikes.md item come back', () => {
    const out = parseHook(node(BRAIN, ['hook'], hookStdin(PROMPT, 'w1')));
    const ctx = out.hookSpecificOutput && out.hookSpecificOutput.additionalContext;
    assert.ok(ctx, 'additionalContext missing: ' + JSON.stringify(out));
    assert.ok(ctx.includes('notes map ('), ctx);
    assert.ok(ctx.includes('bikes.md'), ctx);
    assert.ok(ctx.includes('Fix a flat tire'), ctx);
  });

  // 4
  step('Claude hook, same session: bikes.md is not repeated', () => {
    const out = parseHook(node(BRAIN, ['hook'], hookStdin(PROMPT, 'w1')));
    const ctx = (out.hookSpecificOutput && out.hookSpecificOutput.additionalContext) || '';
    assert.ok(!ctx.includes('bikes.md'), 'bikes.md repeated: ' + ctx);
    assert.match(String(out.systemMessage || ''), /already in context, not repeated/, JSON.stringify(out));
  });

  // 5
  step('Codex hook: valid JSON, bikes.md in additionalContext, at most 9000 characters', () => {
    const codexStdin = JSON.stringify({
      session_id: 'w5-codex', turn_id: 't1', cwd: HOME, hook_event_name: 'UserPromptSubmit',
      model: 'gpt-test', prompt: PROMPT, transcript_path: null,
    });
    const out = parseHook(node(BRAIN, ['hook', '--host', 'codex'], codexStdin));
    const ctx = out.hookSpecificOutput && out.hookSpecificOutput.additionalContext;
    assert.ok(ctx, 'additionalContext missing: ' + JSON.stringify(out));
    assert.ok(ctx.includes('bikes.md'), ctx);
    assert.ok(ctx.length <= 9000, `too long: ${ctx.length}`);
  });

  // 6
  // `context` with no --session and no --cwd: plain text, the same items as the hook.
  step('context command (any tool): plain text with bikes.md, no --session', () => {
    const r = node(BRAIN, ['context', PROMPT]);
    assert.strictEqual(r.status, 0, show(r));
    assert.ok(r.stdout.includes('bikes.md'), show(r));
  });

  // 7
  step('unrelated prompt: no map in the Claude hook output', () => {
    const r = node(BRAIN, ['hook'], hookStdin('what is the capital city of Portugal', 'w7'));
    assert.strictEqual(r.status, 0, show(r));
    assert.ok(!r.stdout.includes('map ('), show(r));
  });

  // 8
  step('new doc added, --update rebuilds notes, new section found', () => {
    fs.writeFileSync(path.join(NOTES, 'bikes2.md'), [
      '# Bike chains', '', '## Replace a chain', '',
      'Shift to the smallest gear. Use a chain tool to push out one pin on the old chain. Fit the new chain, join the link, and check the tension.', '',
    ].join('\n'));
    const r = node(SETUP, ['--update']);
    assert.strictEqual(r.status, 0, show(r));
    assert.match(r.stdout, /notes: map built/, show(r));
    assert.match(r.stdout, /1 rebuilt/, show(r));
    // --cwd is covered here, once: the notes folder is passed as the working folder
    const c = node(BRAIN, ['context', 'how do I replace a bike chain', '--cwd', NOTES]);
    assert.strictEqual(c.status, 0, show(c));
    assert.ok(c.stdout.includes('bikes2.md'), show(c));
  });

  // 9
  step('second --update: nothing rebuilt', () => {
    const r = node(SETUP, ['--update']);
    assert.strictEqual(r.status, 0, show(r));
    assert.match(r.stdout, /up to date: notes/, show(r));
    assert.match(r.stdout, /0 rebuilt/, show(r));
  });

  // 10
  step('eval loop: suggest cases, save them, retrain prints both scores', () => {
    const s = node(SUGGEST, ['--project', 'notes']);
    assert.strictEqual(s.status, 0, show(s));
    assert.match(s.stdout, /wrote \d+ suggested cases/, show(s));
    const privateDir = path.join(DATA, 'private', 'notes');
    const suggested = path.join(privateDir, 'eval-cases.suggested.json');
    assert.ok(fs.existsSync(suggested), 'suggested file missing');
    fs.copyFileSync(suggested, path.join(privateDir, 'eval-cases.json'));
    const r = node(RETRAIN, ['notes']);
    assert.match(r.stdout, /current weights .*: strict \d+\/\d+/, show(r));
    // Exit 1 only when training failed. No meaning model (GABRIEL_NO_DOWNLOAD=1 here) is not a failure: exit 0, and retrain says so.
    if (/training failed/.test(r.stdout + r.stderr)) assert.strictEqual(r.status, 1, show(r));
    else assert.strictEqual(r.status, 0, show(r));
    assert.ok(/new weights: strict \d+\/\d+/.test(r.stdout) || /meaning model is missing/.test(r.stdout), show(r));
  });

  // 11
  step('Codex hooks file: --host codex --apply adds gabriel entries, --remove-host removes them', () => {
    const file = path.join(CODEX_HOME, 'hooks.json');
    const add = node(SETUP, ['--host', 'codex', '--apply']);
    assert.strictEqual(add.status, 0, show(add));
    assert.ok(fs.existsSync(file), 'hooks.json not written');
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const cmds = (ev) => ((cfg.hooks && cfg.hooks[ev]) || []).flatMap((g) => g.hooks.map((h) => h.command));
    assert.ok(cmds('UserPromptSubmit').some((c) => /brain\.js" hook --host codex/.test(c)), JSON.stringify(cfg));
    assert.ok(cmds('PostToolUse').some((c) => /brain\.js" touched --host codex/.test(c)), JSON.stringify(cfg));
    const backups = fs.readdirSync(CODEX_HOME).filter((f) => f.includes('gabriel-backup'));
    assert.deepStrictEqual(backups, [], 'no backup expected when no file existed before');
    const rm = node(SETUP, ['--remove-host', 'codex', '--apply']);
    assert.strictEqual(rm.status, 0, show(rm));
    assert.ok(!fs.readFileSync(file, 'utf8').includes('brain.js'), 'gabriel entries still in hooks.json');
  });

  // 12
  // "gabriel use <set>" pins the session to one doc set, "gabriel use auto" clears it. This test has one doc set (notes), so there is
  // no second set to exclude: the pin is checked by its note, its file, and by the set still answering.
  step('gabriel use <set> / use auto / unknown name / no session id: notes, pin file, answers', () => {
    const ctxOf = (o) => String((o.hookSpecificOutput && o.hookSpecificOutput.additionalContext) || '');
    const pinFile = path.join(DATA, 'seen', 'p1.pin');
    const use = parseHook(node(BRAIN, ['hook'], hookStdin('gabriel use notes', 'p1')));
    assert.match(String(use.systemMessage || ''), /pinned to notes\. The map now searches only notes/, JSON.stringify(use));
    assert.ok(!(use.hookSpecificOutput && use.hookSpecificOutput.additionalContext), JSON.stringify(use));
    assert.ok(fs.existsSync(pinFile), 'pin file not written');
    const pinned = parseHook(node(BRAIN, ['hook'], hookStdin(PROMPT, 'p1')));
    assert.ok(ctxOf(pinned).includes('notes map ('), JSON.stringify(pinned));
    const bad = parseHook(node(BRAIN, ['hook'], hookStdin('gabriel use nope', 'p1b')));
    assert.match(String(bad.systemMessage || ''), /no doc set "nope"/, JSON.stringify(bad));
    assert.ok(!fs.existsSync(path.join(DATA, 'seen', 'p1b.pin')), 'unknown name must not write a pin');
    const noSid = parseHook(node(BRAIN, ['hook'], hookStdin('gabriel use notes', '')));
    assert.match(String(noSid.systemMessage || ''), /could not pin\. This tool sends no session id/, JSON.stringify(noSid));
    const auto = parseHook(node(BRAIN, ['hook'], hookStdin('gabriel use auto', 'p1')));
    assert.match(String(auto.systemMessage || ''), /all doc sets again/, JSON.stringify(auto));
    assert.ok(!fs.existsSync(pinFile), 'use auto must clear the pin file');
    // a session that was never pinned still gets the notes map (the same as p1 would without a pin)
    assert.ok(ctxOf(parseHook(node(BRAIN, ['hook'], hookStdin(PROMPT, 'p3')))).includes('notes map ('), 'p3 (no pin) has no notes map');
    assert.ok(ctxOf(parseHook(node(BRAIN, ['hook'], hookStdin(PROMPT, 'p2')))).includes('notes map ('), 'p2 (no pin) has no notes map');
    // while a session is pinned, every user note starts with a line break, then the pin line. Empty stdout is allowed (no JSON to parse).
    const PIN_LINE = '📌 pinned: notes  ("gabriel use auto" to undo)';
    const firstLine = (o) => { const m = String(o.systemMessage || ''); assert.ok(m.startsWith('\n'), 'pin note must start with a line break: ' + JSON.stringify(m)); return m.split('\n')[1]; };
    const run = (prompt, sid) => {
      const r = node(BRAIN, ['hook'], hookStdin(prompt, sid));
      assert.strictEqual(r.status, 0, show(r));
      return { r, o: r.stdout.trim() ? JSON.parse(r.stdout) : {} };
    };
    parseHook(node(BRAIN, ['hook'], hookStdin('gabriel use notes', 'q1')));
    const qMap = parseHook(node(BRAIN, ['hook'], hookStdin(PROMPT, 'q1')));
    assert.strictEqual(firstLine(qMap), PIN_LINE, JSON.stringify(qMap));
    assert.ok(!ctxOf(qMap).includes('📌'), 'pin line must not go into additionalContext');
    assert.strictEqual(firstLine(run('ok thanks', 'q1').o), PIN_LINE, 'short prompt in a pinned session');
    assert.strictEqual(firstLine(run('/gabriel:status', 'q1').o), PIN_LINE, 'slash command in a pinned session');
    parseHook(node(BRAIN, ['hook'], hookStdin('gabriel use auto', 'q1')));
    const unpinned = run('ok thanks', 'q1');
    assert.ok(!unpinned.r.stdout.includes('📌'), 'after use auto, no pin line: ' + unpinned.r.stdout);
    const neverPinned = run(PROMPT, 'q2');
    const npMsg = String((neverPinned.r.stdout.trim() ? JSON.parse(neverPinned.r.stdout) : {}).systemMessage || '');
    assert.ok(!npMsg.includes('📌 pinned:'), 'never-pinned session has a pin line: ' + npMsg);
    const SUGGEST = '💡 Working in one project? Type "gabriel use <set>" to search only that doc set this session.';
    assert.ok(!npMsg.includes(SUGGEST), 'one doc set only: no pin suggestion (it shows only with 2 or more sets): ' + npMsg);
    assert.ok(!ctxOf(neverPinned.o).includes('gabriel use <set>'), 'pin suggestion must not go into additionalContext');
    assert.ok(!qMap.systemMessage.includes(SUGGEST), 'pinned map note has no pin suggestion');
  });

  console.log('ALL PASSED');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
