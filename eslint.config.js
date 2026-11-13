// Lint: ESLint's recommended rules only (real bugs: undefined names, unused code, unreachable code). No style rules.
// Run: npm run lint. test/test-lint.js runs it inside npm test.
'use strict';
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'private/**', 'graphify-out/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],   // unused args and catch params are common and harmless here
      'no-empty': ['error', { allowEmptyCatch: true }],                      // fail-open catches are on purpose
    },
  },
];
