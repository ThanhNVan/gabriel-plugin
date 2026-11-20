'use strict';
// Pins one or more doc sets to one Claude session ("gabriel use <name>..."; "gabriel use +<name>" adds; "gabriel use auto" clears pins and turns the map on; "gabriel use manual" turns it off).
// Files live in data/seen/ next to the dedupe files, which dedupe removes after 7 days.
// Pin file: one name per line.
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./rules.js');

const ID = /^[\w-]+$/;
const WORD = /^\+?[\w-]+$/;
const USE = /^\s*gabriel\s+use\s+(.+?)\s*$/i;
const MAX_PINS = 5;

// C1b: one word after "use" is always a command. 2..MAX_PINS+1 words are a command only when every word is a plain name.
function parsePin(prompt) {
  if (typeof prompt !== 'string') return null;
  const m = prompt.match(USE);
  if (!m) return null;
  const words = m[1].split(/\s+/);
  if (words.length === 1) {
    if (words[0].toLowerCase() === 'auto') return { auto: true };
    if (words[0].toLowerCase() === 'manual') return { manual: true };
  } else {
    if (words.length > MAX_PINS + 1) return null;
    if (!words.every((w) => WORD.test(w))) return null;
    if (words.some((w) => ['auto', 'manual'].includes(w.toLowerCase()))) return null;
  }
  if (words.every((w) => w.startsWith('+') && WORD.test(w))) return { add: words.map((w) => w.slice(1)) };   // "+" alone or "++a": a name, so the note says it is unknown
  return { names: words.map((w) => (WORD.test(w) ? w.replace(/^\+/, '') : w)) };
}

const seenFile = (home, sessionId) => path.join(dataDir(home), 'seen', sessionId + '.pin');

function getPins(home, sessionId) {
  try {
    if (typeof sessionId !== 'string' || !ID.test(sessionId)) return [];
    const names = [];   // duplicates dropped and at most MAX_PINS names, so a corrupt or hand-edited file cannot flood the note
    for (const s of fs.readFileSync(seenFile(home, sessionId), 'utf8').split(/\r?\n/)) {
      const n = s.trim();
      if (n && !names.includes(n)) names.push(n);
      if (names.length >= MAX_PINS) break;
    }
    return names;
  } catch { return []; }
}

function setPins(home, sessionId, names) {
  try {
    if (typeof sessionId !== 'string' || !ID.test(sessionId)) return false;
    const file = seenFile(home, sessionId);
    if (names === null || names.length === 0) { fs.rmSync(file, { force: true }); return true; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, names.join('\n'));
    return true;
  } catch { return false; }
}

// Refresh the pin file's mtime to now (its age is the 7-day cleanup clock in brain.js dedupe). True when touched; false with no file or a bad id. Never throws.
function touchPin(home, sessionId) {
  try {
    if (typeof sessionId !== 'string' || !ID.test(sessionId)) return false;
    const file = seenFile(home, sessionId);
    if (!fs.existsSync(file)) return false;
    const now = new Date();
    fs.utimesSync(file, now, now);
    return true;
  } catch { return false; }
}

// The session's map mode: 'auto' or 'manual' from seen/<sid>.mode, or null when the session has not chosen (projects.json "mode" applies).
const modeFile = (home, sessionId) => path.join(dataDir(home), 'seen', sessionId + '.mode');
function getMode(home, sessionId) {
  try {
    if (typeof sessionId !== 'string' || !ID.test(sessionId)) return null;
    const m = fs.readFileSync(modeFile(home, sessionId), 'utf8').trim();
    return m === 'auto' || m === 'manual' ? m : null;
  } catch { return null; }
}
function setMode(home, sessionId, mode) {
  try {
    if (typeof sessionId !== 'string' || !ID.test(sessionId)) return false;
    const file = modeFile(home, sessionId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, mode);
    return true;
  } catch { return false; }
}

// Edit distance (insert, delete, change one letter, swap two next letters), case-insensitive.
function distance(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// The name a typo most likely meant: at most 2 letters off and under half the word ("mkllez" -> "makillez"), else null. Ties keep the earlier name.
function nearName(word, names) {
  let best = null, bestD = Infinity;
  for (const n of names) {
    const d = distance(word, n);
    if (d > 0 && d <= 2 && d * 2 < word.length && d < bestD) { best = n; bestD = d; }
  }
  return best;
}

module.exports = { parsePin, getPins, setPins, touchPin, getMode, setMode, nearName, MAX_PINS };
