import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOverdueTodo } from './priorityDisplay';
import type { Todo } from '../../services/todo';

const makeTodo = (overrides: Partial<Todo>): Todo => ({
  public_id: 'id',
  title: 'title',
  description: '',
  due_date: null,
  priority: 'medium',
  completed: false,
  parent_public_id: null,
  subtask_count: 0,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isOverdueTodo', () => {
  it('treats date-only UTC-midnight due dates as overdue only after local end-of-day', () => {
    const todo = makeTodo({ due_date: '2026-07-17T00:00:00Z' });

    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 6, 17, 12, 0, 0, 0).getTime());
    expect(isOverdueTodo(todo)).toBe(false);

    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 6, 18, 0, 0, 0, 0).getTime());
    expect(isOverdueTodo(todo)).toBe(true);
  });

  it('keeps time-specific due dates overdue immediately after selected time', () => {
    const todo = makeTodo({ due_date: '2026-07-17T11:59:00' });

    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-17T11:58:00').getTime());
    expect(isOverdueTodo(todo)).toBe(false);

    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-17T12:00:00').getTime());
    expect(isOverdueTodo(todo)).toBe(true);
  });
});
