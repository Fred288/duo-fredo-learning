import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Türkisch: I/ı und İ/i, daher nie die locale-unabhängigen Varianten.
      'no-restricted-properties': [
        'error',
        { property: 'toLowerCase', message: "Use toLocaleLowerCase('tr') for Turkish text." },
        { property: 'toUpperCase', message: "Use toLocaleUpperCase('tr') for Turkish text." },
      ],
    },
  },
  prettier,
);
