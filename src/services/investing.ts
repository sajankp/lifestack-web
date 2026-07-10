import { z } from 'zod';
import api from './api';
import {
  CashBalanceSchema,
  CorporateActionSchema,
  DividendBulkImportResultSchema,
  DividendSchema,
  ExposureAnalyticsSchema,
  HoldingSchema,
  InstrumentConstituentSchema,
  InstrumentSchema,
  InvestingOrderSchema,
  InvestingSummarySchema,
  OverlapAnalyticsSchema,
  PaginatedCorporateActionsSchema,
  PaginatedDividendsSchema,
  PerformanceSummarySchema,
  ReturnMetricsResponseSchema,
} from '../types/investing';
import type {
  CashBalance,
  CashBalanceCreate,
  CashBalanceUpdate,
  CorporateAction,
  CorporateActionCreate,
  Dividend,
  DividendBulkImportResult,
  DividendBulkImportRow,
  DividendCreate,
  DividendUpdate,
  ExposureAnalytics,
  Holding,
  HoldingUpdate,
  Instrument,
  InstrumentConstituent,
  InstrumentConstituentUpsert,
  InstrumentCreate,
  InstrumentUpdate,
  InvestingOrder,
  InvestingOrderBulkCreate,
  InvestingOrderCreate,
  InvestingOrderUpdate,
  InvestingSummary,
  OrderType,
  OverlapAnalytics,
  PerformanceSummary,
  ReturnMetricsResponse,
} from '../types/investing';

// Schemas and types live in src/types/investing.ts (G4); re-exported here so
// existing `from '../services/investing'` imports keep working.
export * from '../types/investing';

const PaginatedOrdersSchema = z.object({
  items: z.array(InvestingOrderSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

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
  getHoldings: async (
    limit: number = 50,
    offset: number = 0,
  ): Promise<z.infer<typeof PaginatedHoldingsSchema>> => {
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

  getDividends: async (
    limit: number = 50,
    offset: number = 0,
    accountId?: string,
  ): Promise<z.infer<typeof PaginatedDividendsSchema>> => {
    const response = await api.get('/investing/dividends', {
      params: { limit, offset, account_id: accountId || undefined },
    });
    return PaginatedDividendsSchema.parse(response.data);
  },

  createDividend: async (data: DividendCreate): Promise<Dividend> => {
    const response = await api.post('/investing/dividends', data);
    return DividendSchema.parse(response.data);
  },

  updateDividend: async (publicId: string, data: DividendUpdate): Promise<Dividend> => {
    const response = await api.patch(`/investing/dividends/${publicId}`, data);
    return DividendSchema.parse(response.data);
  },

  deleteDividend: async (publicId: string): Promise<void> => {
    await api.delete(`/investing/dividends/${publicId}`);
  },

  bulkImportDividends: async (rows: DividendBulkImportRow[]): Promise<DividendBulkImportResult> => {
    const response = await api.post('/investing/dividends/bulk', { rows });
    return DividendBulkImportResultSchema.parse(response.data);
  },

  getCorporateActions: async (
    limit: number = 50,
    offset: number = 0,
    accountId?: string,
  ): Promise<z.infer<typeof PaginatedCorporateActionsSchema>> => {
    const response = await api.get('/investing/corporate-actions', {
      params: { limit, offset, account_id: accountId || undefined },
    });
    return PaginatedCorporateActionsSchema.parse(response.data);
  },

  createCorporateAction: async (data: CorporateActionCreate): Promise<CorporateAction> => {
    const response = await api.post('/investing/corporate-actions', data);
    return CorporateActionSchema.parse(response.data);
  },

  deleteCorporateAction: async (publicId: string): Promise<void> => {
    await api.delete(`/investing/corporate-actions/${publicId}`);
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

  getReturnMetrics: async (): Promise<ReturnMetricsResponse> => {
    const response = await api.get('/investing/performance/returns');
    return ReturnMetricsResponseSchema.parse(response.data);
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
