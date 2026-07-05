import { z } from 'zod';
import api from './api';
import { paginatedSchema } from '../types/common';
import {
  AccountBalanceResponseSchema,
  AccountSchema,
  CapitalTransferSchema,
  CurrencySchema,
  NetWorthDataSchema,
  ReconciliationSummarySchema,
  UserFinanceSettingSchema,
  WorkspaceFinanceSettingSchema,
} from '../types/finance';
import type {
  Account,
  AccountBalanceResponse,
  AccountCreate,
  AccountUpdate,
  CapitalTransfer,
  CapitalTransferCreate,
  CapitalTransferUpdate,
  Currency,
  NetWorthData,
  ReconciliationSummary,
  UserFinanceSetting,
  UserFinanceSettingUpdate,
  WorkspaceFinanceSetting,
  WorkspaceFinanceSettingUpdate,
} from '../types/finance';

const PaginatedAccountsSchema = paginatedSchema(AccountSchema);
const PaginatedTransfersSchema = paginatedSchema(CapitalTransferSchema);

export const financeService = {
  getCurrencies: async (): Promise<Currency[]> => {
    const response = await api.get('/finance/currencies');
    return z.array(CurrencySchema).parse(response.data);
  },

  getAccounts: async (
    limit: number = 200,
    offset: number = 0,
  ): Promise<z.infer<typeof PaginatedAccountsSchema>> => {
    const response = await api.get('/finance/accounts', { params: { limit, offset } });
    return PaginatedAccountsSchema.parse(response.data);
  },

  createAccount: async (data: AccountCreate): Promise<Account> => {
    const response = await api.post('/finance/accounts', data);
    return AccountSchema.parse(response.data);
  },

  updateAccount: async (publicId: string, data: AccountUpdate): Promise<Account> => {
    const response = await api.patch(`/finance/accounts/${publicId}`, data);
    return AccountSchema.parse(response.data);
  },

  deleteAccount: async (publicId: string): Promise<void> => {
    await api.delete(`/finance/accounts/${publicId}`);
  },

  getSettings: async (): Promise<WorkspaceFinanceSetting> => {
    const response = await api.get('/finance/settings');
    return WorkspaceFinanceSettingSchema.parse(response.data);
  },

  updateSettings: async (data: WorkspaceFinanceSettingUpdate): Promise<WorkspaceFinanceSetting> => {
    const response = await api.patch('/finance/settings', data);
    return WorkspaceFinanceSettingSchema.parse(response.data);
  },

  getUserSettings: async (): Promise<UserFinanceSetting> => {
    const response = await api.get('/finance/settings/user');
    return UserFinanceSettingSchema.parse(response.data);
  },

  updateUserSettings: async (data: UserFinanceSettingUpdate): Promise<UserFinanceSetting> => {
    const response = await api.patch('/finance/settings/user', data);
    return UserFinanceSettingSchema.parse(response.data);
  },

  createTransfer: async (data: CapitalTransferCreate): Promise<CapitalTransfer> => {
    const response = await api.post('/finance/transfers', data);
    return CapitalTransferSchema.parse(response.data);
  },

  getTransfers: async (
    limit: number = 50,
    offset: number = 0,
  ): Promise<z.infer<typeof PaginatedTransfersSchema>> => {
    const response = await api.get('/finance/transfers', { params: { limit, offset } });
    return PaginatedTransfersSchema.parse(response.data);
  },

  updateTransfer: async (publicId: string, data: CapitalTransferUpdate): Promise<CapitalTransfer> => {
    const response = await api.patch(`/finance/transfers/${publicId}`, data);
    return CapitalTransferSchema.parse(response.data);
  },

  deleteTransfer: async (publicId: string): Promise<void> => {
    await api.delete(`/finance/transfers/${publicId}`);
  },

  getAccountBalance: async (publicId: string): Promise<AccountBalanceResponse> => {
    const response = await api.get(`/finance/accounts/${publicId}/balance`);
    return AccountBalanceResponseSchema.parse(response.data);
  },

  getAccountReconciliation: async (publicId: string): Promise<ReconciliationSummary> => {
    const response = await api.get(`/finance/accounts/${publicId}/reconciliation`);
    return ReconciliationSummarySchema.parse(response.data);
  },

  getNetWorth: async (): Promise<NetWorthData> => {
    const response = await api.get('/finance/net-worth');
    return NetWorthDataSchema.parse(response.data);
  },
};
