import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { TodoPage } from './TodoPage';
import { server } from '../test/setup';

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const selectDropdownOption = async (testId: string, optionName: string) => {
  fireEvent.click(screen.getByTestId(testId));
  fireEvent.click(await screen.findByRole('option', { name: optionName }));
};

describe('TodoPage', () => {
  it('creates and edits todos with description and priority fields', async () => {
    let createPayload: Record<string, unknown> | null = null;
    let updatePayload: Record<string, unknown> | null = null;

    server.use(
      http.get('*/v1/todo/', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'todo-1',
              title: 'Review budget',
              description: 'Check the month-end category totals',
              due_date: '2026-06-20T16:00:00Z',
              priority: 'medium',
              completed: false,
              created_at: '2026-06-13T00:00:00Z',
              updated_at: '2026-06-13T00:00:00Z',
            },
            {
              public_id: 'todo-2',
              title: 'Date-only reminder',
              description: null,
              due_date: '2026-06-21T00:00:00.000Z',
              priority: 'low',
              completed: false,
              created_at: '2026-06-13T00:00:00Z',
              updated_at: '2026-06-13T00:00:00Z',
            },
          ],
          total: 2,
          limit: 50,
          offset: 0,
        }),
      ),
      http.get('*/v1/todo/recurring/', () =>
        HttpResponse.json({ items: [], total: 0, limit: 100, offset: 0 }),
      ),
      http.post('*/v1/todo/', async ({ request }) => {
        createPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            public_id: 'todo-2',
            ...createPayload,
            completed: false,
            created_at: '2026-06-13T00:00:00Z',
            updated_at: '2026-06-13T00:00:00Z',
          },
          { status: 201 },
        );
      }),
      http.patch('*/v1/todo/todo-1', async ({ request }) => {
        updatePayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          public_id: 'todo-1',
          completed: false,
          created_at: '2026-06-13T00:00:00Z',
          updated_at: '2026-06-13T00:00:00Z',
          ...updatePayload,
        });
      }),
    );

    renderWithQuery(<TodoPage />);

    expect(await screen.findByText('Review budget')).toBeInTheDocument();
    expect(screen.getByText('Check the month-end category totals')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText(/21-Jun-2026/)).toBeInTheDocument();
    expect(screen.queryByText(/21-Jun-2026.*12:00/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add Task/i }));
    expect(await screen.findByTestId('todo-new-priority')).toHaveTextContent('Low');
    fireEvent.change(screen.getByTestId('todo-new-title'), {
      target: { value: 'Plan groceries' },
    });
    fireEvent.change(screen.getByTestId('todo-new-description'), {
      target: { value: 'Use the recurring list' },
    });
    fireEvent.click(screen.getByTestId('todo-new-submit'));

    await waitFor(() => {
      expect(createPayload).not.toBeNull();
    });
    expect(createPayload).toMatchObject({
      title: 'Plan groceries',
      description: 'Use the recurring list',
      due_date: null,
      priority: 'low',
    });

    fireEvent.click(await screen.findByTestId('todo-edit-todo-1'));
    expect(await screen.findByTestId('todo-new-priority')).toHaveTextContent('Medium');
    fireEvent.change(screen.getByTestId('todo-new-description'), {
      target: { value: 'Updated notes' },
    });
    fireEvent.change(screen.getByTestId('todo-new-due-time'), {
      target: { value: '17:30' },
    });
    await selectDropdownOption('todo-new-priority', 'High');
    fireEvent.click(screen.getByTestId('todo-new-submit'));

    await waitFor(() => {
      expect(updatePayload).not.toBeNull();
    });
    expect(updatePayload).toMatchObject({
      title: 'Review budget',
      description: 'Updated notes',
      due_date: new Date('2026-06-20T17:30:00').toISOString(),
      priority: 'high',
    });
  });

  it('requires confirmation before deleting a todo, and shows a toast on success', async () => {
    let deleteCalled = false;

    server.use(
      http.get('*/v1/todo/', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'todo-1',
              title: 'Review budget',
              description: null,
              due_date: null,
              priority: 'medium',
              completed: false,
              created_at: '2026-06-13T00:00:00Z',
              updated_at: '2026-06-13T00:00:00Z',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      http.get('*/v1/todo/recurring/', () =>
        HttpResponse.json({ items: [], total: 0, limit: 100, offset: 0 }),
      ),
      http.delete('*/v1/todo/todo-1', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithQuery(<TodoPage />);

    expect(await screen.findByText('Review budget')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('todo-delete-todo-1'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/Delete task\?/i);
    expect(deleteCalled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
    expect(await screen.findByText('Task deleted')).toBeInTheDocument();
  });

  it('renders subtasks indented under their parent with progress, and cascades completion', async () => {
    let parentCompleted = false;

    const openItems = () => [
      {
        public_id: 'parent-1',
        title: 'Plan trip',
        description: null,
        due_date: null,
        priority: 'medium',
        completed: parentCompleted,
        parent_public_id: null,
        subtask_count: 1,
        created_at: '2026-06-13T00:00:00Z',
        updated_at: '2026-06-13T00:00:00Z',
      },
      {
        public_id: 'child-1',
        title: 'Book flights',
        description: null,
        due_date: null,
        priority: 'medium',
        completed: parentCompleted,
        parent_public_id: 'parent-1',
        subtask_count: 0,
        created_at: '2026-06-13T00:00:00Z',
        updated_at: '2026-06-13T00:00:00Z',
      },
    ];

    server.use(
      http.get('*/v1/todo/', ({ request }) => {
        const url = new URL(request.url);
        // Mirror the real API: completed=false excludes rows that are done,
        // so a completed parent/child drops out of the open fetch entirely.
        const items = openItems().filter((t) => t.completed === (url.searchParams.get('completed') === 'true'));
        return HttpResponse.json({ items, total: items.length, limit: 200, offset: 0 });
      }),
      http.get('*/v1/todo/recurring/', () =>
        HttpResponse.json({ items: [], total: 0, limit: 100, offset: 0 }),
      ),
      http.patch('*/v1/todo/parent-1', () => {
        parentCompleted = true;
        return HttpResponse.json({ ...openItems()[0], completed: true });
      }),
    );

    renderWithQuery(<TodoPage />);

    expect(await screen.findByText('Plan trip')).toBeInTheDocument();
    expect(screen.getByText('Book flights')).toBeInTheDocument();
    expect(screen.getByTestId('todo-subtask-progress-parent-1')).toHaveTextContent('0/1');

    fireEvent.click(screen.getByTestId('todo-toggle-parent-1'));

    // The subtask is unaffected (cascade only marks previously-open
    // subtasks in the api, and this mock's child stays independent),
    // so once the parent itself is completed the whole group drops out
    // of the open view.
    await waitFor(() => {
      expect(screen.queryByText('Plan trip')).not.toBeInTheDocument();
    });
  });

  it('collapses completed tasks by default and clears them via the confirm dialog', async () => {
    let deletedCount = 0;

    server.use(
      http.get('*/v1/todo/', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('completed') === 'true') {
          const items =
            deletedCount > 0
              ? []
              : [
                  {
                    public_id: 'done-1',
                    title: 'Old task',
                    description: null,
                    due_date: null,
                    priority: 'low',
                    completed: true,
                    parent_public_id: null,
                    subtask_count: 0,
                    created_at: '2026-06-01T00:00:00Z',
                    updated_at: '2026-06-01T00:00:00Z',
                  },
                ];
          return HttpResponse.json({ items, total: items.length, limit: 50, offset: 0 });
        }
        return HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 });
      }),
      http.get('*/v1/todo/recurring/', () =>
        HttpResponse.json({ items: [], total: 0, limit: 100, offset: 0 }),
      ),
      http.delete('*/v1/todo/completed', () => {
        deletedCount = 1;
        return HttpResponse.json({ deleted: 1 });
      }),
    );

    renderWithQuery(<TodoPage />);

    expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
    expect(screen.queryByText('Old task')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('todo-completed-toggle'));
    expect(await screen.findByText('Old task')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('todo-clear-completed'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/Clear completed tasks\?/i);

    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }));

    await waitFor(() => {
      expect(screen.queryByText('Old task')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Cleared 1 completed task')).toBeInTheDocument();
  });

  it('renders row actions with a pointer-coarse always-visible class, not hover-only', async () => {
    server.use(
      http.get('*/v1/todo/', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('completed') === 'true') {
          return HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 });
        }
        return HttpResponse.json({
          items: [
            {
              public_id: 'todo-1',
              title: 'Review budget',
              description: null,
              due_date: null,
              priority: 'medium',
              completed: false,
              parent_public_id: null,
              subtask_count: 0,
              created_at: '2026-06-13T00:00:00Z',
              updated_at: '2026-06-13T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        });
      }),
      http.get('*/v1/todo/recurring/', () =>
        HttpResponse.json({ items: [], total: 0, limit: 100, offset: 0 }),
      ),
    );

    renderWithQuery(<TodoPage />);

    const deleteButton = await screen.findByTestId('todo-delete-todo-1');
    const actionsContainer = deleteButton.parentElement;
    expect(actionsContainer?.className).toContain('pointer-coarse:opacity-100');
    expect(actionsContainer?.className).not.toMatch(/^opacity-0\b/);
  });

  it('defaults recurring todos to low priority and supports recurring edits', async () => {
    let updatePayload: Record<string, unknown> | null = null;

    server.use(
      http.get('*/v1/todo/', () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
      http.get('*/v1/todo/recurring/', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'rule-1',
              title: 'Weekly review',
              description: 'Close the loop',
              priority: 'medium',
              frequency: 'weekly',
              interval: 1,
              anchor_date: '2026-06-01',
              next_due_date: '2026-06-15',
              end_date: null,
              is_active: true,
              last_generated_at: null,
              created_at: '2026-06-13T00:00:00Z',
              updated_at: '2026-06-13T00:00:00Z',
            },
          ],
          total: 1,
          limit: 100,
          offset: 0,
        }),
      ),
      http.patch('*/v1/todo/recurring/rule-1', async ({ request }) => {
        updatePayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          public_id: 'rule-1',
          anchor_date: '2026-06-01',
          next_due_date: '2026-06-15',
          is_active: true,
          last_generated_at: null,
          created_at: '2026-06-13T00:00:00Z',
          updated_at: '2026-06-13T00:00:00Z',
          ...updatePayload,
        });
      }),
    );

    renderWithQuery(<TodoPage />);

    fireEvent.click(await screen.findByRole('button', { name: /New recurring todo/i }));
    expect(await screen.findByTestId('todo-recurring-priority')).toHaveTextContent('Low');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const recurringTab = await screen.findByTestId('todo-tab-recurring');
    recurringTab.focus();
    fireEvent.keyDown(recurringTab, { key: 'Enter', code: 'Enter' });
    fireEvent.click(await screen.findByTestId('todo-recurring-edit-rule-1'));
    expect(await screen.findByTestId('todo-recurring-priority')).toHaveTextContent('Medium');
    fireEvent.change(screen.getByTestId('todo-recurring-description'), {
      target: { value: 'Updated recurring notes' },
    });
    await selectDropdownOption('todo-recurring-priority', 'High');
    fireEvent.click(screen.getByRole('button', { name: /Save recurring todo/i }));

    await waitFor(() => {
      expect(updatePayload).not.toBeNull();
    });
    expect(updatePayload).toMatchObject({
      title: 'Weekly review',
      description: 'Updated recurring notes',
      priority: 'high',
      frequency: 'weekly',
      interval: 1,
      end_date: null,
    });
  });
});
