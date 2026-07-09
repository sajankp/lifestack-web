import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskRow } from './TaskRow';
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

const noop = vi.fn();

describe('TaskRow subtask progress', () => {
  it('derives the done count from the server total, not from the fetched (open-only) subtasks list', () => {
    // The open-todos fetch is completed=false, so a completed subtask never
    // appears in `subtasks` — only `todo.subtask_count` (server total) knows
    // about it. Regression test for a bug where the badge read 0/1 instead
    // of 1/2 because it derived the total from subtasks.length.
    const parent = makeTodo({ public_id: 'parent-1', title: 'Plan trip', subtask_count: 2 });
    const openChild = makeTodo({ public_id: 'child-1', title: 'Pack bags', parent_public_id: 'parent-1' });

    render(
      <TaskRow
        todo={parent}
        formatDueDateTime={() => null}
        subtasks={[openChild]}
        onToggle={noop}
        onEdit={noop}
        onDeleteRequest={noop}
      />,
    );

    expect(screen.getByTestId('todo-subtask-progress-parent-1')).toHaveTextContent('1/2');
  });

  it('shows N/N when every subtask is completed (none left in the open fetch)', () => {
    const parent = makeTodo({ public_id: 'parent-2', title: 'Plan trip', subtask_count: 2 });

    render(
      <TaskRow
        todo={parent}
        formatDueDateTime={() => null}
        subtasks={[]}
        onToggle={noop}
        onEdit={noop}
        onDeleteRequest={noop}
      />,
    );

    expect(screen.getByTestId('todo-subtask-progress-parent-2')).toHaveTextContent('2/2');
  });

  it('renders no progress badge for a todo without subtasks', () => {
    const parent = makeTodo({ public_id: 'parent-3', subtask_count: 0 });

    render(
      <TaskRow
        todo={parent}
        formatDueDateTime={() => null}
        subtasks={[]}
        onToggle={noop}
        onEdit={noop}
        onDeleteRequest={noop}
      />,
    );

    expect(screen.queryByTestId('todo-subtask-progress-parent-3')).not.toBeInTheDocument();
  });
});
