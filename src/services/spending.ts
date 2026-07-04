import { z } from 'zod';
import api from './api';

// ─── Zod Schemas with default values for test resiliency ────────────────────

export const CategorySchema = z.object({
  public_id: z.string().default(''),
  name: z.string().default(''),
  is_system: z.boolean().default(false),
  color: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Category = z.infer<typeof CategorySchema>;

export interface CategoryCreate {
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface CategoryUpdate {
  name?: string | null;
  color?: string | null;
  icon?: string | null;
}

export const TransactionTypeSchema = z.enum(['income', 'expense']).default('expense');
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const SourceMetadataSchema = z.object({
  source_type: z.enum(['manual', 'imported', 'synced', 'assistant', 'extracted']).default('manual'),
  source_ref: z.string().nullable().default(null),
  origin: z.enum([
    'manual_entry',
    'bulk_import',
    'external_sync',
    'assistant_action',
    'document_extraction',
  ]).default('manual_entry'),
  label: z.string().default(''),
  import_public_id: z.string().nullable().default(null),
  import_module: z.string().nullable().default(null),
  import_row_number: z.number().nullable().default(null),
  rollback_supported: z.boolean().default(false),
});

export const TransactionSchema = z.object({
  public_id: z.string().default(''),
  category_id: z.string().default(''),
  account_id: z.string().nullable().default(null),
  amount: z.union([z.number(), z.string()]).default(0),
  type: TransactionTypeSchema,
  occurred_at: z.string().default(''),
  description: z.string().nullable().default(null),
  wallet_name: z.string().nullable().default(null),
  labels: z.string().nullable().default(null),
  source_type: z.enum(['manual', 'imported', 'synced', 'assistant', 'extracted']).optional(),
  source_ref: z.string().nullable().optional(),
  source_metadata: SourceMetadataSchema.optional(),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Transaction = z.infer<typeof TransactionSchema>;

export interface TransactionCreate {
  category_id: string;
  account_id?: string | null;
  amount: number;
  type: TransactionType;
  occurred_at: string;
  description?: string | null;
  wallet_name?: string | null;
  labels?: string | null;
}

export interface TransactionUpdate {
  category_id?: string | null;
  account_id?: string | null;
  amount?: number | null;
  type?: TransactionType | null;
  occurred_at?: string | null;
  description?: string | null;
  wallet_name?: string | null;
  labels?: string | null;
}

export const BudgetSchema = z.object({
  public_id: z.string().default(''),
  category_id: z.string().default(''),
  amount: z.union([z.number(), z.string()]).default(0),
  month_start: z.string().default(''),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Budget = z.infer<typeof BudgetSchema>;

export interface BudgetCreate {
  category_id: string;
  amount: number;
  month_start: string;
}

export interface BudgetUpdate {
  amount: number;
}

export const CategorySpendTotalSchema = z.object({
  category_id: z.string().default(''),
  total: z.union([z.number(), z.string()]).default(0),
});

export const TransactionSummarySchema = z.object({
  income_total: z.union([z.number(), z.string()]).default(0),
  expense_total: z.union([z.number(), z.string()]).default(0),
  net_total: z.union([z.number(), z.string()]).default(0),
  category_totals: z.array(CategorySpendTotalSchema).default([]),
});

export type TransactionSummary = z.infer<typeof TransactionSummarySchema>;

export const SpendingTrendPointSchema = z.object({
  month: z.string().default(''),
  total_income: z.union([z.number(), z.string()]).default(0),
  total_expense: z.union([z.number(), z.string()]).default(0),
  net: z.union([z.number(), z.string()]).default(0),
  transaction_count: z.number().default(0),
});

export const SpendingTrendResponseSchema = z.object({
  from: z.string().default(''),
  to: z.string().default(''),
  months: z.array(SpendingTrendPointSchema).default([]),
});

export type SpendingTrendResponse = z.infer<typeof SpendingTrendResponseSchema>;

export const CategoryBreakdownItemSchema = z.object({
  category_id: z.string().default(''),
  category_name: z.string().default(''),
  amount: z.union([z.number(), z.string()]).default(0),
  pct_of_total: z.number().default(0),
  transaction_count: z.number().default(0),
});

export const CategoryBreakdownOtherSchema = z.object({
  amount: z.union([z.number(), z.string()]).default(0),
  pct_of_total: z.number().default(0),
  category_count: z.number().default(0),
});

export const CategoryBreakdownResponseSchema = z.object({
  from: z.string().default(''),
  to: z.string().default(''),
  type: TransactionTypeSchema,
  total: z.union([z.number(), z.string()]).default(0),
  categories: z.array(CategoryBreakdownItemSchema).default([]),
  other: CategoryBreakdownOtherSchema.nullable().default(null),
});

export type CategoryBreakdownResponse = z.infer<typeof CategoryBreakdownResponseSchema>;

export const BudgetPerformanceItemSchema = z.object({
  category_id: z.string().default(''),
  category_name: z.string().default(''),
  budget_amount: z.union([z.number(), z.string()]).nullable().default(null),
  actual_amount: z.union([z.number(), z.string()]).default(0),
  utilization_pct: z.number().nullable().default(null),
  remaining: z.union([z.number(), z.string()]).nullable().default(null),
  status: z.enum(['on_track', 'warning', 'exceeded']).default('on_track'),
});

export const BudgetPerformanceTotalsSchema = z.object({
  total_budgeted: z.union([z.number(), z.string()]).default(0),
  total_actual: z.union([z.number(), z.string()]).default(0),
  overall_utilization_pct: z.number().nullable().default(null),
});

export const BudgetPerformanceResponseSchema = z.object({
  from: z.string().default(''),
  to: z.string().default(''),
  categories: z.array(BudgetPerformanceItemSchema).default([]),
  totals: BudgetPerformanceTotalsSchema.default({
    total_budgeted: 0,
    total_actual: 0,
    overall_utilization_pct: null,
  }),
});

export type BudgetPerformanceResponse = z.infer<typeof BudgetPerformanceResponseSchema>;

export const SavingsRatePointSchema = z.object({
  month: z.string().default(''),
  income: z.union([z.number(), z.string()]).default(0),
  expense: z.union([z.number(), z.string()]).default(0),
  savings: z.union([z.number(), z.string()]).default(0),
  savings_rate_pct: z.number().nullable().default(null),
});

export const SavingsRateTotalsSchema = z.object({
  total_income: z.union([z.number(), z.string()]).default(0),
  total_expense: z.union([z.number(), z.string()]).default(0),
  total_savings: z.union([z.number(), z.string()]).default(0),
  average_savings_rate_pct: z.number().nullable().default(null),
});

export const SavingsRateResponseSchema = z.object({
  from: z.string().default(''),
  to: z.string().default(''),
  months: z.array(SavingsRatePointSchema).default([]),
  period_totals: SavingsRateTotalsSchema.default({
    total_income: 0,
    total_expense: 0,
    total_savings: 0,
    average_savings_rate_pct: null,
  }),
});

export type SavingsRateResponse = z.infer<typeof SavingsRateResponseSchema>;

export const RecurringTransactionSchema = z.object({
  public_id: z.string().default(''),
  category_id: z.string().default(''),
  amount: z.union([z.number(), z.string()]).default(0),
  type: TransactionTypeSchema,
  description: z.string().nullable().default(null),
  frequency: z.string().default(''),
  interval: z.number().default(1),
  anchor_date: z.string().default(''),
  next_due_date: z.string().default(''),
  end_date: z.string().nullable().default(null),
  is_active: z.boolean().default(true),
  last_generated_at: z.string().nullable().default(null),
  monthly_mode: z.enum(['day_of_month', 'last_day', 'nth_weekday']).default('day_of_month'),
  by_weekday: z.number().nullable().default(null),
  by_ordinal: z.number().nullable().default(null),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type RecurringTransaction = z.infer<typeof RecurringTransactionSchema>;

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type MonthlyMode = 'day_of_month' | 'last_day' | 'nth_weekday';

export interface RecurringTransactionCreate {
  category_id: string;
  amount: number;
  type: TransactionType;
  description?: string | null;
  frequency: RecurringFrequency;
  interval: number;
  anchor_date: string;
  end_date?: string | null;
  monthly_mode?: MonthlyMode;
  by_weekday?: number | null;
  by_ordinal?: number | null;
}

export interface RecurringTransactionUpdate {
  amount?: number | null;
  description?: string | null;
  frequency?: RecurringFrequency | null;
  interval?: number | null;
  end_date?: string | null;
  is_active?: boolean | null;
  monthly_mode?: MonthlyMode | null;
  by_weekday?: number | null;
  by_ordinal?: number | null;
}

export const UpcomingTransactionItemSchema = z.object({
  recurring_public_id: z.string().default(''),
  category_id: z.string().default(''),
  amount: z.union([z.number(), z.string()]).default(0),
  type: TransactionTypeSchema,
  description: z.string().nullable().default(null),
  projected_date: z.string().default(''),
  frequency: z.string().default(''),
  interval: z.number().default(1),
});

export const UpcomingPreviewResponseSchema = z.object({
  days: z.number().default(0),
  from_date: z.string().default(''),
  to_date: z.string().default(''),
  items: z.array(UpcomingTransactionItemSchema).default([]),
});

export type UpcomingPreviewResponse = z.infer<typeof UpcomingPreviewResponseSchema>;

export const LedgerEntrySchema = z.object({
  public_id: z.string().default(''),
  entry_kind: z.enum(['transaction', 'transfer_out', 'transfer_in']).default('transaction'),
  category_id: z.string().nullable().default(null),
  account_id: z.string().nullable().default(null),
  amount: z.string().default(''),
  type: TransactionTypeSchema.nullable().default(null),
  occurred_at: z.string().default(''),
  description: z.string().nullable().default(null),
  wallet_name: z.string().nullable().default(null),
  labels: z.string().nullable().default(null),
  source_type: z.string().default(''),
  running_balance: z.string().default(''),
  created_at: z.string().default(''),
});

export const LedgerResponseSchema = z.object({
  account_public_id: z.string().default(''),
  account_name: z.string().default(''),
  account_currency: z.string().default(''),
  opening_balance: z.string().default(''),
  closing_balance: z.string().default(''),
  total_entries: z.number().default(0),
  items: z.array(LedgerEntrySchema).default([]),
});

export type LedgerResponse = z.infer<typeof LedgerResponseSchema>;


const PaginatedCategoriesSchema = z.object({
  items: z.array(CategorySchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const PaginatedTransactionsSchema = z.object({
  items: z.array(TransactionSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const PaginatedBudgetsSchema = z.object({
  items: z.array(BudgetSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const PaginatedRecurringSchema = z.object({
  items: z.array(RecurringTransactionSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

// ─── Service Implementation ──────────────────────────────────────────────────

export const spendingService = {
  // Categories
  getCategories: async (limit: number = 50, offset: number = 0): Promise<z.infer<typeof PaginatedCategoriesSchema>> => {
    const response = await api.get('/spending/categories', { params: { limit, offset } });
    return PaginatedCategoriesSchema.parse(response.data);
  },

  createCategory: async (data: CategoryCreate): Promise<Category> => {
    const response = await api.post('/spending/categories', data);
    return CategorySchema.parse(response.data);
  },

  updateCategory: async (publicId: string, data: CategoryUpdate): Promise<Category> => {
    const response = await api.patch(`/spending/categories/${publicId}`, data);
    return CategorySchema.parse(response.data);
  },

  deleteCategory: async (publicId: string): Promise<void> => {
    await api.delete(`/spending/categories/${publicId}`);
  },

  // Transactions
  getTransactions: async (
    limit: number = 50,
    offset: number = 0,
    params?: {
      categoryId?: string;
      accountId?: string;
      unassigned?: boolean;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<z.infer<typeof PaginatedTransactionsSchema>> => {
    const response = await api.get('/spending/transactions', {
      params: {
        limit,
        offset,
        category_id: params?.categoryId,
        account_id: params?.unassigned ? undefined : params?.accountId,
        unassigned: params?.unassigned || undefined,
        from_date: params?.fromDate,
        to_date: params?.toDate,
      },
    });
    return PaginatedTransactionsSchema.parse(response.data);
  },

  getTransactionSummary: async (
    params: { fromDate: string; toDate: string; categoryId?: string; accountId?: string }
  ): Promise<TransactionSummary> => {
    const response = await api.get('/spending/transactions/summary', {
      params: {
        from_date: params.fromDate,
        to_date: params.toDate,
        category_id: params.categoryId,
        account_id: params.accountId,
      },
    });
    return TransactionSummarySchema.parse(response.data);
  },

  createTransaction: async (data: TransactionCreate): Promise<Transaction> => {
    const response = await api.post('/spending/transactions', data);
    return TransactionSchema.parse(response.data);
  },

  updateTransaction: async (publicId: string, data: TransactionUpdate): Promise<Transaction> => {
    const response = await api.patch(`/spending/transactions/${publicId}`, data);
    return TransactionSchema.parse(response.data);
  },

  deleteTransaction: async (publicId: string): Promise<void> => {
    await api.delete(`/spending/transactions/${publicId}`);
  },

  // Budgets
  getBudgets: async (
    limit: number = 50,
    offset: number = 0,
    monthStart?: string
  ): Promise<z.infer<typeof PaginatedBudgetsSchema>> => {
    const response = await api.get('/spending/budgets', {
      params: { limit, offset, month_start: monthStart },
    });
    return PaginatedBudgetsSchema.parse(response.data);
  },

  createBudget: async (data: BudgetCreate): Promise<Budget> => {
    const response = await api.post('/spending/budgets', data);
    return BudgetSchema.parse(response.data);
  },

  updateBudget: async (publicId: string, data: BudgetUpdate): Promise<Budget> => {
    const response = await api.patch(`/spending/budgets/${publicId}`, data);
    return BudgetSchema.parse(response.data);
  },

  getTrends: async (fromMonth: string, toMonth: string): Promise<SpendingTrendResponse> => {
    const response = await api.get('/spending/analytics/trends', {
      params: { from: `${fromMonth}-01`, to: `${toMonth}-01` },
    });
    return SpendingTrendResponseSchema.parse(response.data);
  },

  getCategoryBreakdown: async (
    from: string,
    to: string,
    type: 'income' | 'expense' = 'expense',
    limit: number = 10
  ): Promise<CategoryBreakdownResponse> => {
    const response = await api.get('/spending/analytics/breakdown', {
      params: { from, to, type, limit },
    });
    return CategoryBreakdownResponseSchema.parse(response.data);
  },

  getBudgetPerformance: async (
    fromMonth: string,
    toMonth: string
  ): Promise<BudgetPerformanceResponse> => {
    const response = await api.get('/spending/analytics/budget-performance', {
      params: { from: `${fromMonth}-01`, to: `${toMonth}-01` },
    });
    return BudgetPerformanceResponseSchema.parse(response.data);
  },

  getSavingsRate: async (
    fromMonth: string,
    toMonth: string
  ): Promise<SavingsRateResponse> => {
    const response = await api.get('/spending/analytics/savings-rate', {
      params: { from: `${fromMonth}-01`, to: `${toMonth}-01` },
    });
    return SavingsRateResponseSchema.parse(response.data);
  },

  // Recurring Transactions
  getRecurring: async (
    limit: number = 50,
    offset: number = 0,
    isActive?: boolean
  ): Promise<z.infer<typeof PaginatedRecurringSchema>> => {
    const response = await api.get('/spending/recurring', {
      params: { limit, offset, is_active: isActive },
    });
    return PaginatedRecurringSchema.parse(response.data);
  },

  createRecurring: async (data: RecurringTransactionCreate): Promise<RecurringTransaction> => {
    const response = await api.post('/spending/recurring', data);
    return RecurringTransactionSchema.parse(response.data);
  },

  updateRecurring: async (publicId: string, data: RecurringTransactionUpdate): Promise<RecurringTransaction> => {
    const response = await api.patch(`/spending/recurring/${publicId}`, data);
    return RecurringTransactionSchema.parse(response.data);
  },

  deleteRecurring: async (publicId: string): Promise<void> => {
    await api.delete(`/spending/recurring/${publicId}`);
  },

  getUpcoming: async (days: number = 30): Promise<UpcomingPreviewResponse> => {
    const response = await api.get('/spending/recurring/upcoming', {
      params: { days },
    });
    return UpcomingPreviewResponseSchema.parse(response.data);
  },

  getAccountLedger: async (
    accountId: string,
    params?: { limit?: number; offset?: number; from_date?: string; to_date?: string }
  ): Promise<LedgerResponse> => {
    const response = await api.get(`/spending/accounts/${accountId}/ledger`, { params });
    return LedgerResponseSchema.parse(response.data);
  },
};
