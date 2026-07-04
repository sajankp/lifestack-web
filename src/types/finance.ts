export interface Currency {
  code: string;
  name: string;
  symbol: string | null;
  minor_unit: number;
  is_active: boolean;
}

export interface Account {
  public_id: string;
  name: string;
  account_type: 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card';
  default_currency_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountCreate {
  name: string;
  account_type: 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card';
  default_currency_code: string;
}

export interface AccountUpdate {
  name?: string;
  account_type?: 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card';
  default_currency_code?: string;
  is_active?: boolean;
}

export interface WorkspaceFinanceSetting {
  reporting_currency_code: string | null;
  currency_display_preference?: 'symbol' | 'code';
  lookthrough_min_weight_pct: number | string;
  default_spending_account_id?: string | null;
  updated_at: string;
}

export interface WorkspaceFinanceSettingUpdate {
  reporting_currency_code?: string | null;
  currency_display_preference?: 'symbol' | 'code' | null;
  lookthrough_min_weight_pct?: number | string;
  default_spending_account_id?: string | null;
}

export interface UserFinanceSetting {
  reporting_currency_override_code: string | null;
  currency_display_preference_override: 'symbol' | 'code' | null;
  workspace_reporting_currency_code: string | null;
  workspace_currency_display_preference: 'symbol' | 'code';
  effective_reporting_currency_code: string | null;
  effective_currency_display_preference: 'symbol' | 'code';
  updated_at: string;
}

export interface UserFinanceSettingUpdate {
  reporting_currency_override_code?: string | null;
  currency_display_preference_override?: 'symbol' | 'code' | null;
}

export interface CapitalTransferCreate {
  from_module: 'spending' | 'investing';
  to_module: 'spending' | 'investing';
  from_account_id: string;
  to_account_id: string;
  from_currency_code: string;
  to_currency_code: string;
  gross_amount: string;
  fx_rate_used?: string | null;
  fx_fee_amount: string;
  platform_fee_amount: string;
  tax_amount: string;
  net_amount_received: string;
  occurred_at: string;
  notes?: string | null;
}

export interface CapitalTransferUpdate {
  from_account_id?: string;
  to_account_id?: string;
  from_currency_code?: string;
  to_currency_code?: string;
  gross_amount?: string;
  fx_rate_used?: string | null;
  fx_fee_amount?: string;
  platform_fee_amount?: string;
  tax_amount?: string;
  net_amount_received?: string;
  occurred_at?: string;
  notes?: string | null;
}

export interface CapitalTransfer {
  public_id: string;
  from_module: 'spending' | 'investing';
  to_module: 'spending' | 'investing';
  from_account_id: number;
  to_account_id: number;
  from_account_public_id: string | null;
  to_account_public_id: string | null;
  from_account_name: string | null;
  to_account_name: string | null;
  from_account_type: 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card' | null;
  to_account_type: 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card' | null;
  from_currency_code: string;
  to_currency_code: string;
  gross_amount: string;
  fx_rate_used: string | null;
  fx_fee_amount: string;
  platform_fee_amount: string;
  tax_amount: string;
  net_amount_received: string;
  occurred_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountBalanceResponse {
  account_public_id: string;
  account_name: string;
  account_type: 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card';
  currency_code: string;
  spending_balance: string; // (income - expenses) + (transfer_in - transfer_out)
  transaction_count: number;
  transfer_count: number;
  first_transaction_at: string | null;
  last_transaction_at: string | null;
}

export interface ReconciliationSummary {
  account_public_id: string;
  account_name: string;
  currency_code: string;
  projected_balance: string; // decimal as string
  snapshot_balance: string | null; // null when no cash snapshot exists
  snapshot_as_of: string | null;
  discrepancy: string | null; // projected - snapshot; null when no snapshot
  transaction_count: number;
  transfer_count: number;
  order_count: number;
}

export interface SpendingAccountBalance {
  account_public_id: string;
  account_name: string;
  account_type: string;
  currency_code: string;
  balance: string; // decimal as string, native currency
  balance_in_reporting_currency: string | null; // null if FX rate unavailable
}

export interface InvestingAccountBalance {
  account_public_id: string;
  account_name: string;
  currency_code: string;
  balance: string; // decimal as string, native currency
  balance_in_reporting_currency: string | null; // null if FX rate unavailable
}

export interface NetWorthData {
  reporting_currency: string | null;
  spending_accounts: SpendingAccountBalance[];
  spending_total: string | null;
  investing_accounts: InvestingAccountBalance[];
  investing_cash_total: string | null;
  holdings_value: string | null;
  investing_total: string | null;
  total_net_worth: string | null;
  valuation_status: 'ok' | 'partial' | 'no_reporting_currency' | 'empty' | string;
  fx_as_of: string | null;
}
