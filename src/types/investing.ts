export interface Holding {
  public_id: string;
  symbol: string;
  account_name: string;
  quantity: number | string;
  avg_cost: number | string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface HoldingCreate {
  symbol: string;
  account_name?: string;
  quantity: number;
  avg_cost: number;
  currency: string;
}

export interface HoldingUpdate {
  quantity?: number;
  avg_cost?: number;
  currency?: string;
}

export interface CashBalance {
  public_id: string;
  account_name: string;
  balance: number | string;
  currency: string;
  as_of: string;
  created_at: string;
  updated_at: string;
}

export interface CashBalanceCreate {
  account_name: string;
  balance: number;
  currency: string;
  as_of: string;
}

export interface CashBalanceUpdate {
  balance?: number;
  currency?: string;
  as_of?: string;
}

export interface InvestingSummary {
  portfolio_value: number | string;
  holdings_count: number;
  cash_total: number | string;
  currency_breakdown: Record<string, number | string>;
  daily_change: number | string | null;
}
