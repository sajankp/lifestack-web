# Spec-012: Streamline Spending Page to 4 Core Planning Tabs

**Created:** 2026-10-02  
**Status:** Approved  
**Scope:** Web (`lifestack-web/src/pages/SpendingPage.tsx`, `src/pages/spending/`)  
**Depends on:** spec-097 (unified money flow)  
**Branch:** `feat/streamline-spending-page`  

---

## 1. Problem & Context

In **Spec-097 (Unified Money Flow)**, `/money` ([MoneyFlowPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/MoneyFlowPage.tsx)) became the central operational hub for all cash accounts, account-level ledgers with running balances, transfer creation/editing, and the unified chronological activity feed (spending, transfers, orders, dividends).

However, the legacy [SpendingPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/SpendingPage.tsx) still contained:
- The `transactions` tab and `ledger` (`account-activity`) tab, creating duplicate transaction lists, transfer lookup queries (`useInfiniteQuery` across all transfers), and transfer edit/delete modals.
- Residual dead files (`NetWorthPage.tsx`, `investing/CashTab.tsx`) that were no longer routed or imported.

Users need `/spending` to be a lean, high-value command center focused purely on **financial planning, rules, and analytics** without duplicate transaction/transfer ledgers.

---

## 2. Solution & Design

### A. 4-Tab Architecture for `/spending`

Streamline `SpendingPage` to the 4 core planning and analytics tabs:

| Tab | Subpath | Purpose & Capabilities |
| :--- | :--- | :--- |
| **Recurring Rules** | `/spending/recurring` | View, create, edit, pause, and deactivate recurring transaction rules. |
| **Budgets** | `/spending/budgets` | Monthly category budgets, targets, roll-overs, and variance tracking. |
| **KPIs** | `/spending/kpis` | Custom financial KPIs, breach indicators, and threshold monitoring. |
| **Analytics** | `/spending/analytics` | Category breakdowns, Spend Pacing card, and historical spend trends. |

### B. Routing & Redirection
- Default route `/spending` redirects to `/spending/recurring`.
- Legacy routes `/spending/transactions` and `/spending/account-activity` gracefully redirect to `/money`.
- Header "Add expense" button links to `/money?new=1` which automatically opens the transaction modal.

### C. Dead Code & Redundancy Removal
1. **Remove redundant tabs from `src/pages/spending/`**:
   - Removed `TransactionsTab.tsx` and `LedgerTab.tsx` (and `LedgerTab.test.tsx`).
   - Removed `NetWorthPage.tsx` / `NetWorthPage.test.tsx` and `investing/CashTab.tsx` / `CashTab.test.tsx`.
2. **Streamline `SpendingPage.tsx`**:
   - Eliminated `useInfiniteQuery` for transfers, transfer accounts state, and transfer edit/delete modals from `SpendingPage.tsx`.
   - Retained category management modals, tag modals, budget modals, and recurring transaction modals.

---

## 3. Test & Verification Plan

1. **Vitest Unit Tests**:
   - `SpendingPage.test.tsx`: Verify all 4 tabs (`recurring`, `budgets`, `kpis`, `analytics`) render, tab routing redirects work, and modal interactions succeed.
   - `MoneyFlowPage.test.tsx`: Verify `/money` handles all transaction/transfer CRUD and `?new=1` query param.
2. **ESLint & TypeScript**:
   - `npm run lint` — 0 errors.
   - `npx tsc -b` — 0 errors.
3. **Full Suite**:
   - `npx vitest run` across all web test files.
