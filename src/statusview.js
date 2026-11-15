'use strict';
// The status block of one doc set, for `brain.js mk-status all`. Pure: no file reads, no console output.
// v = { label, name, s, graphPath, graphExists, repo, repoExists, fix }; s is what mk.status() returns.

// The lines of one doc set: a header with the state word, then the map, graph and repo lines, then the fix line.
function statusBlock(v) {
  const s = v.s || {};
  let state = 'ok';
  if (v.graphPath && !v.graphExists) state = 'GRAPH MISSING';
  else if (!s.nDoc) state = 'no map';
  else if (s.stale) state = 'STALE';
  else if (v.repo && !v.repoExists) state = 'REPO MISSING';

  const lines = [v.label + '  ' + state];
  if (s.nDoc) {
    const built = new Date(s.built).toISOString().slice(0, 16).replace('T', ' ');   // UTC, the same as the old one-line status
    lines.push(`  map    ${s.nCode} code + ${s.nDoc} doc neurons, built ${built}${s.mapCommit ? ', @' + s.mapCommit.slice(0, 8) : ''}`);
  }
  if (v.graphPath) lines.push('  graph  ' + v.graphPath + (v.graphExists ? '' : '   GRAPH MISSING'));
  if (v.repo) lines.push('  repo   ' + v.repo + (v.repoExists ? '' : '   REPO MISSING'));
  else if (v.graphPath) lines.push(`  repo   none (add-docs ${v.name} --repo <folder> --relink)`);
  if (v.fix) lines.push('  fix: ' + v.fix);
  return lines;
}

module.exports = { statusBlock };
