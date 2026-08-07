import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/__test__/**', 'src/components/showcase/**', 'e2e/**', 'playwright.config.ts', '.agents/**', '.claude/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // Audit archi 2026-08-07 (M3) — un `catch {}` totalement vide rend une
      // panne réelle indiscernable d'un no-op volontaire. Le code actuel n'en
      // contient AUCUN (tous portent au minimum un commentaire d'intention) :
      // cette règle verrouille cet état plutôt que de le laisser dériver.
      //
      // `allowEmptyCatch: false` (défaut de `no-empty`, réaffirmé ici pour que
      // l'intention soit lisible) : un catch délibérément silencieux doit
      // porter un commentaire expliquant POURQUOI l'erreur est ignorable.
      // Un commentaire suffit à satisfaire la règle — l'objectif est la
      // justification écrite, pas la gestion d'erreur cérémonielle.
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  }
);
