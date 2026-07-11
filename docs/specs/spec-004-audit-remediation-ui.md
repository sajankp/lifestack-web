# Feature Spec: Frontend Usability and Security Hardening
**Status:** Implemented (refresh mutex in commit `a306a87`; package.json dependency move in a later commit).
**Spec ID:** 004

## 1. Overview
This specification details the frontend web modifications necessary to align with the backend security updates and resolve usability/packaging anomalies. It establishes input format validators, fixes runtime vs dev dependency separation, standardizes test parameters, and prevents session refresh locks.

## 2. Requirements

### 2.1 Package Metadata (Dependency Hygiene)
- Move core runtime libraries from `devDependencies` to `dependencies` in `lifestack-web/package.json`.
- Affected packages: `axios`, `@tanstack/react-query`, `react-router-dom`, `lucide-react`, `zustand`, `framer-motion`.

### 2.2 Client-Side Input Constraints
- In `RegisterPage.tsx`, update username input field to enforce:
  - Minimum length of 3, maximum length of 50.
  - Regex pattern attribute: `^[a-zA-Z0-9_-]+$`.
  - Accessible `title` validation tooltip.

### 2.3 User Enumeration and Authentication Messaging
- Standardize authentication failure feedback on `LoginPage.tsx` and `RegisterPage.tsx`.
- Return generic and user-friendly error copy for registration and login mismatches to prevent database username enumeration.

### 2.4 API Client Configuration & Test Default
- Set default `baseURL` in `src/services/api.ts` to `http://localhost:8000/v1` when `VITE_API_URL` is undefined, allowing `npm test -- --run` Vitest command to execute immediately on checkout.

### 2.5 Axios Interceptor refresh token race prevention
- Add a mutex/locking flag inside the interceptor setup in `src/services/api.ts` to prevent duplicate refresh token requests during concurrent 401s.
- Reject queued requests immediately upon refresh token failure using a `refreshFailed` short-circuit flag.

### 2.6 Numerical Input Sanitation
- Sanitize numerical fields on input submission screens (e.g. log transaction, create budget) to prevent submitting `NaN` or `Infinity` payloads. Use schema-level Zod validations or parsing boundaries.

## 3. Implementation Details

1. **Axios Token Refresh Interceptor**:
   - Add static tracking variables inside `src/services/api.ts` to track state:
     - `isRefreshing: boolean`
     - `refreshFailed: boolean`
   - If `refreshFailed` is true, immediately reject incoming 401 retries.
   - If `isRefreshing` is true, queue requests; if it fails, set `refreshFailed = true` and reject all.

2. **Username Validation**:
   - Update the HTML input element in `src/pages/RegisterPage.tsx` with pattern validation attributes.

## 4. Testing Plan
- Run `npm run lint` and `npm run build` to ensure typings and build bundles compile successfully.
- Verify Vitest executes without needing custom prefix arguments: `npm test -- --run`.
