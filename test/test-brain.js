// Self-test for brain.js. Uses a fake ~/.claude in a temp folder. Prints "ALL PASSED" or throws.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { brainPath, tempHome, runBrain } = require('./test-util.js');
const brain = require(brainPath);

const home = tempHome('brain-test-');
const w = (rel, text) => { const p = path.join(home, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };

// rule files come from projects.json in the data folder: write one for this test and point this process at that folder, so the owner's config is never read
process.env.GABRIEL_DATA = path.join(home, 'brain', 'data');
// CLI mode table (Task 4): every mode has a run function, and the usage text names every mode
const { MODES } = require(brainPath);
for (const m of ['build', 'query', 'hook', 'touched', 'touched-files', 'context', 'refresh', 'graph', 'related', 'check', 'build-dq', 'build-mk', 'learn-show', 'learn-reset', 'mk-status', 'mk', 'why', 'forget'])
  assert.strictEqual(typeof MODES[m].run, 'function', 'mode ' + m);
const usageOut = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'brain.js'), 'nonsense'], { encoding: 'utf8' }).stdout;
for (const m of Object.keys(MODES)) assert.ok(usageOut.includes(m), 'usage names ' + m);
// Task 5: skipReason() gives the reason hook() skips a prompt, and `why` prints it without a search
const { skipReason } = require('../src/brain.js');
assert.strictEqual(skipReason('/gabriel:status'), 'slash command');
assert.strictEqual(skipReason('fix this bug'), 'under 4 words');
assert.strictEqual(skipReason('how does the map search work'), '');
assert.strictEqual(runBrain(tempHome('why-test-'), ['why', 'fix this bug']).stdout, 'gabriel skips this prompt: under 4 words. No search runs.\n', 'why prints the skip line');
w('brain/data/projects.json', JSON.stringify({ version: 1, ruleFiles: ['CLAUDE.md', 'preferences.md', 'codex-rules.md'] }));
w('CLAUDE.md', '# Codex\n- Never commit or push anything. The user does.\n');
w('preferences.md', [
  '# Rules', '## How to work',
  '- Always build web apps with `docker compose build` and pass the Kestrel key from `$env:EXAMPLE_LICENSE_KEY`.',
  '- Run long jobs with `run-watched.ps1` in the background.',
  '- The Seq key is AbCdEf0123456789AbCdEf0123456789 keep it.',
  '## Style',
  '- Use `Any()` to check for items in C# code.',
  '- The user runs git commit, git push and git merge by hand. Claude never does.', ''].join('\n'));
w('projects/p1/memory/MEMORY.md', '- [docker-note](docker-note.md) - index line that must be ignored\n');
w('projects/p1/memory/docker-note.md', '---\nname: docker-note\ndescription: docker service names\nmetadata:\n  type: feedback\n---\n\nUse `orders-api` as the real service name. See [[facts-note]].\n');
w('projects/p1/memory/facts-note.md', '---\nname: facts-note\ndescription: facts\nmetadata:\n  type: user\n---\n\nVerify identifiers against the source of truth before answering.\n');

const g = brain.build(home);
// 1: parse count (CLAUDE.md 1 + prefs 4 + 2 notes; MEMORY.md ignored; the secret line skipped)
assert.strictEqual(g.nodes.length, 7, 'node count ' + g.nodes.length);
assert.ok(!JSON.stringify(g).includes('AbCdEf0123456789'), 'secret leaked into graph');
assert.ok(fs.existsSync(path.join(home, 'brain', 'data', 'graph.json')), 'graph.json not written');

const texts = (r) => r.map((n) => n.text).join('\n');
// 2: a matching prompt finds the docker rule
assert.ok(texts(brain.query(home, 'how do I docker compose build the web app')).includes('Kestrel'), 'docker rule missing');
// 3: an unrelated prompt returns nothing
assert.strictEqual(brain.query(home, 'what is the weather like today in Paris').length, 0, 'unrelated prompt returned rules');
// 4: spreading activation: the linked note comes in as a neighbour
const r4 = texts(brain.query(home, 'what is the orders-api service'));
assert.ok(r4.includes('orders-api') && r4.includes('source of truth'), 'neighbour missing: ' + r4);
// 5: CLAUDE.md nodes are never injected (already in context)
assert.ok(!texts(brain.query(home, 'never commit or push anything')).includes('Never commit'), 'CLAUDE.md node injected');

