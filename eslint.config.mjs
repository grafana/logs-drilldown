import { FlatCompat } from '@eslint/eslintrc';
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
// Plugins
import jsxa11y from 'eslint-plugin-jsx-a11y';
import sortPlugin from 'eslint-plugin-sort';

import baseConfig from './.config/eslint.config.mjs';

const compat = new FlatCompat();

export default defineConfig([
  {
    ignores: [
      '**/CHANGELOG.md',
      '**/README.md',
      '**/dist/',
      '**/node_modules/',
      '**/package.json',
      './.gitignore',
      '**/.config/',
      '**/.eslintignore',
      '**/.prettierignore',
      '**/.husky/',
      '**/project-words.txt',
      '**/yarn.lock',
      '**/tsconfig-for-bundle-types.json',
      '**/playwright-report/',
      '**/*.md',
      '**/*.yaml',
      '**/*.json',
      '**/*.svg',
      '**/*.river',
      '**/*.sh',
      '**/*.log',
      '**/npm-debug.log*',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      '**/.pnpm-debug.log*',
      '**/.yarn/',
      '**/.yarnrc.yml',
      '**/pids',
      '**/*.pid',
      '**/*.seed',
      '**/*.pid.lock',
      '**/lib-cov',
      '**/coverage',
      '**/artifacts/',
      '**/work/',
      '**/ci/',
      '**/.idea',
      '**/.eslintcache',
      '**/.DS_Store',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      'playwright/.cache/',
      'playwright/.auth/',
      'generator/vendor/',
      'generator/generator',
      '**/.env',
    ],
  },
  ...baseConfig,

  ...compat.extends(
    'plugin:jsx-a11y/strict',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript'
  ),

  {
    plugins: {
      'jsx-a11y': jsxa11y,
      sort: sortPlugin,
      import: importPlugin,
    },

    rules: {
      'no-restricted-globals': ['error', 'location'],
      'no-cond-assign': ['error', 'except-parens'],
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off',

      'sort/imports': [
        'error',
        {
          groups: [
            { type: 'side-effect', order: 20 },
            { regex: '^@grafana', order: 30 },
            { regex: '^react$', order: 10 },
            { type: 'dependency', order: 15 },
            { regex: '^.+\\.s?css$', order: 50 },
            { type: 'other', order: 40 },
          ],
          separator: '\n',
        },
      ],

      'sort/object-properties': 'off',
      'sort/type-properties': 'error',
      'sort/string-unions': 'error',
      'sort/exports': 'off',
    },
  },

  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-globals': 'off',
      'react/jsx-key': ['warn', { checkFragmentShorthand: true }],
    },
  },

  // Grafana Scenes useStyles2 hook throws a warning in scene classes
  // Wherever possible pull the scene component out into a function to avoid this warning
  {
    files: ['src/Components/**/*.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
]);
