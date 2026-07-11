# Feature Spec: Spending Page Budget UX & Mobile Optimizations
**Status:** Implemented
**Spec ID:** 007

## 1. Overview
This specification details UX improvements for the Spending page. It addresses budget visibility guardrails on the Analytics tab, introduces a multi-month budget performance view under the Budgets tab, and optimizes the layout of mobile transaction cards to save vertical space.

## 2. Goals
- **Budget Guardrails Filter:** Filter out categories and category groups with no set budgets from the "Budget Guardrails & Performance" card.
- **Empty State Card:** If no category or group budgets are configured for the period, display a unified "No active budgets" empty state card instead of empty sections.
- **Multi-Month Budget View:** Provide a duration selector (`1 Month`, `3 Months`, `6 Months`, `12 Months`) on the Budgets tab, enabling users to see cumulative spending and budget performance over a historical range.
- **Compact Mobile Transactions:** Relocate the Edit and Delete actions on mobile/tablet transaction cards to be icon-only buttons positioned on the right side of the metadata row (sharing a line with the Date and Wallet source), eliminating the dedicated bottom action row.

## 3. Detailed Requirements

### 3.1 Budget Guardrails & Performance (Analytics Tab)
Removed from the Analytics tab by commit `3e2437d` to avoid duplicating budget data that now lives only on the Budgets tab (§3.2 / spec-064). The filtering/empty-state behavior below no longer applies here.

- Filter `sortedBudgetItems` (categories) and `sortedGroupBudgetItems` (groups) to only include items where `budget_amount` is not null.
- If both lists are empty (no budgets set at all):
  - Avoid rendering separate sections.
  - Render a premium empty state container with a friendly message: "No active budgets set for this period. Configure budgets in the Budgets tab to track limits." and a relevant icon.
- If at least one category budget or group budget is set:
  - If category budgets are present, render the category budget list. If none are present, do not render the category list.
  - If group budgets are present, render the group budget list. If none are present, do not render the group list.

### 3.2 Multi-Month Budgets Tab
- Add a duration selector control: `[1 Month, 3 Months, 6 Months, 12 Months]` in the Budgets tab container.
- If `1 Month` is selected (default):
  - Render the standard `BudgetsTab` monthly view with pagination, edit capability, and the custom month selector.
- If a multi-month range is selected (e.g., `3`, `6`, or `12` Months):
  - Calculate the start month based on the selected month and duration: `start_month = selected_month - (duration - 1)`.
  - Fetch cumulative performance data using the `getBudgetPerformance` API for the range `[start_month, selected_month]`.
  - Display the cumulative budgets in a grid showing `Total Spent`, `Total Budget`, `% utilized`, and `remaining`/`over` details.
  - Since this is a historical period aggregation, omit or hide the "Edit" button for multi-month items.
  - If no budgets are active in the range, show the standard empty state.

### 3.3 Mobile Transaction Card Actions
- In `TransactionsTab.tsx`'s mobile viewport layout (`lg:hidden` wrapper):
  - Remove the dedicated `<div className="mt-3 flex justify-end gap-2 border-t border-slate-700/40 pt-3">` action container.
  - Put the actions inline inside the metadata wrapper:
    - Left side: Date and Wallet source labels.
    - Right side: Icon-only buttons for Edit (cyan hover/active) and Delete (red hover/active), with no text labels to keep it compact.
  - Keep the tags wrapper between the description and this metadata/action bottom row.

## 4. Verification Plan

### 4.1 Automated Tests
- Run unit tests to confirm components mount correctly.
- Add test coverage for:
  - Filtering category/group budget performance items without budgets.
  - Rendering the empty state card when no budgets are present.
  - Rendering multi-month budget performance cards.
  - Mobile layout action alignment.

### 4.2 Manual Verification
- Visual inspection of the Budgets tab when switching durations.
- Check responsive behavior of the mobile transactions cards.
