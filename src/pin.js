'use strict';
// Pins one doc set to one Claude session ("gabriel use <name>"; "gabriel use auto" clears it).
// Files live in data/seen/ next to the dedupe files, which dedupe removes after 7 days.
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./rules.js');

const ID = /^[\w-]+$/;
const USE = /^\s*gabriel\s+use\s+(\S+)\s*$/i;

function parsePin(prompt) {
  if (typeof prompt !== 'string') return null;
  const m = prompt.match(USE);
  if (!m) return null;
  return m[1].toLowerCase() === 'auto' ? { auto: true } : { name: m[1] };
}

const seenFile = (home, sessionId) => path.join(dataDir(home), 'seen', sessionId + '.pin');

function getPin(home, sessionId) {
  try {
    if (typeof sessionId !== 'string' || !ID.test(sessionId)) return null;
    const text = fs.readFileSync(seenFile(home, sessionId), 'utf8').trim();
    return text || null;
  } catch { return null; }
}

function setPin(home, sessionId, name) {
  try {
    if (typeof sessionId !== 'string' || !ID.test(sessionId)) return false;
    const file = seenFile(home, sessionId);
    if (name === null) { fs.rmSync(file, { force: true }); return true; }
    if (typeof name !== 'string' || !name) return false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, name);
    return true;
  } catch { return false; }
}

module.exports = { parsePin, getPin, setPin };
