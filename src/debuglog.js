'use strict';
// Debug log: one line per caught error, in <data>/debug.log. Off unless GABRIEL_DEBUG=1.
// Never throws, never prints. The file starts again when it passes 1 MB. Prompt text is never logged.
const fs = require('fs');
const path = require('path');
const paths = require('./paths.js');
const LIMIT = 1024 * 1024;

function debug(where, err) {
  try {
    if (process.env.GABRIEL_DEBUG !== '1') return;
    const file = path.join(paths.dataDir(), 'debug.log');
    const msg = String(err && err.message ? err.message : err).replace(/[\r\n]+/g, ' ');
    try { if (fs.statSync(file).size > LIMIT) fs.rmSync(file, { force: true }); } catch { /* no file yet */ }
    fs.appendFileSync(file, `${new Date().toISOString()} ${where}: ${msg}\n`);
  } catch { /* the folder cannot be written: skip */ }
}

module.exports = { debug };
