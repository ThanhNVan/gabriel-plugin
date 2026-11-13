// The host adapters. The engine (rules, map, history) does not know which host runs it; each adapter reads input and writes output its own way.
'use strict';
const HOSTS = { claude: require('./claude.js'), codex: require('./codex.js'), gemini: require('./gemini.js'), generic: require('./generic.js'), copilot: require('./copilot.js') };

// The adapter for a host name (claude when empty). Throws for an unknown name.
function get(name) {
  const key = String(name || 'claude').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(HOSTS, key)) throw new Error(`unknown host: ${name} (use claude, codex, gemini, copilot or generic)`);
  return HOSTS[key];
}

module.exports = { get, names: Object.keys(HOSTS) };
