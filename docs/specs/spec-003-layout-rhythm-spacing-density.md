# Feature Spec: Layout Rhythm & Spacing Density Normalization
**Status:** Implemented (commit `f385fd5`).
**Spec ID:** 003  

## 1. Overview
Lifestack has grown across multiple feature modules (auth, dashboard, todos, spending, investing, weekly summaries, imports, notifications, and master config). While each module is functional, they currently exhibit minor layout and spacing drifts:
- The global header spans the full viewport width with `px-8`, whereas the main page content uses `<PageShell>` which caps content at `max-w-[1400px]` and centers it (`mx-auto`). On large screens, this causes the header elements to detach from the page content alignment.
- The horizontal padding (gutters) mismatch on small viewports (`px-8` in the header vs `px-6` in `PageShell`).
- Vertical spacing between headers, filters, summary cards, and content blocks varies arbitrarily between `mb-4`, `mb-6`, `mb-8`, and `mb-10` across modules.

This spec proposes to establish a unified layout rhythm and spacing density standard across the entire application by:
1. Defining a single source of truth for the maximum content width via a CSS custom property.
2. Aligning the global header layout container to match the page content grid.
3. Standardizing layout gutter variables.
4. Normalizing vertical spacing, grid gaps, and card padding across all pages.

---

## 2. Goals
- **Perfect Horizontal Alignment:** Ensure that the global header's content and the main page content line up perfectly on all screen sizes (mobile, tablet, desktop, and ultra-wide screens).
- **Consistent Gutters:** Normalize the navigation-to-content gap so the left and right margins feel uniform across every viewport.
- **Rhythmic Vertical Flow:** Establish standard spacing increments between heroes, content blocks, cards, and interactive elements.
- **Improved Information Density:** Tighten layouts where needed (specifically spending and investing tables/lists) to improve readability.

---

## 3. Spacing & Layout Design Standards

We will define and implement the following standard design tokens:

### 3.1 CSS Variables / Theme Tokens (defined in `index.css`)
```css
:root {
  --max-content-width: 1400px;
  --page-padding-x: 1.5rem; /* px-6 for mobile */
}

@media (min-width: 640px) {
  :root {
    --page-padding-x: 2rem; /* px-8 for sm and above */
  }
}
```

### 3.2 Standard Layout Classes
- **Page Container / Shell:** `mx-auto w-full max-w-[var(--max-content-width)] px-[var(--page-padding-x)]`
- **Global Header Container:** Wrap the header contents in the same Page Container styling to align with page content.
- **Page Hero Margin:** `mb-8` (32px) standard margin below the page hero.
- **Section / Block Spacing:** `mb-6` (24px) or `space-y-6` for standard visual blocks (e.g. filters, tab lists, grid cards).
- **Grid Gaps:** `gap-6` (24px) for card grids and dashboard grids.
- **Card Padding:** `p-6` (24px) for metric cards and info blocks.

---

## 4. Proposed Changes by Component/Page

### 4.1 Styling Foundation (`index.css` & `PageShell.tsx`)
- Define CSS custom properties for `--max-content-width` and `--page-padding-x`.
- Update [PageShell.tsx](file:///root/projects/lifestack/lifestack-web/src/components/layout/PageShell.tsx) to consume these properties, ensuring consistent padding and max-width.

### 4.2 Global App Shell Layout ([App.tsx](file:///root/projects/lifestack/lifestack-web/src/App.tsx))
- Wrap the inner content of `<header>` in the standardized layout container matching `PageShell` alignment:
  ```tsx
  <header className="border-b border-slate-800/60 py-4">
    <div className="mx-auto w-full max-w-[var(--max-content-width)] px-[var(--page-padding-x)] flex items-center justify-between">
      {/* Header contents */}
    </div>
  </header>
  ```

### 4.3 Dashboard Page ([DashboardPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/DashboardPage.tsx))
- Remove redundant outer wrapper styles and rely on body backgrounds.
- Align the snapshot subtext spacing: replace the hacky `-mt-5 mb-6` with standard layout rhythm.
- Set metric cards and grids to use the normalized `gap-6` spacing.

### 4.4 Spending Page ([SpendingPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/SpendingPage.tsx))
- Normalize the summary card container margin to `mb-6` (currently `mb-10`).
- Ensure the transaction tables, tab content containers, and filter bars have unified spacing.

### 4.5 Investing Page ([InvestingPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/InvestingPage.tsx))
- Unify the summary cards margin to `mb-6` (currently mixed).
- Align form layouts, filters, and tab headers with the normalized grid.

### 4.6 Todo Page ([TodoPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/TodoPage.tsx))
- Unify the filters bar margin to `mb-6` (currently `mb-4`).
- Unify card list gaps and recurring rules sections.

### 4.7 Other Pages (Imports, Notifications, Weekly Summaries, Master Config)
- Verify and normalize spacing in [ImportsPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/ImportsPage.tsx), [NotificationsPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/NotificationsPage.tsx), [WeeklySummariesPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/WeeklySummariesPage.tsx), and [MasterConfigPage.tsx](file:///root/projects/lifestack/lifestack-web/src/pages/MasterConfigPage.tsx) to follow the new spacing standards.

---

## 5. Verification Plan

### Automated Verification
- Run local lint checks to ensure all TS/TSX formatting and imports are valid: `npm run lint`.
- Build the web assets to verify compile-time safety: `npm run build`.
- Run frontend unit tests to ensure page functionalities remain intact: `npm run test`.
- Run E2E tests to ensure page layouts do not break selector assumptions: `npm run test:e2e` (or using the Playwright stack).

### Manual Visual Checks
- Verify page elements (hero, content card borders, and buttons) align perfectly with the header items on viewport widths from mobile (320px) up to ultra-wide desktop.
- Confirm the vertical gap between components flows naturally without abrupt changes in spacing density.
