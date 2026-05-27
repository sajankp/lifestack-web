import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './api';
import { spendingService } from './spending';

describe('spendingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls categories endpoints', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { items: [], total: 0 } } as never);
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { public_id: 'cat1' } } as never);
    vi.spyOn(api, 'delete').mockResolvedValueOnce({} as never);

    await spendingService.getCategories(20, 10);
    await spendingService.createCategory({ name: 'Rent', icon: '🏠', color: '#ff0000' });
    await spendingService.deleteCategory('cat1');

    expect(api.get).toHaveBeenCalledWith('/spending/categories', { params: { limit: 20, offset: 10 } });
    expect(api.post).toHaveBeenCalledWith('/spending/categories', { name: 'Rent', icon: '🏠', color: '#ff0000' });
    expect(api.delete).toHaveBeenCalledWith('/spending/categories/cat1');
  });

  it('calls transactions endpoints', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { items: [], total: 0 } } as never)
      .mockResolvedValueOnce({ data: { total_expenses: '0' } } as never)
      .mockResolvedValueOnce({ data: { public_id: 'tx1' } } as never);
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { public_id: 'tx1' } } as never);
    vi.spyOn(api, 'patch').mockResolvedValueOnce({ data: { public_id: 'tx1' } } as never);
    vi.spyOn(api, 'delete').mockResolvedValueOnce({} as never);

    await spendingService.getTransactions(10, 0, { categoryId: 'cat1', fromDate: '2026-05-01', toDate: '2026-05-31' });
    await spendingService.getTransactionSummary({ fromDate: '2026-05-01', toDate: '2026-05-31', categoryId: 'cat1' });
    await spendingService.getTransaction('tx1');
    await spendingService.createTransaction({ amount: 100, type: 'expense', category_id: 'cat1', occurred_at: '2026-05-01' } as never);
    await spendingService.updateTransaction('tx1', { amount: 120 });
    await spendingService.deleteTransaction('tx1');

    expect(api.get).toHaveBeenNthCalledWith(1, '/spending/transactions', {
      params: { limit: 10, offset: 0, category_id: 'cat1', from_date: '2026-05-01', to_date: '2026-05-31' }
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/spending/transactions/summary', {
      params: { from_date: '2026-05-01', to_date: '2026-05-31', category_id: 'cat1' }
    });
    expect(api.get).toHaveBeenNthCalledWith(3, '/spending/transactions/tx1');
    expect(api.post).toHaveBeenCalledWith('/spending/transactions', { amount: 100, type: 'expense', category_id: 'cat1', occurred_at: '2026-05-01' });
    expect(api.patch).toHaveBeenCalledWith('/spending/transactions/tx1', { amount: 120 });
    expect(api.delete).toHaveBeenCalledWith('/spending/transactions/tx1');
  });

  it('calls budgets and trends endpoints', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { items: [], total: 0 } } as never)
      .mockResolvedValueOnce({ data: { points: [] } } as never);
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { public_id: 'b1' } } as never);
    vi.spyOn(api, 'patch').mockResolvedValueOnce({ data: { public_id: 'b1' } } as never);

    await spendingService.getBudgets(50, 0, '2026-05-01');
    await spendingService.createBudget({ amount: 500, category_id: 'cat1', month_start: '2026-05-01' } as never);
    await spendingService.updateBudget('b1', { amount: 600 } as never);
    await spendingService.getTrends('2026-01', '2026-05');

    expect(api.get).toHaveBeenNthCalledWith(1, '/spending/budgets', { params: { limit: 50, offset: 0, month_start: '2026-05-01' } });
    expect(api.post).toHaveBeenCalledWith('/spending/budgets', { amount: 500, category_id: 'cat1', month_start: '2026-05-01' });
    expect(api.patch).toHaveBeenCalledWith('/spending/budgets/b1', { amount: 600 });
    expect(api.get).toHaveBeenNthCalledWith(2, '/spending/analytics/trends', { params: { from: '2026-01-01', to: '2026-05-01' } });
  });

  it('calls recurring endpoints', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { items: [], total: 0 } } as never)
      .mockResolvedValueOnce({ data: { items: [] } } as never);
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { public_id: 'r1' } } as never);
    vi.spyOn(api, 'patch').mockResolvedValueOnce({ data: { public_id: 'r1' } } as never);
    vi.spyOn(api, 'delete').mockResolvedValueOnce({} as never);

    await spendingService.getRecurring(10, 5, true);
    await spendingService.createRecurring({ amount: 15, category_id: 'cat1', frequency: 'monthly', interval: 1, anchor_date: '2026-05-01' } as never);
    await spendingService.updateRecurring('r1', { amount: 20 });
    await spendingService.deleteRecurring('r1');
    await spendingService.getUpcoming(45);

    expect(api.get).toHaveBeenNthCalledWith(1, '/spending/recurring', { params: { limit: 10, offset: 5, is_active: true } });
    expect(api.post).toHaveBeenCalledWith('/spending/recurring', { amount: 15, category_id: 'cat1', frequency: 'monthly', interval: 1, anchor_date: '2026-05-01' });
    expect(api.patch).toHaveBeenCalledWith('/spending/recurring/r1', { amount: 20 });
    expect(api.delete).toHaveBeenCalledWith('/spending/recurring/r1');
    expect(api.get).toHaveBeenNthCalledWith(2, '/spending/recurring/upcoming', { params: { days: 45 } });
  });
});
