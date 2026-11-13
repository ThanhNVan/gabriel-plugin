'use strict';
// Release check: package.json and the plugin manifest share one version, and CHANGELOG.md has a heading for it.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const pkg = read('package.json'), plugin = read('.claude-plugin/plugin.json'), market = read('.claude-plugin/marketplace.json');

assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'package.json needs a version');
assert.strictEqual(plugin.version, pkg.version, 'plugin.json and package.json versions differ');
assert.strictEqual(pkg.name, plugin.name, 'package.json and plugin.json names differ');
assert.ok(market.plugins.some((p) => p.name === plugin.name), 'marketplace.json does not list the plugin');
assert.ok(new RegExp(`^## ${pkg.version.replace(/\./g, '\\.')} \\(`, 'm').test(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8')), `CHANGELOG.md has no "## ${pkg.version} (" heading`);
console.log(`version ${pkg.version}: package.json, plugin.json and CHANGELOG.md agree`);
console.log('ALL PASSED');
