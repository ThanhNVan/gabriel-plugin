'use strict';
// Lint: ESLint's recommended rules over the whole repo (see eslint.config.js). Same as npm run lint.
// Needs the dev package eslint (npm install). Without it this test prints a skip line and exits 0.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const bin = path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');   // eslint's package exports hide bin/ from require.resolve
if (!fs.existsSync(bin)) { console.log('lint skipped (dev package eslint missing: run npm install)'); process.exit(0); }

const r = spawnSync(process.execPath, [bin, '.'], { cwd: ROOT, encoding: 'utf8' });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
if (r.status !== 0) { console.log(`lint failed (exit ${r.status})`); process.exitCode = 1; }
else console.log('ALL PASSED');
