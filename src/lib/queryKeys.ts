/**
 * Central registry of TanStack Query key builders.
 *
 * All keys are `['module', 'resource', ...params]` so a mutation can
 * prefix-invalidate an entire module (`queryKeys.spending.all`) instead of
 * listing every resource key by hand, and so two unrelated features never
 * accidentally share a cache prefix (e.g. spending categories vs.
 * MasterConfigPage categories).
 *
 * `investing`, `finance`, `dashboard`, and `exports` already used this
 * shape before this file existed — they're included here for a single
 * import source, but their key *values* are unchanged.
 */
export const queryKeys = {
  // ── Todo ──────────────────────────────────────────────────────────────────
  todo: {
    all: ['todo'] as const,
    list: <T extends unknown[]>(...params: T) => ['todo', 'list', ...params] as const,
    recurring: <T extends unknown[]>(...params: T) => ['todo', 'recurring', ...params] as const,
  },

  // ── Health ────────────────────────────────────────────────────────────────
  health: {
    all: ['health'] as const,
    medications: <T extends unknown[]>(...params: T) =>
      ['health', 'medications', ...params] as const,
    schedule: <T extends unknown[]>(...params: T) => ['health', 'schedule', ...params] as const,
    weight: <T extends unknown[]>(...params: T) => ['health', 'weight', ...params] as const,
    weightTrend: <T extends unknown[]>(...params: T) =>
      ['health', 'weight-trend', ...params] as const,
  },

  // ── Spending ──────────────────────────────────────────────────────────────
  // Previously bare keys: ['categories'], ['transactions', ...], ['budgets', ...],
  // ['recurring', ...], ['transactions-summary', ...].
  // Migrated to module-prefixed form to prevent cross-page cache collisions
  // (MasterConfigPage used ['categories'] as a prefix that leaked into
  // SpendingPage's cache — both are now scoped independently).
  spending: {
    all: ['spending'] as const,
    categories: <T extends unknown[]>(...params: T) =>
      ['spending', 'categories', ...params] as const,
    categoryGroups: <T extends unknown[]>(...params: T) =>
      ['spending', 'category-groups', ...params] as const,
    transactions: <T extends unknown[]>(...params: T) =>
      ['spending', 'transactions', ...params] as const,
    summary: <T extends unknown[]>(...params: T) => ['spending', 'summary', ...params] as const,
    budgets: <T extends unknown[]>(...params: T) => ['spending', 'budgets', ...params] as const,
    recurring: <T extends unknown[]>(...params: T) => ['spending', 'recurring', ...params] as const,
    kpis: <T extends unknown[]>(...params: T) => ['spending', 'kpis', ...params] as const,
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: {
    all: ['notifications'] as const,
    list: <T extends unknown[]>(...params: T) => ['notifications', 'list', ...params] as const,
    preferences: () => ['notifications', 'preferences'] as const,
    pushSubscriptions: () => ['notifications', 'push-subscriptions'] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },

  // ── Net Worth ──────────────────────────────────────────────────────────────
  netWorth: {
    all: ['net-worth'] as const,
    summary: () => ['net-worth'] as const,
    history: <T extends unknown[]>(...params: T) => ['net-worth', 'history', ...params] as const,
    userPoints: () => ['net-worth', 'user-points'] as const,
    userFxRates: () => ['net-worth', 'user-fx-rates'] as const,
  },

  // ── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: {
    all: ['dashboard'] as const,
    summary: () => ['dashboard', 'summary'] as const,
    insights: () => ['dashboard', 'insights'] as const,
    briefing: () => ['dashboard', 'briefing'] as const,
  },

  // ── Summaries ──────────────────────────────────────────────────────────────
  summaries: {
    all: ['summaries'] as const,
    weeklyLatest: () => ['summaries', 'weekly', 'latest'] as const,
  },

  // ── Exports ────────────────────────────────────────────────────────────────
  exports: {
    all: ['exports'] as const,
  },

  // ── Imports ────────────────────────────────────────────────────────────────
  imports: {
    all: ['imports'] as const,
  },

  // ── Investing ──────────────────────────────────────────────────────────────
  // Centralized here for single import source.
  investing: {
    all: ['investing'] as const,
    summary: () => ['investing', 'summary'] as const,
    performance: {
      summary: () => ['investing', 'performance', 'summary'] as const,
      returns: () => ['investing', 'performance', 'returns'] as const,
    },
    holdings: () => ['investing', 'holdings'] as const,
    instruments: () => ['investing', 'instruments'] as const,
    orders: <T extends unknown[]>(...params: T) => ['investing', 'orders', ...params] as const,
    ordersByHolding: (symbol?: string, accountId?: string | null) =>
      ['investing', 'orders', 'by-holding', symbol, accountId] as const,
    cashBalances: <T extends unknown[]>(...params: T) =>
      ['investing', 'cash-balances', ...params] as const,
    dividends: <T extends unknown[]>(...params: T) =>
      ['investing', 'dividends', ...params] as const,
    corporateActions: <T extends unknown[]>(...params: T) =>
      ['investing', 'corporate-actions', ...params] as const,
    exposure: (asOf: string) => ['investing', 'analytics', 'exposure', asOf] as const,
    overlap: (asOf: string) => ['investing', 'analytics', 'overlap', asOf] as const,
  },

  // ── Finance ────────────────────────────────────────────────────────────────
  // Centralized for single import source.
  finance: {
    all: ['finance'] as const,
    accounts: <T extends unknown[]>(...params: T) => ['finance', 'accounts', ...params] as const,
    currencies: <T extends unknown[]>(...params: T) =>
      ['finance', 'currencies', ...params] as const,
    settings: <T extends unknown[]>(...params: T) => ['finance', 'settings', ...params] as const,
    transfers: <T extends unknown[]>(...params: T) => ['finance', 'transfers', ...params] as const,
    reconciliation: <T extends unknown[]>(...params: T) =>
      ['finance', 'reconciliation', ...params] as const,
  },

  // ── Master Config (scoped variants to avoid cross-page collisions) ──────────
  masterConfig: {
    categories: () => ['categories', 'master-config'] as const,
    categoryGroups: () => ['category-groups', 'master-config'] as const,
  },
} as const;
