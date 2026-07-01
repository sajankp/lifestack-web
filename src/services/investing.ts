import { z } from 'zod';
import api from './api';

// ─── Zod Schemas with default values for test resiliency ────────────────────

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

const PaginatedOrdersSchema = z.object({
  items: z.array(InvestingOrderSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

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

const PaginatedHoldingsSchema = z.object({
  items: z.array(HoldingSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const PaginatedCashBalancesSchema = z.object({
  items: z.array(CashBalanceSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

// ─── Service Implementation ──────────────────────────────────────────────────

export const investingService = {
  getHoldings: async (limit: number = 50, offset: number = 0): Promise<z.infer<typeof PaginatedHoldingsSchema>> => {
    const response = await api.get('/investing/holdings', { params: { limit, offset } });
    return PaginatedHoldingsSchema.parse(response.data);
  },

  updateHolding: async (publicId: string, data: HoldingUpdate): Promise<Holding> => {
    const response = await api.patch(`/investing/holdings/${publicId}`, data);
    return HoldingSchema.parse(response.data);
  },

  deleteHolding: async (publicId: string): Promise<void> => {
    await api.delete(`/investing/holdings/${publicId}`);
  },

  getCashBalances: async (
    limit: number = 50,
    offset: number = 0,
    accountId?: string,
  ): Promise<z.infer<typeof PaginatedCashBalancesSchema>> => {
    const response = await api.get('/investing/cash-balances', {
      params: { limit, offset, account_id: accountId || undefined },
    });
    return PaginatedCashBalancesSchema.parse(response.data);
  },

  createCashBalance: async (data: CashBalanceCreate): Promise<CashBalance> => {
    const response = await api.post('/investing/cash-balances', data);
    return CashBalanceSchema.parse(response.data);
  },

  updateCashBalance: async (publicId: string, data: CashBalanceUpdate): Promise<CashBalance> => {
    const response = await api.patch(`/investing/cash-balances/${publicId}`, data);
    return CashBalanceSchema.parse(response.data);
  },

  deleteCashBalance: async (publicId: string): Promise<void> => {
    await api.delete(`/investing/cash-balances/${publicId}`);
  },

  getSummary: async (): Promise<InvestingSummary> => {
    const response = await api.get('/investing/summary');
    return InvestingSummarySchema.parse(response.data);
  },

  getInstruments: async (): Promise<Instrument[]> => {
    const response = await api.get('/investing/instruments');
    return z.array(InstrumentSchema).default([]).parse(response.data);
  },

  createInstrument: async (data: InstrumentCreate): Promise<Instrument> => {
    const response = await api.post('/investing/instruments', data);
    return InstrumentSchema.parse(response.data);
  },

  updateInstrument: async (publicId: string, data: InstrumentUpdate): Promise<Instrument> => {
    const response = await api.patch(`/investing/instruments/${publicId}`, data);
    return InstrumentSchema.parse(response.data);
  },

  getInstrumentConstituents: async (
    instrumentId: string,
    asOf: string,
  ): Promise<InstrumentConstituent[]> => {
    const response = await api.get(`/investing/instruments/${instrumentId}/constituents`, {
      params: { as_of: asOf },
    });
    return z.array(InstrumentConstituentSchema).default([]).parse(response.data);
  },

  upsertInstrumentConstituents: async (
    instrumentId: string,
    data: InstrumentConstituentUpsert,
  ): Promise<InstrumentConstituent[]> => {
    const response = await api.post(`/investing/instruments/${instrumentId}/constituents`, data);
    return z.array(InstrumentConstituentSchema).default([]).parse(response.data);
  },

  getExposureAnalytics: async (asOf: string): Promise<ExposureAnalytics> => {
    const response = await api.get('/investing/analytics/exposure', { params: { as_of: asOf } });
    return ExposureAnalyticsSchema.parse(response.data);
  },

  getOverlapAnalytics: async (asOf: string): Promise<OverlapAnalytics> => {
    const response = await api.get('/investing/analytics/overlap', { params: { as_of: asOf } });
    return OverlapAnalyticsSchema.parse(response.data);
  },

  getPerformanceSummary: async (): Promise<PerformanceSummary> => {
    const response = await api.get('/investing/performance/summary');
    return PerformanceSummarySchema.parse(response.data);
  },

  refreshPrices: async (): Promise<{ updated: string[] }> => {
    const response = await api.post('/investing/prices/refresh');
    return z.object({ updated: z.array(z.string()).default([]) }).parse(response.data);
  },

  submitPrices: async (data: {
    price_date: string;
    prices: Array<{ holding_public_id: string; unit_price: number | string }>;
  }): Promise<void> => {
    await api.post('/investing/prices', data);
  },

  placeOrder: async (data: InvestingOrderCreate): Promise<InvestingOrder> => {
    const response = await api.post('/investing/orders', data);
    return InvestingOrderSchema.parse(response.data);
  },

  getOrders: async (
    limit: number = 50,
    offset: number = 0,
    filters?: { symbol?: string; order_type?: OrderType; search?: string },
  ): Promise<z.infer<typeof PaginatedOrdersSchema>> => {
    const response = await api.get('/investing/orders', {
      params: { limit, offset, ...filters },
    });
    return PaginatedOrdersSchema.parse(response.data);
  },

  getOrder: async (publicId: string): Promise<InvestingOrder> => {
    const response = await api.get(`/investing/orders/${publicId}`);
    return InvestingOrderSchema.parse(response.data);
  },

  deleteOrder: async (publicId: string): Promise<void> => {
    await api.delete(`/investing/orders/${publicId}`);
  },

  updateOrder: async (publicId: string, data: InvestingOrderUpdate): Promise<InvestingOrder> => {
    const response = await api.patch(`/investing/orders/${publicId}`, data);
    return InvestingOrderSchema.parse(response.data);
  },

  getOrdersForHolding: async (symbol: string, accountId: string): Promise<InvestingOrder[]> => {
    const response = await api.get(`/investing/orders/by-holding/${symbol}`, {
      params: { account_id: accountId },
    });
    return z.array(InvestingOrderSchema).default([]).parse(response.data);
  },

  bulkImportOrders: async (data: InvestingOrderBulkCreate): Promise<InvestingOrder[]> => {
    const response = await api.post('/investing/orders/bulk', data);
    return z.array(InvestingOrderSchema).default([]).parse(response.data);
  },
};
