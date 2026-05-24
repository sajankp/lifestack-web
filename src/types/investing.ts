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

export type InstrumentType = 'stock' | 'etf' | 'mutual_fund';

export interface Instrument {
  public_id: string;
  symbol: string;
  name: string;
  instrument_type: InstrumentType;
  company_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstrumentCreate {
  symbol: string;
  name: string;
  instrument_type: InstrumentType;
  ticker?: string;
}

export interface InstrumentConstituentInput {
  company_name: string;
  company_ticker?: string;
  weight: string;
}

export interface InstrumentConstituentUpsert {
  as_of_date: string;
  source: string;
  fetched_at: string;
  constituents: InstrumentConstituentInput[];
}

export interface InstrumentConstituent {
  company_id: string;
  company_name: string;
  company_ticker: string | null;
  weight: string;
  as_of_date: string;
  source: string;
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
  portfolio_value: number | string | null;
  holdings_count: number;
  cash_total: number | string | null;
  currency_breakdown: Record<string, number | string>;
  daily_change: number | string | null;
  reporting_currency: string | null;
  valuation_status: string;
}

export interface ExposureCompanyRow {
  company_id: string;
  company_name: string;
  company_ticker: string | null;
  direct_exposure: string;
  lookthrough_exposure: string;
}

export interface ExposureAnalytics {
  as_of_date: string;
  analysis_status: 'complete' | 'partial';
  snapshot_coverage: string;
  staleness_days: number | null;
  warnings: string[];
  exposure: ExposureCompanyRow[];
  total_direct_exposure: string;
  total_lookthrough_exposure: string;
}

export interface OverlapRow {
  company_id: string;
  company_name: string;
  company_ticker: string | null;
  overlap_exposure: string;
  portfolio_share: string;
}

export interface OverlapAnalytics {
  as_of_date: string;
  analysis_status: 'complete' | 'partial';
  snapshot_coverage: string;
  warnings: string[];
  top_5_concentration_pct: string;
  top_10_concentration_pct: string;
  duplicate_exposure_index: string;
  overlaps: OverlapRow[];
}
