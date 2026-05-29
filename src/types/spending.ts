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
}

export interface RecurringTransactionUpdate {
  amount?: number | null;
  description?: string | null;
  frequency?: RecurringFrequency | null;
  interval?: number | null;
  end_date?: string | null;
  is_active?: boolean | null;
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
