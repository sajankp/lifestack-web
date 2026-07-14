import { z } from 'zod';
import api from './api';
import { paginatedSchema } from '../types/common';
import {
  AccountBalanceResponseSchema,
  AccountSchema,
  AccountStatementSchema,
  CapitalTransferSchema,
  CurrencySchema,
  NetWorthDataSchema,
  NetWorthHistoryItemSchema,
  ReconciliationSummarySchema,
  ReconciliationViewSchema,
  StatementLineSchema,
  UserFinanceSettingSchema,
  UserFxRateSchema,
  UserNetWorthPointSchema,
  WorkspaceFinanceSettingSchema,
} from '../types/finance';
import type {
  Account,
  AccountBalanceResponse,
  AccountCreate,
  AccountStatement,
  AccountUpdate,
  CapitalTransfer,
  CapitalTransferCreate,
  CapitalTransferUpdate,
  Currency,
  NetWorthData,
  NetWorthHistoryItem,
  ReconciliationSummary,
  ReconciliationView,
  StatementLine,
  UserFinanceSetting,
  UserFinanceSettingUpdate,
  WorkspaceFinanceSetting,
  WorkspaceFinanceSettingUpdate,
} from '../types/finance';


const PaginatedAccountsSchema = paginatedSchema(AccountSchema);
const PaginatedTransfersSchema = paginatedSchema(CapitalTransferSchema);
const PaginatedUserFxRatesSchema = paginatedSchema(UserFxRateSchema);
const PaginatedUserNetWorthPointsSchema = paginatedSchema(UserNetWorthPointSchema);

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

  updateTransfer: async (
    publicId: string,
    data: CapitalTransferUpdate,
  ): Promise<CapitalTransfer> => {
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

  getAccountStatements: async (publicId: string): Promise<AccountStatement[]> => {
    const response = await api.get(`/finance/accounts/${publicId}/statements`);
    return z.array(AccountStatementSchema).parse(response.data);
  },

  getStatementReconciliation: async (
    accountId: string,
    statementId: string,
  ): Promise<ReconciliationView> => {
    const response = await api.get(
      `/finance/accounts/${accountId}/statements/${statementId}/reconciliation`,
    );
    return ReconciliationViewSchema.parse(response.data);
  },

  confirmStatementLineMatch: async (
    accountId: string,
    statementId: string,
    lineId: string,
    body: { transaction_id?: string; transfer_id?: string; leg?: 'from' | 'to' },
  ): Promise<StatementLine> => {
    const response = await api.post(
      `/finance/accounts/${accountId}/statements/${statementId}/lines/${lineId}/match`,
      body,
    );
    return StatementLineSchema.parse(response.data);
  },

  unmatchStatementLine: async (
    accountId: string,
    statementId: string,
    lineId: string,
  ): Promise<StatementLine> => {
    const response = await api.post(
      `/finance/accounts/${accountId}/statements/${statementId}/lines/${lineId}/unmatch`,
    );
    return StatementLineSchema.parse(response.data);
  },

  getNetWorth: async (): Promise<NetWorthData> => {
    const response = await api.get('/finance/net-worth');
    return NetWorthDataSchema.parse(response.data);
  },

  getNetWorthHistory: async (
    fromDate?: string,
    toDate?: string,
  ): Promise<NetWorthHistoryItem[]> => {
    const response = await api.get('/finance/net-worth/history', {
      params: { from_date: fromDate, to_date: toDate },
    });
    return z.array(NetWorthHistoryItemSchema).parse(response.data);
  },

  getFxHistory: async (limit: number = 200, offset: number = 0) => {
    const response = await api.get('/finance/fx/history', { params: { limit, offset } });
    return PaginatedUserFxRatesSchema.parse(response.data);
  },

  deleteFxHistoryRow: async (id: number): Promise<void> => {
    await api.delete(`/finance/fx/history/${id}`);
  },

  getNetWorthUserPoints: async (limit: number = 200, offset: number = 0) => {
    const response = await api.get('/finance/net-worth/history/user-points', {
      params: { limit, offset },
    });
    return PaginatedUserNetWorthPointsSchema.parse(response.data);
  },

  deleteNetWorthUserPoint: async (id: number): Promise<void> => {
    await api.delete(`/finance/net-worth/history/user-points/${id}`);
  },
};
