# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Lifestack Frontend Notes

### Investing module behavior
- Investing forms now use backend-managed finance references:
  - `GET /v1/finance/accounts`
  - `GET /v1/finance/currencies`
- Holdings and cash creation should use selector-driven values from those endpoints (not free-text currency/account inputs).
- Investing summary supports valuation-state semantics:
  - `single_currency_native`
  - `multi_currency_unconverted`
  - `conversion_required`
  - `converted_available`
- When conversion is unavailable, totals may be `null`; UI should display `N/A` and show `valuation_status` plus `reporting_currency`.

### Look-through analytics (Spec 012)
- Frontend now supports:
  - `GET /v1/investing/instruments`
  - `POST /v1/investing/instruments`
  - `POST /v1/investing/instruments/{instrument_id}/constituents`
  - `GET /v1/investing/analytics/exposure?as_of=YYYY-MM-DD`
  - `GET /v1/investing/analytics/overlap?as_of=YYYY-MM-DD`
- Investing page includes a `Look-through Analytics` tab with:
  - instrument creation
  - constituent seeding (manual bootstrap for now)
  - exposure table and overlap summary
- Analytics responses may be partial; UI surfaces `analysis_status`, coverage, and warnings.

### Dashboard budget remaining
- The dashboard `Budget remaining` card is computed from:
  - `spending.month_budget - spending.month_spent`
- `month_budget` is sourced from monthly budgets for the current month. If no monthly budget exists, UI should show `N/A`.

### Tests
- Run unit/integration tests:
  - `npm test -- --run`
- Key page-level tests:
  - `src/pages/InvestingPage.test.tsx`
  - `src/pages/DashboardPage.test.tsx`
- Browser E2E (Playwright):
  - `npm run test:e2e`
  - E2E spec: `e2e/investing-lookthrough.spec.ts`

### E2E Strategy (Scope Item)
- Current frontend Playwright tests mock API responses for fast UI regression checks.
- A true full-stack FE+BE+DB E2E suite is recommended as a dedicated integration repo because FE and BE are separate repositories.
- Proposed future setup:
  - integration repo with compose orchestration for frontend + backend + postgres
  - real API contracts (no route mocks)
  - seeded deterministic test data and cross-repo CI gate
