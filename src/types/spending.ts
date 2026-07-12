import { z } from 'zod';

// ─── Zod Schemas with default values for test resiliency ────────────────────
// Single source of truth for spending API shapes (G4): response types are
// derived from these schemas; request payload types stay plain interfaces.

export const CategoryGroupSchema = z.object({
  public_id: z.string().default(''),
  name: z.string().default(''),
  color: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type CategoryGroup = z.infer<typeof CategoryGroupSchema>;

export interface CategoryGroupCreate {
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface CategoryGroupUpdate {
  name?: string | null;
  color?: string | null;
  icon?: string | null;
}

export const CategorySchema = z.object({
  public_id: z.string().default(''),
  name: z.string().default(''),
  is_system: z.boolean().default(false),
  color: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  category_group_id: z.string().nullable().default(null),
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
  category_group_id?: string | null;
}

export interface CategoryMergeRequest {
  source_public_ids: string[];
}

export const TransactionTypeSchema = z.enum(['income', 'expense']).default('expense');
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

// Sort options accepted by GET /spending/transactions (mirror of the API's
// TransactionSort enum). `date_*` sorts by transaction date, `amount_*` by amount.
export type TransactionSort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

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

export type SourceMetadata = z.infer<typeof SourceMetadataSchema>;

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
  category_id: z.string().nullable().default(null),
  category_group_id: z.string().nullable().default(null),
  amount: z.union([z.number(), z.string()]).default(0),
  start_month: z.string().default(''),
  end_month: z.string().nullable().default(null),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Budget = z.infer<typeof BudgetSchema>;

export interface BudgetCreate {
  category_id?: string | null;
  category_group_id?: string | null;
  amount: number;
  start_month: string;
  end_month?: string | null;
}

export interface BudgetUpdate {
  amount?: number;
  end_month?: string | null;
}

export interface BudgetChangeAmountRequest {
  amount: number;
  from_month: string;
}

export const KpiMetricTypeSchema = z
  .enum(['spend_total', 'income_total', 'net_cash_flow'])
  .default('spend_total');
export type KpiMetricType = z.infer<typeof KpiMetricTypeSchema>;

export const KpiWindowSchema = z
  .enum(['calendar_month', 'calendar_week', 'rolling_30d'])
  .default('calendar_month');
export type KpiWindow = z.infer<typeof KpiWindowSchema>;

export const KpiTargetDirectionSchema = z.enum(['lte', 'gte']).nullable().default(null);
export type KpiTargetDirection = z.infer<typeof KpiTargetDirectionSchema>;

export const KpiSchema = z.object({
  public_id: z.string().default(''),
  name: z.string().default(''),
  metric_type: KpiMetricTypeSchema,
  evaluation_window: KpiWindowSchema,
  category_id: z.string().nullable().default(null),
  category_group_id: z.string().nullable().default(null),
  account_id: z.string().nullable().default(null),
  currency_code: z.string().default(''),
  target_value: z.union([z.number(), z.string()]).nullable().default(null),
  target_direction: KpiTargetDirectionSchema,
  display_format: z.string().default('amount'),
  is_active: z.boolean().default(true),
  current_value: z.union([z.number(), z.string()]).default(0),
  is_breached: z.boolean().default(false),
  window_start: z.string().default(''),
  window_end: z.string().default(''),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Kpi = z.infer<typeof KpiSchema>;

export interface KpiCreate {
  name: string;
  metric_type: KpiMetricType;
  evaluation_window: KpiWindow;
  category_id?: string | null;
  category_group_id?: string | null;
  account_id?: string | null;
  target_value?: number | null;
  target_direction?: 'lte' | 'gte' | null;
  display_format?: 'amount' | 'percent';
}

export interface KpiUpdate {
  name?: string | null;
  category_id?: string | null;
  category_group_id?: string | null;
  account_id?: string | null;
  target_value?: number | null;
  target_direction?: 'lte' | 'gte' | null;
  is_active?: boolean | null;
}

export const CategorySpendTotalSchema = z.object({
  category_id: z.string().default(''),
  total: z.union([z.number(), z.string()]).default(0),
});

export type CategorySpendTotal = z.infer<typeof CategorySpendTotalSchema>;

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

export type SpendingTrendPoint = z.infer<typeof SpendingTrendPointSchema>;

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

export type CategoryBreakdownItem = z.infer<typeof CategoryBreakdownItemSchema>;

export const CategoryBreakdownOtherSchema = z.object({
  amount: z.union([z.number(), z.string()]).default(0),
  pct_of_total: z.number().default(0),
  category_count: z.number().default(0),
});

export type CategoryBreakdownOther = z.infer<typeof CategoryBreakdownOtherSchema>;

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
  category_id: z.string().nullable().default(null),
  category_name: z.string().nullable().default(null),
  category_group_id: z.string().nullable().default(null),
  category_group_name: z.string().nullable().default(null),
  budget_amount: z.union([z.number(), z.string()]).nullable().default(null),
  actual_amount: z.union([z.number(), z.string()]).default(0),
  utilization_pct: z.number().nullable().default(null),
  remaining: z.union([z.number(), z.string()]).nullable().default(null),
  status: z.enum(['on_track', 'warning', 'exceeded']).default('on_track'),
});

export type BudgetPerformanceItem = z.infer<typeof BudgetPerformanceItemSchema>;

export const BudgetPerformanceTotalsSchema = z.object({
  total_budgeted: z.union([z.number(), z.string()]).default(0),
  total_actual: z.union([z.number(), z.string()]).default(0),
  overall_utilization_pct: z.number().nullable().default(null),
});

export type BudgetPerformanceTotals = z.infer<typeof BudgetPerformanceTotalsSchema>;

export const BudgetPerformanceResponseSchema = z.object({
  from: z.string().default(''),
  to: z.string().default(''),
  categories: z.array(BudgetPerformanceItemSchema).default([]),
  totals: BudgetPerformanceTotalsSchema.default({
    total_budgeted: 0,
    total_actual: 0,
    overall_utilization_pct: null,
  }),
  groups: z.array(BudgetPerformanceItemSchema).default([]),
  group_totals: BudgetPerformanceTotalsSchema.default({
    total_budgeted: 0,
    total_actual: 0,
    overall_utilization_pct: null,
  }),
});

export type BudgetPerformanceResponse = z.infer<typeof BudgetPerformanceResponseSchema>;

export const BudgetSpotlightItemSchema = z.object({
  category_group_id: z.string().default(''),
  category_group_name: z.string().default(''),
  budget_amount: z.union([z.number(), z.string()]).default(0),
  actual_amount: z.union([z.number(), z.string()]).default(0),
  utilization_pct: z.number().default(0),
  remaining: z.union([z.number(), z.string()]).default(0),
  status: z.enum(['on_track', 'warning', 'exceeded']).default('on_track'),
  daily_amount_left: z.union([z.number(), z.string()]).default(0),
});

export type BudgetSpotlightItem = z.infer<typeof BudgetSpotlightItemSchema>;

export const SavingsRatePointSchema = z.object({
  month: z.string().default(''),
  income: z.union([z.number(), z.string()]).default(0),
  expense: z.union([z.number(), z.string()]).default(0),
  savings: z.union([z.number(), z.string()]).default(0),
  savings_rate_pct: z.number().nullable().default(null),
});

export type SavingsRatePoint = z.infer<typeof SavingsRatePointSchema>;

export const SavingsRateTotalsSchema = z.object({
  total_income: z.union([z.number(), z.string()]).default(0),
  total_expense: z.union([z.number(), z.string()]).default(0),
  total_savings: z.union([z.number(), z.string()]).default(0),
  average_savings_rate_pct: z.number().nullable().default(null),
});

export type SavingsRateTotals = z.infer<typeof SavingsRateTotalsSchema>;

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

export type UpcomingTransactionItem = z.infer<typeof UpcomingTransactionItemSchema>;

export const UpcomingPreviewResponseSchema = z.object({
  days: z.number().default(0),
  from_date: z.string().default(''),
  to_date: z.string().default(''),
  items: z.array(UpcomingTransactionItemSchema).default([]),
});

export type UpcomingPreviewResponse = z.infer<typeof UpcomingPreviewResponseSchema>;

export type LedgerEntryKind = 'transaction' | 'transfer_out' | 'transfer_in';

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

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

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
