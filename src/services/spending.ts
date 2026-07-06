import { z } from 'zod';
import api from './api';
import {
  BudgetPerformanceResponseSchema,
  BudgetSchema,
  CategoryBreakdownResponseSchema,
  CategorySchema,
  LedgerResponseSchema,
  RecurringTransactionSchema,
  SavingsRateResponseSchema,
  SpendingTrendResponseSchema,
  TransactionSchema,
  TransactionSummarySchema,
  UpcomingPreviewResponseSchema,
} from '../types/spending';
import type {
  Budget,
  BudgetCreate,
  BudgetPerformanceResponse,
  BudgetUpdate,
  Category,
  CategoryBreakdownResponse,
  CategoryCreate,
  CategoryUpdate,
  LedgerResponse,
  RecurringTransaction,
  RecurringTransactionCreate,
  RecurringTransactionUpdate,
  SavingsRateResponse,
  SpendingTrendResponse,
  Transaction,
  TransactionCreate,
  TransactionSort,
  TransactionSummary,
  TransactionUpdate,
  UpcomingPreviewResponse,
} from '../types/spending';

// Schemas and types live in src/types/spending.ts (G4); re-exported here so
// existing `from '../services/spending'` imports keep working.
export * from '../types/spending';

const PaginatedCategoriesSchema = z.object({
  items: z.array(CategorySchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const PaginatedTransactionsSchema = z.object({
  items: z.array(TransactionSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const PaginatedBudgetsSchema = z.object({
  items: z.array(BudgetSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const PaginatedRecurringSchema = z.object({
  items: z.array(RecurringTransactionSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

// ─── Service Implementation ──────────────────────────────────────────────────

export const spendingService = {
  // Categories
  getCategories: async (limit: number = 50, offset: number = 0): Promise<z.infer<typeof PaginatedCategoriesSchema>> => {
    const response = await api.get('/spending/categories', { params: { limit, offset } });
    return PaginatedCategoriesSchema.parse(response.data);
  },

  createCategory: async (data: CategoryCreate): Promise<Category> => {
    const response = await api.post('/spending/categories', data);
    return CategorySchema.parse(response.data);
  },

  updateCategory: async (publicId: string, data: CategoryUpdate): Promise<Category> => {
    const response = await api.patch(`/spending/categories/${publicId}`, data);
    return CategorySchema.parse(response.data);
  },

  deleteCategory: async (publicId: string): Promise<void> => {
    await api.delete(`/spending/categories/${publicId}`);
  },

  // Transactions
  getTransactions: async (
    limit: number = 50,
    offset: number = 0,
    params?: {
      categoryId?: string;
      accountId?: string;
      unassigned?: boolean;
      fromDate?: string;
      toDate?: string;
      sort?: TransactionSort;
    }
  ): Promise<z.infer<typeof PaginatedTransactionsSchema>> => {
    const response = await api.get('/spending/transactions', {
      params: {
        limit,
        offset,
        category_id: params?.categoryId,
        account_id: params?.unassigned ? undefined : params?.accountId,
        unassigned: params?.unassigned || undefined,
        from_date: params?.fromDate,
        to_date: params?.toDate,
        sort: params?.sort,
      },
    });
    return PaginatedTransactionsSchema.parse(response.data);
  },

  getTransactionSummary: async (
    params: { fromDate: string; toDate: string; categoryId?: string; accountId?: string }
  ): Promise<TransactionSummary> => {
    const response = await api.get('/spending/transactions/summary', {
      params: {
        from_date: params.fromDate,
        to_date: params.toDate,
        category_id: params.categoryId,
        account_id: params.accountId,
      },
    });
    return TransactionSummarySchema.parse(response.data);
  },

  createTransaction: async (data: TransactionCreate): Promise<Transaction> => {
    const response = await api.post('/spending/transactions', data);
    return TransactionSchema.parse(response.data);
  },

  updateTransaction: async (publicId: string, data: TransactionUpdate): Promise<Transaction> => {
    const response = await api.patch(`/spending/transactions/${publicId}`, data);
    return TransactionSchema.parse(response.data);
  },

  deleteTransaction: async (publicId: string): Promise<void> => {
    await api.delete(`/spending/transactions/${publicId}`);
  },

  // Budgets
  getBudgets: async (
    limit: number = 50,
    offset: number = 0,
    monthStart?: string
  ): Promise<z.infer<typeof PaginatedBudgetsSchema>> => {
    const response = await api.get('/spending/budgets', {
      params: { limit, offset, month_start: monthStart },
    });
    return PaginatedBudgetsSchema.parse(response.data);
  },

  createBudget: async (data: BudgetCreate): Promise<Budget> => {
    const response = await api.post('/spending/budgets', data);
    return BudgetSchema.parse(response.data);
  },

  updateBudget: async (publicId: string, data: BudgetUpdate): Promise<Budget> => {
    const response = await api.patch(`/spending/budgets/${publicId}`, data);
    return BudgetSchema.parse(response.data);
  },

  getTrends: async (fromMonth: string, toMonth: string): Promise<SpendingTrendResponse> => {
    const response = await api.get('/spending/analytics/trends', {
      params: { from: `${fromMonth}-01`, to: `${toMonth}-01` },
    });
    return SpendingTrendResponseSchema.parse(response.data);
  },

  getCategoryBreakdown: async (
    from: string,
    to: string,
    type: 'income' | 'expense' = 'expense',
    limit: number = 10
  ): Promise<CategoryBreakdownResponse> => {
    const response = await api.get('/spending/analytics/breakdown', {
      params: { from, to, type, limit },
    });
    return CategoryBreakdownResponseSchema.parse(response.data);
  },

  getBudgetPerformance: async (
    fromMonth: string,
    toMonth: string
  ): Promise<BudgetPerformanceResponse> => {
    const response = await api.get('/spending/analytics/budget-performance', {
      params: { from: `${fromMonth}-01`, to: `${toMonth}-01` },
    });
    return BudgetPerformanceResponseSchema.parse(response.data);
  },

  getSavingsRate: async (
    fromMonth: string,
    toMonth: string
  ): Promise<SavingsRateResponse> => {
    const response = await api.get('/spending/analytics/savings-rate', {
      params: { from: `${fromMonth}-01`, to: `${toMonth}-01` },
    });
    return SavingsRateResponseSchema.parse(response.data);
  },

  // Recurring Transactions
  getRecurring: async (
    limit: number = 50,
    offset: number = 0,
    isActive?: boolean
  ): Promise<z.infer<typeof PaginatedRecurringSchema>> => {
    const response = await api.get('/spending/recurring', {
      params: { limit, offset, is_active: isActive },
    });
    return PaginatedRecurringSchema.parse(response.data);
  },

  createRecurring: async (data: RecurringTransactionCreate): Promise<RecurringTransaction> => {
    const response = await api.post('/spending/recurring', data);
    return RecurringTransactionSchema.parse(response.data);
  },

  updateRecurring: async (publicId: string, data: RecurringTransactionUpdate): Promise<RecurringTransaction> => {
    const response = await api.patch(`/spending/recurring/${publicId}`, data);
    return RecurringTransactionSchema.parse(response.data);
  },

  deleteRecurring: async (publicId: string): Promise<void> => {
    await api.delete(`/spending/recurring/${publicId}`);
  },

  getUpcoming: async (days: number = 30): Promise<UpcomingPreviewResponse> => {
    const response = await api.get('/spending/recurring/upcoming', {
      params: { days },
    });
    return UpcomingPreviewResponseSchema.parse(response.data);
  },

  getAccountLedger: async (
    accountId: string,
    params?: { limit?: number; offset?: number; from_date?: string; to_date?: string }
  ): Promise<LedgerResponse> => {
    const response = await api.get(`/spending/accounts/${accountId}/ledger`, { params });
    return LedgerResponseSchema.parse(response.data);
  },
};
