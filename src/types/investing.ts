export interface Holding {
  public_id: string;
  symbol: string;
  instrument_type?: InstrumentType;
  account_id: string;
  account_name: string;
  quantity: number | string;
  avg_cost: number | string;
  currency: string;
  current_price?: number | string;
  current_value?: number | string;
  book_value?: number | string;
  gain_loss?: number | string;
  gain_loss_pct?: number | string;
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

export interface InstrumentUpdate {
  name?: string;
  instrument_type?: InstrumentType;
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

export interface HoldingUpdate {
  symbol?: string;
  quantity?: number;
  avg_cost?: number;
  currency?: string;
  instrument_type?: InstrumentType;
}

export interface CashBalance {
  public_id: string;
  account_id: string;
  account_name: string;
  balance: number | string;
  currency: string;
  as_of: string;
  created_at: string;
  updated_at: string;
}

export interface CashBalanceCreate {
  account_id: string;
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
  fx_rates_used?: Record<string, number | string>;
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
  analysis_status: 'complete' | 'partial' | 'unavailable';
  currency: string | null;
  fx_as_of: string | null;
  fx_rates_used: Record<string, number | string>;
  snapshot_coverage: string;
  staleness_days: number | null;
  warnings: string[];
  display_threshold_pct: string;
  hidden_exposure_count: number;
  exposure: ExposureCompanyRow[];
  total_direct_exposure: string | null;
  total_lookthrough_exposure: string | null;
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
  analysis_status: 'complete' | 'partial' | 'unavailable';
  currency: string | null;
  fx_as_of: string | null;
  fx_rates_used: Record<string, number | string>;
  snapshot_coverage: string;
  warnings: string[];
  display_threshold_pct: string;
  hidden_overlap_count: number;
  top_5_concentration_pct: string;
  top_10_concentration_pct: string;
  duplicate_exposure_index: string;
  overlaps: OverlapRow[];
}

export interface PerformanceSummary {
  total_value: number | string;
  total_cost: number | string;
  portfolio_value: number | string;
  invested_value: number | string;
  cash_total: number | string;
  total_gain_loss: number | string;
  total_gain_loss_pct: number | string | null;
  daily_change: number | string | null;
  daily_change_pct: number | string | null;
  snapshot_date: string;
  previous_snapshot_date: string | null;
  currency: string;
  valuation_status: 'current' | 'estimated' | 'empty';
  holdings_count: number;
  fx_rates_used?: Record<string, number | string>;
}
