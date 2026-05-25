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
  amount: number | string;
  type: TransactionType;
  occurred_at: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionCreate {
  category_id: string;
  amount: number;
  type: TransactionType;
  occurred_at: string;
  description?: string | null;
}

export interface TransactionUpdate {
  category_id?: string | null;
  amount?: number | null;
  type?: TransactionType | null;
  occurred_at?: string | null;
  description?: string | null;
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
