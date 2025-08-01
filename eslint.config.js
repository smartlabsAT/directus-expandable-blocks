import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 2021,
        sourceType: 'module'
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        NodeJS: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      vue
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off' // Use TypeScript's version instead
    }
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      '*.min.js',
      'test-cache-fix.js',
      'wiki/',
      '.qodana/',
      'scripts/'
    ]
  }
];