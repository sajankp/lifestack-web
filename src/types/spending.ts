export interface Category {
  public_id: string;
  name: string;
  is_system: boolean;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

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

export type TransactionType = 'income' | 'expense';

export interface SourceMetadata {
  source_type: 'manual' | 'imported' | 'synced' | 'assistant' | 'extracted';
  source_ref: string | null;
  origin:
    | 'manual_entry'
    | 'bulk_import'
    | 'external_sync'
    | 'assistant_action'
    | 'document_extraction';
  label: string;
  import_public_id: string | null;
  import_module: string | null;
  import_row_number: number | null;
  rollback_supported: boolean;
}

export interface Transaction {
  public_id: string;
  category_id: string;
  account_id: string | null;
  amount: number | string;
  type: TransactionType;
  occurred_at: string;
  description: string | null;
  wallet_name: string | null;
  labels: string | null;
  source_type?: SourceMetadata['source_type'];
  source_ref?: string | null;
  source_metadata?: SourceMetadata;
  created_at: string;
  updated_at: string;
}

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

export interface Budget {
  public_id: string;
  category_id: string;
  amount: number | string;
  month_start: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetCreate {
  category_id: string;
  amount: number;
  month_start: string;
}

export interface BudgetUpdate {
  amount: number;
}

export interface CategorySpendTotal {
  category_id: string;
  total: number | string;
}

export interface TransactionSummary {
  income_total: number | string;
  expense_total: number | string;
  net_total: number | string;
  category_totals: CategorySpendTotal[];
}

export interface SpendingTrendPoint {
  month: string;
  total_income: number | string;
  total_expense: number | string;
  net: number | string;
  transaction_count: number;
}

export interface SpendingTrendResponse {
  from: string;
  to: string;
  months: SpendingTrendPoint[];
}

export interface CategoryBreakdownItem {
  category_id: string;
  category_name: string;
  amount: number | string;
  pct_of_total: number;
  transaction_count: number;
}

export interface CategoryBreakdownOther {
  amount: number | string;
  pct_of_total: number;
  category_count: number;
}

export interface CategoryBreakdownResponse {
  from: string;
  to: string;
  type: TransactionType;
  total: number | string;
  categories: CategoryBreakdownItem[];
  other: CategoryBreakdownOther | null;
}

export interface BudgetPerformanceItem {
  category_id: string;
  category_name: string;
  budget_amount: number | string | null;
  actual_amount: number | string;
  utilization_pct: number | null;
  remaining: number | string | null;
  status: 'on_track' | 'warning' | 'exceeded';
}

export interface BudgetPerformanceTotals {
  total_budgeted: number | string;
  total_actual: number | string;
  overall_utilization_pct: number | null;
}

export interface BudgetPerformanceResponse {
  from: string;
  to: string;
  categories: BudgetPerformanceItem[];
  totals: BudgetPerformanceTotals;
}

export interface SavingsRatePoint {
  month: string;
  income: number | string;
  expense: number | string;
  savings: number | string;
  savings_rate_pct: number | null;
}

export interface SavingsRateTotals {
  total_income: number | string;
  total_expense: number | string;
  total_savings: number | string;
  average_savings_rate_pct: number | null;
}

export interface SavingsRateResponse {
  from: string;
  to: string;
  months: SavingsRatePoint[];
  period_totals: SavingsRateTotals;
}

export type MonthlyMode = 'day_of_month' | 'last_day' | 'nth_weekday';

export interface RecurringTransaction {
  public_id: string;
  category_id: string;
  amount: number | string;
  type: TransactionType;
  description: string | null;
  frequency: string;
  interval: number;
  anchor_date: string;
  next_due_date: string;
  end_date: string | null;
  is_active: boolean;
  last_generated_at: string | null;
  monthly_mode: MonthlyMode;
  by_weekday: number | null;
  by_ordinal: number | null;
  created_at: string;
  updated_at: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransactionCreate {
  category_id: string;
  amount: number;
  type: TransactionType;
  description?: string | null;
  frequency: RecurringFrequency;
  interval: number;
  anchor_date: string; // ISO date yyyy-mm-dd
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

export interface UpcomingTransactionItem {
  recurring_public_id: string;
  category_id: string;
  amount: number | string;
  type: TransactionType;
  description: string | null;
  projected_date: string;
  frequency: string;
  interval: number;
}

export interface UpcomingPreviewResponse {
  days: number;
  from_date: string;
  to_date: string;
  items: UpcomingTransactionItem[];
}

// ---------------------------------------------------------------------------
// Ledger types
// ---------------------------------------------------------------------------

export type LedgerEntryKind = 'transaction' | 'transfer_out' | 'transfer_in';

export interface LedgerEntry {
  public_id: string;
  entry_kind: LedgerEntryKind;
  category_id: string | null; // null for transfer entries
  account_id: string | null;
  amount: string;
  type: TransactionType | null; // null for transfer entries
  occurred_at: string;
  description: string | null;
  wallet_name: string | null;
  labels: string | null;
  source_type: string;
  running_balance: string; // cumulative balance after this entry
  created_at: string;
}

export interface LedgerResponse {
  account_public_id: string;
  account_name: string;
  account_currency: string;
  opening_balance: string;
  closing_balance: string;
  total_entries: number; // total count of transactions + transfers
  items: LedgerEntry[];
}

