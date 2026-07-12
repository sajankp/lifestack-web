import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import security from 'eslint-plugin-security'
import { defineConfig, globalIgnores } from 'eslint/config'

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
])
