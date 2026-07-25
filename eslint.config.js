import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      security.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // eslint-plugin-react-hooks 7.1.x's recommended preset promotes these
      // two React Compiler advisory checks to hard errors (they were off/warn
      // under 7.0.x, the version this repo ran before the eslint 9->10 bump
      // forced a plugin bump too). They flag real, pre-existing patterns
      // across TransferModal/InvestingPage/MasterConfigPage/TodoPage/
      // HoldingsTab that are worth a dedicated look, but fixing them is an
      // app-logic change, not a lint-tooling one -- keep as warnings here so
      // the dependency bump doesn't silently bundle an unrelated refactor.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // spec-075: money/number formatting must go through
    // src/utils/numberFormat.ts (explicit locale/decimal-places from the
    // display profile), not ad-hoc Intl.NumberFormat/toLocaleString calls
    // scattered across pages -- those silently use the browser's implicit
    // locale and disagree with each other. Intl.DateTimeFormat/date
    // toLocaleString are out of scope here (see src/utils/dateFormat.ts).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/utils/numberFormat.ts', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']",
          message:
            'Use formatCurrency/formatNumber from src/utils/numberFormat.ts instead of Intl.NumberFormat directly, so the locale/decimal-places display profile is honored (spec-075).',
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleString'][arguments.length=0]",
          message:
            'toLocaleString() with no locale argument uses the browser implicit locale. Pass an explicit locale (e.g. from useDisplayProfile()), or use formatNumber from src/utils/numberFormat.ts (spec-075).',
        },
      ],
    },
  },
]);
