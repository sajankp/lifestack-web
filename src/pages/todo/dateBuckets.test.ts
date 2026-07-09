import { describe, expect, it } from 'vitest';
import { bucketForDueDate, groupTodosByDueDate, splitParentsAndChildren } from './dateBuckets';
import type { Todo } from '../../services/todo';

const NOW = new Date('2026-07-09T09:00:00');

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

describe('bucketForDueDate', () => {
  it('buckets a null due date as No due date', () => {
    expect(bucketForDueDate(null, NOW)).toBe('No due date');
  });

  it('buckets yesterday as Overdue', () => {
    expect(bucketForDueDate('2026-07-08T23:00:00', NOW)).toBe('Overdue');
  });

  it('buckets later today as Today', () => {
    expect(bucketForDueDate('2026-07-09T23:59:00', NOW)).toBe('Today');
  });

  it('buckets earlier today (already passed) as Today, not Overdue', () => {
    expect(bucketForDueDate('2026-07-09T00:30:00', NOW)).toBe('Today');
  });

  it('buckets +7 days as Upcoming (inclusive boundary)', () => {
    expect(bucketForDueDate('2026-07-16T00:00:00', NOW)).toBe('Upcoming');
  });

  it('buckets +8 days as Later', () => {
    expect(bucketForDueDate('2026-07-17T00:00:00', NOW)).toBe('Later');
  });
});

describe('groupTodosByDueDate', () => {
  it('groups into buckets in fixed order and omits empty buckets', () => {
    const todos = [
      makeTodo({ public_id: 'overdue', due_date: '2026-07-08T00:00:00' }),
      makeTodo({ public_id: 'today', due_date: '2026-07-09T12:00:00' }),
      makeTodo({ public_id: 'no-date', due_date: null }),
    ];
    const buckets = groupTodosByDueDate(todos, NOW);
    expect(buckets.map((b) => b.label)).toEqual(['Overdue', 'Today', 'No due date']);
    expect(buckets[0].todos[0].public_id).toBe('overdue');
  });

  it('preserves the server-provided order within a bucket', () => {
    const todos = [
      makeTodo({ public_id: 'high', due_date: '2026-07-09T09:00:00', priority: 'high' }),
      makeTodo({ public_id: 'low', due_date: '2026-07-09T09:00:00', priority: 'low' }),
    ];
    const buckets = groupTodosByDueDate(todos, NOW);
    expect(buckets[0].todos.map((t) => t.public_id)).toEqual(['high', 'low']);
  });
});

describe('splitParentsAndChildren', () => {
  it('separates top-level todos from subtasks and groups children by parent', () => {
    const parent = makeTodo({ public_id: 'parent' });
    const childA = makeTodo({ public_id: 'child-a', parent_public_id: 'parent' });
    const childB = makeTodo({ public_id: 'child-b', parent_public_id: 'parent' });

    const { topLevel, childrenByParentId } = splitParentsAndChildren([parent, childA, childB]);

    expect(topLevel.map((t) => t.public_id)).toEqual(['parent']);
    expect(childrenByParentId.get('parent')?.map((t) => t.public_id)).toEqual([
      'child-a',
      'child-b',
    ]);
  });

  it('renders a subtask as top-level when its parent is not in the fetched list', () => {
    // The open-todos fetch is completed=false, so a subtask whose parent was
    // just completed (or deleted) would otherwise vanish entirely.
    const orphan = makeTodo({ public_id: 'orphan-child', parent_public_id: 'missing-parent' });

    const { topLevel, childrenByParentId } = splitParentsAndChildren([orphan]);

    expect(topLevel.map((t) => t.public_id)).toEqual(['orphan-child']);
    expect(childrenByParentId.size).toBe(0);
  });
});
