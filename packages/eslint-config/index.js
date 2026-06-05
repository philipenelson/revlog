// @ts-check
const boundaries = require('eslint-plugin-boundaries');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    plugins: {
      '@typescript-eslint': tseslint,
      boundaries,
    },
    languageOptions: {
      parser: tsParser,
    },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'packages/domain/src/**' },
        { type: 'ui-tokens', pattern: 'packages/ui/tokens/src/**' },
        { type: 'ui-components', pattern: 'packages/ui/components/src/**' },
        { type: 'config', pattern: 'packages/*/src/**' },
        { type: 'app-web', pattern: 'apps/web/src/**' },
        { type: 'app-api', pattern: 'apps/api/src/**' },
        { type: 'app-mobile', pattern: 'apps/mobile/**' },
        { type: 'app-website', pattern: 'apps/website/src/**' },
      ],
      'boundaries/ignore': ['**/*.test.*', '**/*.spec.*'],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            // domain: no local deps
            { from: 'domain', allow: [] },
            // ui-tokens: no local deps, no react-native
            { from: 'ui-tokens', allow: [] },
            // ui-components: can use tokens only
            { from: 'ui-components', allow: ['ui-tokens'] },
            // apps
            { from: 'app-api', allow: ['domain'] },
            { from: 'app-web', allow: ['domain', 'ui-tokens', 'ui-components'] },
            { from: 'app-website', allow: ['domain', 'ui-tokens', 'ui-components'] },
            { from: 'app-mobile', allow: ['domain', 'ui-tokens'] },
          ],
        },
      ],
    },
  },
];

module.exports = config;