// 6: hook output and fail-open
const hook = (input) => runBrain(home, ['hook'], input);
const h1 = hook(JSON.stringify({ prompt: 'how do I docker compose build the web app' }));
const out = JSON.parse(h1.stdout);
assert.strictEqual(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
assert.ok(out.hookSpecificOutput.additionalContext.includes('Kestrel'), 'hook context missing rule');
assert.ok(out.hookSpecificOutput.additionalContext.length <= 2600, 'hook context too long');
const h2 = hook('not json');
assert.ok(h2.status === 0 && h2.stdout === '', 'hook must fail open on bad input');
const h3 = hook(JSON.stringify({ prompt: '/brain-upgrade docker compose build' }));
assert.ok(h3.status === 0 && h3.stdout === '', 'slash commands must be skipped');
const h4 = hook(JSON.stringify({ prompt: 'docker build' }));
assert.ok(h4.status === 0 && h4.stdout === '', 'short prompts must be skipped');

// 7: thesaurus: a different word with the same meaning finds the rule; an empty thesaurus does not
const ship = 'please ship the change to the remote now';
assert.ok(texts(brain.query(home, ship)).includes('git commit'), 'thesaurus missed: ' + texts(brain.query(home, ship)));
assert.strictEqual(brain.query(home, ship, { thesaurus: [] }).length, 0, 'found without thesaurus: it was a word match');

// 8..12: meaning (embeddings), tested with a fake embedder so the test needs no model
const dims = (t) => (/zebra/.test(t) || /Kestrel/.test(t) ? [1, 0, 0, 0] : /weather/.test(t) ? [0, 0, 0, 1] : [0, 0, 1, 0]);
const fake = async (texts) => texts.map(dims);
let finished = false; // if Node runs out of work before the async cases end, that is a failure, not a pass
process.on('exit', () => { if (!finished) { console.error('TEST DID NOT FINISH'); process.exitCode = 1; } });
(async () => {
  const g2 = brain.build(home);
  const e = await brain.embedNodes(home, g2, fake, 'fake-test');
  assert.strictEqual(e.total, g2.nodes.filter((n) => !n.inContext).length, 'not every injectable node got a vector');
  const o = { embed: fake, model: 'fake-test' };
  // 8: no shared word and no thesaurus match, but the meaning matches
  const zebra = 'zebra giraffe habitat elephants';
  assert.strictEqual(brain.query(home, zebra).length, 0, 'words alone should find nothing');
  assert.ok(texts(await brain.search(home, zebra, o)).includes('Kestrel'), 'meaning match missing');
  // 9: an unrelated prompt still returns nothing
  assert.strictEqual((await brain.search(home, 'what is the weather like in Paris', o)).length, 0, 'unrelated prompt returned rules');
  // 10: a broken embedder falls back to words; a stuck one is cut off by the time limit
  const r10 = await brain.search(home, 'how do I docker compose build the web app', { ...o, embed: async () => { throw new Error('boom'); } });
  assert.ok(texts(r10).includes('Kestrel'), 'no fallback to words');
  const t0 = Date.now();
  const r11 = await brain.search(home, 'how do I docker compose build the web app', { ...o, embed: () => new Promise(() => {}), timeoutMs: 300 });
  assert.ok(Date.now() - t0 < 1500 && texts(r11).includes('Kestrel'), 'stuck embedder not cut off');
  // 12: vectors of another model are ignored (the hook must not load the real model for them)
  const t1 = Date.now();
  const h5 = hook(JSON.stringify({ prompt: 'how do I docker compose build the web app' }));
  assert.ok(h5.status === 0 && JSON.parse(h5.stdout).hookSpecificOutput.additionalContext.includes('Kestrel') && Date.now() - t1 < 3000, 'hook with foreign vectors');

  // 13: a broken graph.json (crash during a write) is rebuilt, not fatal; no temp file is left; a vector of the wrong size is ignored
  fs.writeFileSync(path.join(home, 'brain', 'data', 'graph.json'), '{"nodes":[{"id":');
  assert.ok(texts(brain.query(home, 'how do I docker compose build the web app')).includes('Kestrel'), 'broken graph.json was not rebuilt');
  assert.ok(texts(await brain.search(home, 'how do I docker compose build the web app', o)).includes('Kestrel'), 'search after broken graph.json');
  assert.ok(!fs.readdirSync(path.join(home, 'brain')).some((f) => f.endsWith('.tmp')), 'temp file left behind');
  const short = async (t) => t.map(() => [1, 0]);
  const shortOpts = { embed: short, model: 'fake-test' };
  assert.ok(texts(await brain.search(home, 'zebra giraffe habitat elephants', shortOpts)).length === 0, 'wrong-size vectors must not match');

  // 14: a graph.json from an older word-cutting version is rebuilt even when no source file changed
  const gf = path.join(home, 'brain', 'data', 'graph.json'), cur = JSON.parse(fs.readFileSync(gf, 'utf8'));
  cur.graph.version = 1; cur.nodes.forEach((n) => { n.kw = ['poison']; }); fs.writeFileSync(gf, JSON.stringify(cur));
  assert.ok(texts(brain.query(home, 'how do I docker compose build the web app')).includes('Kestrel'), 'old-version graph was reused');
  assert.strictEqual(JSON.parse(fs.readFileSync(gf, 'utf8')).graph.version, g2.graph.version, 'graph not rewritten with the current version');

  // 15: note headers: "valid-until" in the past drops the note, "supersedes" drops the older note, a future date keeps it and the graph is rebuilt after that day
  const h2 = tempHome('brain-test-expiry-'), w2 = (rel, text) => { const p = path.join(h2, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  const note = (name, extra, body) => w2(`projects/p1/memory/${name}.md`, `---\nname: ${name}\ndescription: d\n${extra}metadata:\n  type: project\n---\n\n${body}\n`);
  note('old-port', '', 'The staging server listens on port 8081 for every request.');
  note('new-port', 'supersedes: old-port\n', 'The staging server listens on port 9090 for every request.');
  note('gone-note', 'valid-until: 2020-01-01\n', 'The temporary freeze on deployments ends soon enough.');
  note('later-note', 'valid-until: 2999-01-01\n', 'The release window opens every second Thursday afternoon.');
  note('dead-new-port', 'supersedes: kept-port\nvalid-until: 2020-01-01\n', 'The legacy gateway listens on port 7070 for every call.');
  note('kept-port', '', 'The reporting gateway listens on port 6060 for every call.');
  note('typo-date', 'valid-until: 31/12/2030\n', 'The archive server keeps copies for ninety days exactly.');
  note('bad-day', 'valid-until: 2026-02-31\n', 'The backup job runs on the third floor server nightly.');
  note('ghost-ref', 'supersedes: no-such-note\n', 'The mail relay uses the internal hostname for every send.');
  const g3 = brain.build(h2), all = g3.nodes.map((n) => n.text).join('\n');
  assert.ok(all.includes('9090') && !all.includes('8081'), 'superseded note kept: ' + all);
  assert.ok(!all.includes('temporary freeze'), 'expired note kept');
  const warn = g3.graph.warnings.join('\n');
  assert.ok(/typo-date\.md: valid-until "31\/12\/2030"/.test(warn), 'no warning for a wrong date form: ' + warn);
  assert.ok(/bad-day\.md: valid-until "2026-02-31"/.test(warn), 'no warning for 31 February: ' + warn);
  assert.ok(/ghost-ref\.md: supersedes "no-such-note"/.test(warn), 'no warning for an unknown supersedes name: ' + warn);
  assert.ok(/gone-note\.md: dropped/.test(warn), 'no notice for an expired note');
  assert.ok(all.includes('archive server') && all.includes('backup job'), 'a bad date must leave the note active');
  assert.ok(!/later-note\.md|memory\/new-port\.md|memory\/old-port\.md|kept-port\.md/.test(warn), 'false warning: ' + warn);
  const chk = runBrain(h2, ['check']);
  assert.ok(chk.status === 1 && /WARNING .*typo-date/.test(chk.stdout), 'check mode: ' + chk.stdout + chk.stderr);
  assert.ok(all.includes('6060') && !all.includes('7070'), 'an expired note must not replace another note: ' + all);
  assert.ok(all.includes('release window'), 'future-dated note dropped');
  assert.ok(g3.graph.expires > Date.now(), 'expires not set: ' + g3.graph.expires);
  const g4 = JSON.parse(fs.readFileSync(path.join(h2, 'brain', 'data', 'graph.json'), 'utf8')); g4.graph.expires = Date.now() - 1000; fs.writeFileSync(path.join(h2, 'brain', 'data', 'graph.json'), JSON.stringify(g4));
  brain.query(h2, 'staging server port request');
  assert.ok(JSON.parse(fs.readFileSync(path.join(h2, 'brain', 'data', 'graph.json'), 'utf8')).graph.expires > Date.now(), 'graph past its expiry date was not rebuilt');

  // 16: searchFull puts exact-word history hits into hist, with or without the model, never more than 2, never the prompt itself
  const hist = require(path.join(path.dirname(brainPath), 'history.js')), gdb = require(path.join(path.dirname(brainPath), 'graphdb.js'));
  hist.append(home, 'open the file changelog-draft.md and fix the heading', 'X');
  hist.append(home, 'rename the changelog-draft.md file in the docs folder', 'X');
  gdb.sync(home, brain.tokens);
  const ask = 'where is changelog-draft.md stored';
  for (const opts of [o, { model: 'no-such-model' }]) {
    const f = await brain.searchFull(home, ask, opts);
    assert.strictEqual(f.hist.length, 2, 'history cap: ' + JSON.stringify(f.hist));
    assert.ok(f.hist.every((x) => /changelog-draft/.test(x.p)), 'wrong history hit');
  }
  assert.strictEqual((await brain.searchFull(home, 'open the file changelog-draft.md and fix the heading', o)).hist.some((x) => x.p === 'open the file changelog-draft.md and fix the heading'), false, 'the prompt itself came back');
  assert.strictEqual((await brain.searchFull(home, 'what is the weather like in Paris', o)).hist.length, 0, 'unrelated prompt got history');

  // Task 7: buildNote() gives one 💡 line at most; the setup hint or tip wins over the pin hint
  {
    const { buildNote } = require(brainPath);
    const PIN_HINT = '💡 Working in one project? Type "gabriel use <set>" to search only that doc set this session.';
    const both = buildNote({ view: '🧭 A map', skipped: 0, hint: '💡 Tip: x', pinned: null, manySets: true });
    assert.strictEqual((both.match(/💡/g) || []).length, 1, 'one hint line at most');
    assert.ok(both.includes('💡 Tip: x'), 'the tip wins');
    assert.ok(buildNote({ view: '🧭 A map', skipped: 0, hint: '', pinned: null, manySets: true }).endsWith(PIN_HINT));
    assert.ok(!buildNote({ view: '🧭 A map', skipped: 0, hint: '', pinned: 'alpha', manySets: true }).includes('💡'));
    assert.ok(buildNote({ view: '', skipped: 2, hint: '', pinned: null, manySets: true }).includes('(2 items already in context, not repeated)'));
    assert.strictEqual(buildNote({ view: '', skipped: 0, hint: '', pinned: null, manySets: false }), '');
  }
  // warnings: drift and miss notes show once per session, at their level, and ignore tips:false
  {
    const dataDir = path.join(home, 'brain', 'data'), { driftNote, missNote, noteMiss } = require(brainPath);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'projects.json'), JSON.stringify({ version: 1, projects: [], tips: false }));
    fs.writeFileSync(path.join(dataDir, 'drift.json'), JSON.stringify({ t: Date.now(), sets: { alpha: { commits: 4, changed: 12 }, beta: { commits: 9, changed: 3 } } }));
    const dn = driftNote('w1');
    assert.ok(dn.startsWith('⚠️ ') && dn.includes('The alpha graph is 4 commits behind (12 code files changed)') && dn.includes('/gabriel:refresh-docs alpha'), 'drift note names the set with the most changed files: ' + dn);
    assert.strictEqual(driftNote('w1'), '', 'drift note: not on the 2nd prompt');
    assert.strictEqual(driftNote('w1'), dn, 'drift note: again on the 3rd prompt (every 2nd)');
    assert.strictEqual(driftNote('w1'), '', 'drift note: not on the 4th prompt');
    assert.ok(driftNote('w2').includes('alpha'), 'drift note: the next session shows it too');
    assert.strictEqual(driftNote(''), '', 'drift note: no session id, no note');
    fs.writeFileSync(path.join(dataDir, 'drift.json'), JSON.stringify({ t: 1, sets: { beta: { commits: 9, changed: 3 } } }));
    assert.strictEqual(driftNote('w3'), '', 'drift note: under the level of 10 changed files, no note');
    assert.strictEqual(missNote('w1'), '', 'miss note: no list yet');
    noteMiss('w1', 'a.cs'); noteMiss('w1', 'a.cs'); noteMiss('w1', 'b.cs');
    assert.strictEqual(missNote('w1'), '', 'miss note: two distinct files is under the level of 3');
    noteMiss('w1', 'c.cs');
    const mn = missNote('w1');
    assert.ok(mn.startsWith('⚠️ ') && mn.includes('3 files you touched are not in the code graph'), 'miss note at 3 files: ' + mn);
    assert.strictEqual(missNote('w1'), '', 'miss note: once per session');
    for (let i = 0; i < 25; i++) noteMiss('w4', 'f' + i + '.cs');
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'seen', 'w4.miss'), 'utf8')).length, 20, 'the miss list keeps 20 files');
    assert.strictEqual(driftNote(''), '');
    // docs age (from docs-checked): one line; 7 days or less is no note; a set never checked is noted only with a graph drift of 10+ files
    fs.writeFileSync(path.join(dataDir, 'drift.json'), JSON.stringify({ t: 1, sets: { gamma: { docsBehindDays: 9.4, commitsSince: 5 } } }));
    assert.strictEqual(driftNote('d1'), '⚠️ gabriel: The gamma docs were last checked 9 days before the latest code commit (5 commits since). Run /gabriel:refresh-docs gamma.', 'docs note alone');
    fs.writeFileSync(path.join(dataDir, 'drift.json'), JSON.stringify({ t: 1, sets: { gamma: { docsBehindDays: 7, commitsSince: 1 } } }));
    assert.strictEqual(driftNote('d2'), '', 'docs exactly 7 days old: no note');
    fs.writeFileSync(path.join(dataDir, 'drift.json'), JSON.stringify({ t: 1, sets: { alpha: { commits: 4, changed: 12, docsBehindDays: 9, commitsSince: 5 } } }));
    assert.strictEqual(driftNote('d3'), '⚠️ gabriel: The alpha graph is 4 commits behind (12 code files changed). Run /gabriel:refresh-docs alpha. The alpha docs were last checked 9 days before the latest code commit (5 commits since). Run /gabriel:refresh-docs alpha.', 'graph and docs sentences together');
    fs.writeFileSync(path.join(dataDir, 'drift.json'), JSON.stringify({ t: 1, sets: { delta: { docsBehindDays: null, neverChecked: true, commits: 2, changed: 11 } } }));
    assert.strictEqual(driftNote('d4'), '⚠️ gabriel: The delta graph is 2 commits behind (11 code files changed). Run /gabriel:refresh-docs delta. The delta docs were never checked with /gabriel:refresh-docs.', 'never checked, with a graph drift of 10+');
    fs.writeFileSync(path.join(dataDir, 'drift.json'), JSON.stringify({ t: 1, sets: { delta: { docsBehindDays: null, neverChecked: true, commits: 2, changed: 3 } } }));
    assert.strictEqual(driftNote('d5'), '', 'never checked with a small drift: stay quiet');
    // docs-checked: records the repo HEAD and its commit time; a set without a repo is refused (temp git repo, fixed commit date)
    const dcRepo = path.join(home, 'dc-repo'), dcEnv = { ...process.env, GIT_COMMITTER_DATE: '2026-01-05T00:00:00Z', GIT_AUTHOR_DATE: '2026-01-05T00:00:00Z' };
    w('dc-repo/src/a.js', 'x\n');
    require('node:child_process').execFileSync('git', ['-C', dcRepo, 'init', '-q']);
    require('node:child_process').execFileSync('git', ['-C', dcRepo, 'add', '.']);
    require('node:child_process').execFileSync('git', ['-C', dcRepo, '-c', 'user.name=t', '-c', 'user.email=t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'c'], { env: dcEnv });
    const dcHead = require('node:child_process').execFileSync('git', ['-C', dcRepo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    fs.writeFileSync(path.join(dataDir, 'projects.json'), JSON.stringify({ version: 1, tips: false, projects: [
      { name: 'dc', label: 'DC', root: path.join(home, 'dc-docs'), repo: dcRepo },
      { name: 'nr', label: 'NR', root: path.join(home, 'nr-docs') },
    ] }));
    const dcOut = runBrain(home, ['docs-checked', 'dc']);
    assert.strictEqual(dcOut.stdout.trim(), 'docs checked for dc at ' + dcHead.slice(0, 7), dcOut.stdout + dcOut.stderr);
    const dcRec = JSON.parse(fs.readFileSync(path.join(dataDir, 'docs-checked.json'), 'utf8')).dc;
    assert.deepStrictEqual({ commit: dcRec.commit, t: dcRec.t }, { commit: dcHead, t: Date.UTC(2026, 0, 5) / 1000 }, 'docs-checked records HEAD and its commit time');
    const nrOut = runBrain(home, ['docs-checked', 'nr']);
    assert.strictEqual(nrOut.status, 1, 'a set with no repo is refused');
    assert.ok(nrOut.stdout.includes('has no repo folder'), nrOut.stdout);
    // docs-checked clears the miss lists (seen/<sid>.miss and seen/<sid>.missnote), so the count starts again
    const { isRepoCodeFile } = require(brainPath);
    assert.strictEqual(isRepoCodeFile('dc', path.join(dcRepo, 'README.md')), false, 'isRepoCodeFile: a .md file inside the repo is not code');
    assert.strictEqual(isRepoCodeFile('dc', path.join(home, 'outside.js')), false, 'isRepoCodeFile: a .js file outside the repo is not counted');
    assert.strictEqual(isRepoCodeFile('nr', path.join(home, 'nr-docs', 'a.js')), false, 'isRepoCodeFile: a set with no repo returns false');
    // (the true case needs a built map with code files; not built in this test)
    noteMiss('x1', 'a.cs'); fs.writeFileSync(path.join(dataDir, 'seen', 'x1.missnote'), '');
    runBrain(home, ['docs-checked', 'dc']);
    assert.ok(!fs.existsSync(path.join(dataDir, 'seen', 'x1.miss')), 'docs-checked removes the .miss list');
    assert.ok(!fs.existsSync(path.join(dataDir, 'seen', 'x1.missnote')), 'docs-checked removes the .missnote mark');
    console.log('warnings: drift and miss notes checked');
  }
  finished = true;
  console.log('ALL PASSED');
})().catch((err) => { console.error(err); process.exit(1); });
