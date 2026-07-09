import { describe, expect, it, vi, beforeEach } from 'vitest';
import api from './api';
import { todoService } from './todo';

describe('todoService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls todo and recurring todo endpoints', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { items: [], total: 0 } } as never)
      .mockResolvedValueOnce({ data: { items: [], total: 0 } } as never);
    vi.spyOn(api, 'post')
      .mockResolvedValueOnce({ data: { public_id: 'todo-1' } } as never)
      .mockResolvedValueOnce({ data: { public_id: 'rule-1' } } as never);
    vi.spyOn(api, 'patch')
      .mockResolvedValueOnce({ data: { public_id: 'todo-1' } } as never)
      .mockResolvedValueOnce({ data: { public_id: 'rule-1' } } as never);
    vi.spyOn(api, 'delete')
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never);

    await todoService.getTodos(false, 10, 5);
    await todoService.createTodo({ title: 'Plan week', priority: 'low' });
    await todoService.updateTodo('todo-1', { priority: 'high' });
    await todoService.deleteTodo('todo-1');
    await todoService.getRecurringRules(true, 20, 0);
    await todoService.createRecurringRule({
      title: 'Weekly review',
      priority: 'low',
      frequency: 'weekly',
      interval: 1,
      anchor_date: '2026-06-01',
    });
    await todoService.updateRecurringRule('rule-1', { priority: 'medium' });
    await todoService.deleteRecurringRule('rule-1');

    expect(api.get).toHaveBeenNthCalledWith(1, '/todo/', {
      params: { limit: 10, offset: 5, sort: 'created_at', completed: false },
    });
    expect(api.post).toHaveBeenNthCalledWith(1, '/todo/', {
      title: 'Plan week',
      priority: 'low',
    });
    expect(api.patch).toHaveBeenNthCalledWith(1, '/todo/todo-1', { priority: 'high' });
    expect(api.delete).toHaveBeenNthCalledWith(1, '/todo/todo-1');
    expect(api.get).toHaveBeenNthCalledWith(2, '/todo/recurring/', {
      params: { is_active: true, limit: 20, offset: 0 },
    });
    expect(api.post).toHaveBeenNthCalledWith(2, '/todo/recurring/', {
      title: 'Weekly review',
      priority: 'low',
      frequency: 'weekly',
      interval: 1,
      anchor_date: '2026-06-01',
    });
    expect(api.patch).toHaveBeenNthCalledWith(2, '/todo/recurring/rule-1', {
      priority: 'medium',
    });
    expect(api.delete).toHaveBeenNthCalledWith(2, '/todo/recurring/rule-1');
  });
});
