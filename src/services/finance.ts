import api from './api';
import type { PaginatedResponse } from '../types/common';
import type {
  Account,
  AccountCreate,
  AccountUpdate,
  CapitalTransfer,
  CapitalTransferCreate,
  Currency,
  WorkspaceFinanceSetting,
  WorkspaceFinanceSettingUpdate,
} from '../types/finance';

export const financeService = {
  getCurrencies: async (): Promise<Currency[]> => {
    const response = await api.get('/finance/currencies');
    return response.data;
  },

  getAccounts: async (limit: number = 200, offset: number = 0): Promise<PaginatedResponse<Account>> => {
    const response = await api.get('/finance/accounts', { params: { limit, offset } });
    return response.data;
  },

  createAccount: async (data: AccountCreate): Promise<Account> => {
    const response = await api.post('/finance/accounts', data);
    return response.data;
  },

  updateAccount: async (publicId: string, data: AccountUpdate): Promise<Account> => {
    const response = await api.patch(`/finance/accounts/${publicId}`, data);
    return response.data;
  },

  deleteAccount: async (publicId: string): Promise<void> => {
    await api.delete(`/finance/accounts/${publicId}`);
  },

  getSettings: async (): Promise<WorkspaceFinanceSetting> => {
    const response = await api.get('/finance/settings');
    return response.data;
  },

  updateSettings: async (data: WorkspaceFinanceSettingUpdate): Promise<WorkspaceFinanceSetting> => {
    const response = await api.patch('/finance/settings', data);
    return response.data;
  },

  createTransfer: async (data: CapitalTransferCreate) => {
    const response = await api.post('/finance/transfers', data);
    return response.data;
  },

  getTransfers: async (limit: number = 50, offset: number = 0): Promise<PaginatedResponse<CapitalTransfer>> => {
    const response = await api.get('/finance/transfers', { params: { limit, offset } });
    return response.data;
  },
};
