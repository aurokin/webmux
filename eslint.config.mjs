import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import globals from 'globals'

const commonGlobals = {
  ...globals.browser,
  ...globals.node,
  Bun: 'readonly',
}

const complexityRules = {
  complexity: ['error', 18],
  'max-depth': ['error', 4],
  'max-lines-per-function': ['error', { max: 220, skipBlankLines: true, skipComments: true }],
  'max-params': ['error', 5],
}

export default [
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/*.tsbuildinfo', 'bun.lock'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: commonGlobals,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: [
      'packages/bridge/src/**/*.{ts,tsx}',
      'packages/client/src/**/*.{ts,tsx}',
      'packages/shared/src/**/*.{ts,tsx}',
      'packages/cli/src/**/*.{ts,tsx}',
    ],
    rules: complexityRules,
  },
  {
    files: ['**/*.test.ts', '**/*.integration.test.ts'],
    rules: {
      complexity: 'off',
      'max-depth': 'off',
      'max-lines-per-function': 'off',
      'max-params': 'off',
    },
  },
]
