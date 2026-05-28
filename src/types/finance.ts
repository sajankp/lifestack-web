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
  updated_at: string;
}

export interface WorkspaceFinanceSettingUpdate {
  reporting_currency_code: string | null;
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

export interface CapitalTransfer {
  public_id: string;
  from_module: 'spending' | 'investing';
  to_module: 'spending' | 'investing';
  from_account_id: number;
  to_account_id: number;
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
