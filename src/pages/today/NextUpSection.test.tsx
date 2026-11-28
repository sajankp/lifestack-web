import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { ToastProvider } from '../../components/ui/toast';
import { NextUpSection } from './NextUpSection';
import type { DashboardTodoItem } from '../../types/dashboard';

// spec-113 §3.4: up to 3 tasks / doses, soonest first, each with an inline tick-off that reuses the
// existing todo and health mutations.

const todo = (id: string, title: string, due: string): DashboardTodoItem => ({
  public_id: id,
  title,
  due_date: due,
  priority: 'medium',
});

const dose = (
  med: string,
  name: string,
  at: string,
  status = 'pending',
  doseText: string | null = null,
) => ({
  medication_public_id: med,
  medication_name: name,
  dose_text: doseText,
  scheduled_for: at,
  status,
  event_public_id: null,
  note: null,
  taken_at: null,
});

const schedule = (slots: unknown[]) =>
  server.use(http.get('*/v1/health/medications/schedule', () => HttpResponse.json(slots)));

const renderSection = (todos: DashboardTodoItem[]) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <NextUpSection todos={todos} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const titles = () => screen.getAllByTestId('today-next-up-item').map((el) => el.textContent ?? '');

describe('NextUpSection', () => {
  it('lists at most three, soonest first, tasks and doses together', async () => {
    schedule([
      dose('med-1', 'Metformin', '2099-01-01T08:00:00Z', 'pending', '500 mg'),
      dose('med-2', 'Vitamin D', '2099-01-01T21:00:00Z'),
    ]);
    renderSection([
      todo('t-1', 'Call the bank', '2099-01-01T10:00:00Z'),
      todo('t-2', 'File receipts', '2099-01-01T12:00:00Z'),
    ]);

    await screen.findByText('Metformin');
    const rows = titles();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Metformin');
    expect(rows[0]).toContain('500 mg');
    expect(rows[1]).toContain('Call the bank');
    expect(rows[2]).toContain('File receipts');
    expect(screen.queryByText('Vitamin D')).not.toBeInTheDocument();
  });

  it('labels what each row is', async () => {
    schedule([dose('med-1', 'Metformin', '2099-01-01T08:00:00Z')]);
    renderSection([todo('t-1', 'Call the bank', '2099-01-01T10:00:00Z')]);

    await screen.findByText('Metformin');
    const [first, second] = screen.getAllByTestId('today-next-up-item');
    expect(within(first).getByText('Dose')).toBeInTheDocument();
    expect(within(second).getByText('Task')).toBeInTheDocument();
  });

  it('shows only doses still to take', async () => {
    schedule([
      dose('med-1', 'Taken one', '2099-01-01T08:00:00Z', 'taken'),
      dose('med-2', 'Skipped one', '2099-01-01T09:00:00Z', 'skipped'),
      dose('med-3', 'Missed one', '2099-01-01T10:00:00Z', 'missed'),
      dose('med-4', 'Pending one', '2099-01-01T11:00:00Z', 'pending'),
    ]);
    renderSection([]);

    expect(await screen.findByText('Pending one')).toBeInTheDocument();
    expect(titles()).toHaveLength(1);
  });

  it('says so when nothing is coming up', async () => {
    schedule([]);
    renderSection([]);

    expect(await screen.findByTestId('today-next-up-empty')).toHaveTextContent('Nothing coming up');
  });

  it('ticks a task off through the todo mutation and brings the next one up', async () => {
    schedule([]);
    let body: unknown = null;
    server.use(
      http.patch('*/v1/todo/:id', async ({ request, params }) => {
        body = { id: params.id, ...((await request.json()) as object) };
        return HttpResponse.json({ public_id: params.id, title: 'x', completed: true });
      }),
    );
    renderSection([
      todo('t-1', 'First', '2099-01-01T01:00:00Z'),
      todo('t-2', 'Second', '2099-01-01T02:00:00Z'),
      todo('t-3', 'Third', '2099-01-01T03:00:00Z'),
      todo('t-4', 'Fourth', '2099-01-01T04:00:00Z'),
    ]);
    await screen.findByText('First');
    expect(screen.queryByText('Fourth')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark done: First' }));

    await waitFor(() => expect(screen.queryByText('First')).not.toBeInTheDocument());
    expect(body).toEqual({ id: 't-1', completed: true });
    expect(screen.getByText('Fourth')).toBeInTheDocument();
    expect(titles()).toHaveLength(3);
  });

  it('ticks a dose off through the health mutation', async () => {
    schedule([dose('med-1', 'Metformin', '2099-01-01T08:00:00Z')]);
    let call: { id: unknown; body: unknown } | null = null;
    server.use(
      http.put('*/v1/health/medications/:id/events', async ({ request, params }) => {
        call = { id: params.id, body: await request.json() };
        return HttpResponse.json({
          public_id: 'ev-1',
          medication_public_id: params.id,
          scheduled_for: '2099-01-01T08:00:00Z',
          status: 'taken',
        });
      }),
    );
    renderSection([]);
    await screen.findByText('Metformin');

    await userEvent.click(screen.getByRole('button', { name: 'Mark done: Metformin' }));

    await waitFor(() => expect(screen.queryByText('Metformin')).not.toBeInTheDocument());
    expect(call).toEqual({
      id: 'med-1',
      body: { scheduled_for: '2099-01-01T08:00:00Z', status: 'taken' },
    });
    expect(screen.getByTestId('today-next-up-empty')).toBeInTheDocument();
  });

  it('keeps the row when the tick-off fails', async () => {
    schedule([]);
    server.use(http.patch('*/v1/todo/:id', () => HttpResponse.json({}, { status: 500 })));
    renderSection([todo('t-1', 'Stubborn', '2099-01-01T01:00:00Z')]);
    await screen.findByText('Stubborn');

    await userEvent.click(screen.getByRole('button', { name: 'Mark done: Stubborn' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mark done: Stubborn' })).toBeEnabled(),
    );
    expect(screen.getByText('Stubborn')).toBeInTheDocument();
  });

  it('still shows the tasks when the dose schedule cannot be loaded', async () => {
    server.use(
      http.get('*/v1/health/medications/schedule', () => HttpResponse.json({}, { status: 500 })),
    );
    renderSection([todo('t-1', 'Call the bank', '2099-01-01T10:00:00Z')]);

    expect(await screen.findByText('Call the bank')).toBeInTheDocument();
    expect(screen.queryByTestId('today-next-up-empty')).not.toBeInTheDocument();
  });

  it('links a task to the todo list and a dose to Health', async () => {
    schedule([dose('med-1', 'Metformin', '2099-01-01T08:00:00Z')]);
    renderSection([todo('t-1', 'Call the bank', '2099-01-01T10:00:00Z')]);
    await screen.findByText('Metformin');

    expect(screen.getByRole('link', { name: /Metformin/ })).toHaveAttribute('href', '/health');
    expect(screen.getByRole('link', { name: /Call the bank/ })).toHaveAttribute('href', '/todo');
  });
});
