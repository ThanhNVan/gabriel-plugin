'use strict';
// Graph check: counts nodes and links, then flags dangling links, excluded nodes and a graph built at another commit. Never prints the graph.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_EXCLUDE = 'private/,node_modules/,graphify-out/';

function parseArgs(argv) {
  const opts = { graph: null, repo: null, exclude: DEFAULT_EXCLUDE };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo' && argv[i + 1] !== undefined) opts.repo = path.resolve(argv[++i]);
    else if (argv[i] === '--exclude' && argv[i + 1] !== undefined) opts.exclude = argv[++i];
    else if (!opts.graph && !argv[i].startsWith('--')) opts.graph = path.resolve(argv[i]);
    else throw new Error(`unknown or incomplete argument: ${argv[i]}`);
  }
  if (!opts.graph) throw new Error('usage: graph-stats.js <graph.json> [--repo <repo>] [--exclude private/,node_modules/,graphify-out/]');
  opts.excludes = opts.exclude.split(',').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean);
  return opts;
}

// A link end is an id string, or an object with an id (node-link style).
const endId = (end) => String(end !== null && typeof end === 'object' ? end.id : end);

function headCommit(repo) {
  const r = spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (r.status !== 0) return { error: (r.stderr || (r.error && r.error.message) || 'git failed').trim() };
  return { sha: r.stdout.trim() };
}

try {
  const opts = parseArgs(process.argv.slice(2));
  const stats = [];
  const hits = [];
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(opts.graph, 'utf8'));
  } catch (e) {
    hits.push(`unreadable graph: ${e.message}`);
  }

  if (data) {
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const links = Array.isArray(data.links) ? data.links : Array.isArray(data.edges) ? data.edges : [];
    const ids = new Set(nodes.map((n) => String(n.id)));
    const commit = data.built_at_commit === undefined ? null : data.built_at_commit;

    stats.push(`nodes ${nodes.length}`, `links ${links.length}`);
    if (nodes.some((n) => n.community !== undefined)) {
      stats.push(`communities ${new Set(nodes.map((n) => n.community).filter((c) => c !== undefined)).size}`);
    }
    stats.push(`built_at_commit ${commit === null ? 'none' : commit}`);

    for (const link of links) {
      const src = endId(link.source);
      const tgt = endId(link.target);
      if (!ids.has(src) || !ids.has(tgt)) hits.push(`dangling link: ${src} -> ${tgt}`);
    }
    for (const node of nodes) {
      if (typeof node.source_file !== 'string') continue;
      const file = node.source_file.replace(/\\/g, '/');
      if (opts.excludes.some((ex) => file.includes(ex))) hits.push(`excluded node: ${node.id} ${file}`);
    }

    if (opts.repo) {
      const head = headCommit(opts.repo);
      if (head.error) hits.push(`commit check failed: ${head.error}`);
      else if (commit !== head.sha) hits.push(`commit mismatch: graph ${commit === null ? 'none' : commit} head ${head.sha}`);
    }
  }

  const out = [...stats, ...hits, `graph-stats: ${hits.length} hits`];
  console.log(out.join('\n'));
  process.exitCode = hits.length ? 1 : 0;
} catch (e) {
  console.error(`graph-stats: ${e.message}`);
  process.exitCode = 2;
}
