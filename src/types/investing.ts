import { z } from 'zod';

// ─── Zod Schemas with default values for test resiliency ────────────────────
// Single source of truth for investing API shapes (G4): response types are
// derived from these schemas; request payload types stay plain interfaces.

export const InstrumentTypeSchema = z.enum(['stock', 'etf', 'mutual_fund']).default('stock');
export type InstrumentType = z.infer<typeof InstrumentTypeSchema>;

export const HoldingSchema = z.object({
  public_id: z.string().default(''),
  symbol: z.string().default(''),
  instrument_type: InstrumentTypeSchema.optional(),
  account_id: z.string().default(''),
  account_name: z.string().default(''),
  quantity: z.union([z.number(), z.string()]).default(0),
  avg_cost: z.union([z.number(), z.string()]).default(0),
  currency: z.string().default(''),
  source_type: z.string().optional(),
  current_price: z.union([z.number(), z.string()]).optional(),
  current_value: z.union([z.number(), z.string()]).optional(),
  book_value: z.union([z.number(), z.string()]).optional(),
  gain_loss: z.union([z.number(), z.string()]).optional(),
  gain_loss_pct: z.union([z.number(), z.string()]).optional(),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Holding = z.infer<typeof HoldingSchema>;

export interface HoldingUpdate {
  symbol?: string;
  quantity?: number;
  avg_cost?: number;
  currency?: string;
  instrument_type?: InstrumentType;
}

export const InstrumentSchema = z.object({
  public_id: z.string().default(''),
  symbol: z.string().default(''),
  name: z.string().default(''),
  instrument_type: InstrumentTypeSchema,
  company_id: z.string().nullable().default(null),
  is_active: z.boolean().default(true),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Instrument = z.infer<typeof InstrumentSchema>;

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

export const InstrumentConstituentSchema = z.object({
  company_id: z.string().default(''),
  company_name: z.string().default(''),
  company_ticker: z.string().nullable().default(null),
  weight: z.string().default('0'),
  as_of_date: z.string().default(''),
  source: z.string().default(''),
});

export type InstrumentConstituent = z.infer<typeof InstrumentConstituentSchema>;

export const CashBalanceSchema = z.object({
  public_id: z.string().default(''),
  account_id: z.string().default(''),
  account_name: z.string().default(''),
  balance: z.union([z.number(), z.string()]).default(0),
  currency: z.string().default(''),
  as_of: z.string().default(''),
  trigger_type: z.string().nullable().default(null),
  trigger_ref: z.string().nullable().default(null),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type CashBalance = z.infer<typeof CashBalanceSchema>;

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

export const DIVIDEND_INCOME_TYPES = ['dividend', 'interest', 'coupon'] as const;
export type DividendIncomeType = (typeof DIVIDEND_INCOME_TYPES)[number];

export const DividendSchema = z.object({
  public_id: z.string().default(''),
  account_id: z.string().default(''),
  account_name: z.string().default(''),
  holding_id: z.string().nullable().default(null),
  symbol: z.string().nullable().default(null),
  income_type: z.string().default('dividend'),
  gross_amount: z.union([z.number(), z.string()]).default(0),
  tax_withheld: z.union([z.number(), z.string()]).default(0),
  net_amount: z.union([z.number(), z.string()]).default(0),
  currency: z.string().default(''),
  pay_date: z.string().default(''),
  external_ref: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Dividend = z.infer<typeof DividendSchema>;

export interface DividendCreate {
  account_id: string;
  symbol?: string | null;
  income_type: DividendIncomeType;
  gross_amount: number;
  tax_withheld?: number;
  currency: string;
  pay_date: string;
  external_ref?: string | null;
  notes?: string | null;
}

export interface DividendUpdate {
  symbol?: string | null;
  income_type?: DividendIncomeType;
  gross_amount?: number;
  tax_withheld?: number;
  currency?: string;
  pay_date?: string;
  external_ref?: string | null;
  notes?: string | null;
}

export interface DividendBulkImportRow {
  account_id: string;
  symbol?: string | null;
  income_type: DividendIncomeType;
  gross_amount: number;
  tax_withheld?: number;
  currency: string;
  pay_date: string;
  external_ref?: string | null;
  notes?: string | null;
}

export const DividendBulkImportResultSchema = z.object({
  imported: z.number().default(0),
  updated: z.number().default(0),
  skipped: z.number().default(0),
  rejected: z.array(z.object({ row: z.number(), reason: z.string() })).default([]),
});

export type DividendBulkImportResult = z.infer<typeof DividendBulkImportResultSchema>;

export const PaginatedDividendsSchema = z.object({
  items: z.array(DividendSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

export const OrderTypeSchema = z.enum(['buy', 'sell']).default('buy');
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const InvestingOrderSchema = z.object({
  public_id: z.string().default(''),
  account_id: z.string().default(''),
  account_name: z.string().default(''),
  order_type: OrderTypeSchema,
  symbol: z.string().default(''),
  instrument_type: z.string().nullable().default(null),
  quantity: z.union([z.number(), z.string()]).default(0),
  price_per_unit: z.union([z.number(), z.string()]).default(0),
  gross_amount: z.union([z.number(), z.string()]).default(0),
  brokerage_fee: z.union([z.number(), z.string()]).default(0),
  tax_amount: z.union([z.number(), z.string()]).default(0),
  other_fees: z.union([z.number(), z.string()]).default(0),
  net_amount: z.union([z.number(), z.string()]).default(0),
  currency: z.string().default(''),
  exchange_name: z.string().nullable().default(null),
  occurred_at: z.string().default(''),
  notes: z.string().nullable().default(null),
  realized_gain_loss: z.union([z.number(), z.string()]).nullable().default(null),
  avg_cost_at_sale: z.union([z.number(), z.string()]).nullable().default(null),
  source_type: z.string().nullable().default(null),
  created_at: z.string().default(''),
});

export type InvestingOrder = z.infer<typeof InvestingOrderSchema>;

export interface InvestingOrderCreate {
  account_id: string;
  order_type: OrderType;
  symbol: string;
  quantity: number;
  price_per_unit: number;
  currency: string;
  brokerage_fee?: number;
  tax_amount?: number;
  other_fees?: number;
  exchange_name?: string;
  occurred_at: string;
  notes?: string;
}

export interface InvestingOrderUpdate {
  order_type?: OrderType;
  quantity?: number;
  price_per_unit?: number;
  brokerage_fee?: number;
  tax_amount?: number;
  other_fees?: number;
  exchange_name?: string;
  occurred_at?: string;
  notes?: string;
}

export interface InvestingOrderBulkCreate {
  account_id: string;
  orders: InvestingOrderCreate[];
}

export const InvestingSummarySchema = z.object({
  portfolio_value: z.union([z.number(), z.string()]).nullable().default(null),
  holdings_count: z.number().default(0),
  cash_total: z.union([z.number(), z.string()]).nullable().default(null),
  currency_breakdown: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  daily_change: z.union([z.number(), z.string()]).nullable().default(null),
  reporting_currency: z.string().nullable().default(null),
  valuation_status: z.string().default(''),
  fx_rates_used: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

export type InvestingSummary = z.infer<typeof InvestingSummarySchema>;

export const ExposureCompanyRowSchema = z.object({
  company_id: z.string().default(''),
  company_name: z.string().default(''),
  company_ticker: z.string().nullable().default(null),
  direct_exposure: z.string().default('0'),
  lookthrough_exposure: z.string().default('0'),
});

export type ExposureCompanyRow = z.infer<typeof ExposureCompanyRowSchema>;

export const ExposureAnalyticsSchema = z.object({
  as_of_date: z.string().default(''),
  analysis_status: z.enum(['complete', 'partial', 'unavailable']).default('complete'),
  currency: z.string().nullable().default(null),
  fx_as_of: z.string().nullable().default(null),
  fx_rates_used: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  snapshot_coverage: z.string().default('0'),
  staleness_days: z.number().nullable().default(null),
  warnings: z.array(z.string()).default([]),
  display_threshold_pct: z.string().default('0'),
  hidden_exposure_count: z.number().default(0),
  exposure: z.array(ExposureCompanyRowSchema).default([]),
  total_direct_exposure: z.string().nullable().default(null),
  total_lookthrough_exposure: z.string().nullable().default(null),
});

export type ExposureAnalytics = z.infer<typeof ExposureAnalyticsSchema>;

export const OverlapRowSchema = z.object({
  company_id: z.string().default(''),
  company_name: z.string().default(''),
  company_ticker: z.string().nullable().default(null),
  overlap_exposure: z.string().default('0'),
  portfolio_share: z.string().default('0'),
});

export type OverlapRow = z.infer<typeof OverlapRowSchema>;

export const OverlapAnalyticsSchema = z.object({
  as_of_date: z.string().default(''),
  analysis_status: z.enum(['complete', 'partial', 'unavailable']).default('complete'),
  currency: z.string().nullable().default(null),
  fx_as_of: z.string().nullable().default(null),
  fx_rates_used: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  snapshot_coverage: z.string().default('0'),
  warnings: z.array(z.string()).default([]),
  display_threshold_pct: z.string().default('0'),
  hidden_overlap_count: z.number().default(0),
  top_5_concentration_pct: z.string().default('0'),
  top_10_concentration_pct: z.string().default('0'),
  duplicate_exposure_index: z.string().default('0'),
  overlaps: z.array(OverlapRowSchema).default([]),
});

export type OverlapAnalytics = z.infer<typeof OverlapAnalyticsSchema>;

export const PerformanceSummarySchema = z.object({
  total_value: z.union([z.number(), z.string()]).default(0),
  total_cost: z.union([z.number(), z.string()]).default(0),
  portfolio_value: z.union([z.number(), z.string()]).nullable().catch(null).default(null),
  invested_value: z.union([z.number(), z.string()]).nullable().catch(null).default(null),
  cash_total: z.union([z.number(), z.string()]).default(0),
  total_gain_loss: z.union([z.number(), z.string()]).default(0),
  total_gain_loss_pct: z.union([z.number(), z.string()]).nullable().catch(null).default(null),
  daily_change: z.union([z.number(), z.string()]).nullable().catch(null).default(null),
  daily_change_pct: z.union([z.number(), z.string()]).nullable().catch(null).default(null),
  snapshot_date: z.string().default(''),
  previous_snapshot_date: z.string().nullable().catch(null).default(null),
  currency: z.string().default(''),
  valuation_status: z.enum(['current', 'estimated', 'empty']).default('empty'),
  holdings_count: z.number().default(0),
  fx_rates_used: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

export type PerformanceSummary = z.infer<typeof PerformanceSummarySchema>;

export const PositionMetricsSchema = z.object({
  xirr: z.union([z.number(), z.string()]).nullable().default(null),
  annualized_return_pct: z.union([z.number(), z.string()]).nullable().default(null),
  annualization_reliable: z.boolean().default(false),
  holding_days: z.number().nullable().default(null),
  total_return_pct: z.union([z.number(), z.string()]).nullable().default(null),
  realized: z.union([z.number(), z.string()]).default(0),
  unrealized: z.union([z.number(), z.string()]).default(0),
  market_value: z.union([z.number(), z.string()]).default(0),
  invested: z.union([z.number(), z.string()]).default(0),
});
export type PositionMetrics = z.infer<typeof PositionMetricsSchema>;

const ScopeReturnMetricsFields = {
  xirr: z.union([z.number(), z.string()]).nullable().default(null),
  annualized_return_pct: z.union([z.number(), z.string()]).nullable().default(null),
  annualization_reliable: z.boolean().default(false),
  holding_days: z.number().nullable().default(null),
  // Simple (non-annualized) total return — the INV-7 display for sub-year
  // spans, where no annualized figure (XIRR included) may be shown.
  total_return_pct: z.union([z.number(), z.string()]).nullable().default(null),
  realized: z.union([z.number(), z.string()]).default(0),
  unrealized: z.union([z.number(), z.string()]).default(0),
  data_quality: z.string().default('complete'),
  open: PositionMetricsSchema,
  closed: PositionMetricsSchema,
};

export const MaxDrawdownSchema = z.object({
  pct: z.union([z.number(), z.string()]).default(0),
  peak_date: z.string().default(''),
  trough_date: z.string().default(''),
});
export type MaxDrawdown = z.infer<typeof MaxDrawdownSchema>;

export const OverallReturnMetricsSchema = z.object({
  ...ScopeReturnMetricsFields,
  max_drawdown: MaxDrawdownSchema.nullable().default(null),
});
export type OverallReturnMetrics = z.infer<typeof OverallReturnMetricsSchema>;

export const AccountReturnMetricsSchema = z.object({
  ...ScopeReturnMetricsFields,
  account_id: z.string().default(''),
  account_name: z.string().default(''),
  currency: z.string().default(''),
});
export type AccountReturnMetrics = z.infer<typeof AccountReturnMetricsSchema>;

export const CurrencyReturnMetricsSchema = z.object({
  ...ScopeReturnMetricsFields,
  currency: z.string().default(''),
});
export type CurrencyReturnMetrics = z.infer<typeof CurrencyReturnMetricsSchema>;

export const ReturnMetricsResponseSchema = z.object({
  currency: z.string().nullable().default(null),
  valuation_status: z.string().default('current'),
  overall: OverallReturnMetricsSchema,
  by_account: z.array(AccountReturnMetricsSchema).default([]),
  by_currency: z.array(CurrencyReturnMetricsSchema).default([]),
});
export type ReturnMetricsResponse = z.infer<typeof ReturnMetricsResponseSchema>;

export const CorporateActionTypeSchema = z.enum(['split', 'bonus']).default('split');
export type CorporateActionType = z.infer<typeof CorporateActionTypeSchema>;

export const CorporateActionSchema = z.object({
  public_id: z.string().default(''),
  account_id: z.string().default(''),
  account_name: z.string().default(''),
  symbol: z.string().default(''),
  action_type: CorporateActionTypeSchema,
  ratio_base: z.union([z.number(), z.string()]).default(1),
  ratio_quote: z.union([z.number(), z.string()]).default(1),
  ex_date: z.string().default(''),
  notes: z.string().nullable().default(null),
  created_at: z.string().default(''),
});

export type CorporateAction = z.infer<typeof CorporateActionSchema>;

export interface CorporateActionCreate {
  account_id: string;
  symbol: string;
  action_type: CorporateActionType;
  ratio_base: number;
  ratio_quote: number;
  ex_date: string;
  notes?: string | null;
}

export const PaginatedCorporateActionsSchema = z.object({
  items: z.array(CorporateActionSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});
