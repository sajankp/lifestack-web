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
  account_type: 'bank' | 'brokerage' | 'wallet';
  default_currency_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountCreate {
  name: string;
  account_type: 'bank' | 'brokerage' | 'wallet';
  default_currency_code: string;
}
