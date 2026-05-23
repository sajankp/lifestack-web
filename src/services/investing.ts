import api from './api';
import type { PaginatedResponse } from '../types/common';
import type {
  CashBalance,
  CashBalanceCreate,
  CashBalanceUpdate,
  Holding,
  HoldingCreate,
  HoldingUpdate,
  InvestingSummary,
} from '../types/investing';

export const investingService = {
  getHoldings: async (limit: number = 50, offset: number = 0): Promise<PaginatedResponse<Holding>> => {
    const response = await api.get('/investing/holdings', { params: { limit, offset } });
    return response.data;
  },

  createHolding: async (data: HoldingCreate): Promise<Holding> => {
    const response = await api.post('/investing/holdings', data);
    return response.data;
  },

  updateHolding: async (publicId: string, data: HoldingUpdate): Promise<Holding> => {
    const response = await api.patch(`/investing/holdings/${publicId}`, data);
    return response.data;
  },

  deleteHolding: async (publicId: string): Promise<void> => {
    await api.delete(`/investing/holdings/${publicId}`);
  },

  getCashBalances: async (
    limit: number = 50,
    offset: number = 0,
  ): Promise<PaginatedResponse<CashBalance>> => {
    const response = await api.get('/investing/cash-balances', { params: { limit, offset } });
    return response.data;
  },

  createCashBalance: async (data: CashBalanceCreate): Promise<CashBalance> => {
    const response = await api.post('/investing/cash-balances', data);
    return response.data;
  },

  updateCashBalance: async (publicId: string, data: CashBalanceUpdate): Promise<CashBalance> => {
    const response = await api.patch(`/investing/cash-balances/${publicId}`, data);
    return response.data;
  },

  deleteCashBalance: async (publicId: string): Promise<void> => {
    await api.delete(`/investing/cash-balances/${publicId}`);
  },

  getSummary: async (): Promise<InvestingSummary> => {
    const response = await api.get('/investing/summary');
    return response.data;
  },
};
