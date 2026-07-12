import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { KpisTab } from './KpisTab';
import { ToastProvider } from '../../components/ui/toast';
import { server } from '../../test/setup';

// jsdom doesn't implement scrollIntoView; Radix Select (the non-search
// DropdownSelect variant used for the filter-mode picker) calls it when an
// item is highlighted.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || ((): void => {});

const kpiRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  public_id: 'kpi-1',
  name: 'Dining under 100',
  metric_type: 'spend_total',
  evaluation_window: 'calendar_month',
  category_id: null,
  category_group_id: null,
  account_id: null,
  currency_code: 'USD',
  target_value: '100.00',
  target_direction: 'lte',
  display_format: 'amount',
  is_active: true,
  current_value: '60.00',
  is_breached: false,
  window_start: '2026-07-01',
  window_end: '2026-07-31',
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  ...overrides,
});

const renderTab = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <KpisTab
          categoryOptions={[]}
          categoryGroupOptions={[]}
          accountOptions={[]}
          currencyDisplayPreference="code"
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('KpisTab (spec-077)', () => {
  it('renders an empty state when there are no KPIs', async () => {
    server.use(
      http.get('*/v1/spending/kpis', () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
    );
    renderTab();

    expect(await screen.findByText('No custom KPIs yet')).toBeInTheDocument();
  });

  it('renders a KPI card with its current value and no breach badge when under target', async () => {
    server.use(
      http.get('*/v1/spending/kpis', () =>
        HttpResponse.json({ items: [kpiRow()], total: 1, limit: 20, offset: 0 }),
      ),
    );
    renderTab();

    expect(await screen.findByText('Dining under 100')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-breach-badge-kpi-1')).not.toBeInTheDocument();
  });

  it('shows a breach badge when the KPI is over target', async () => {
    server.use(
      http.get('*/v1/spending/kpis', () =>
        HttpResponse.json({
          items: [kpiRow({ current_value: '150.00', is_breached: true })],
          total: 1,
          limit: 20,
          offset: 0,
        }),
      ),
    );
    renderTab();

    expect(await screen.findByTestId('kpi-breach-badge-kpi-1')).toBeInTheDocument();
  });

  it('creates a new KPI via the form', async () => {
    const captured: { body: Record<string, unknown> | null } = { body: null };
    server.use(
      http.get('*/v1/spending/kpis', () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
      http.post('*/v1/spending/kpis', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        captured.body = body;
        return HttpResponse.json(kpiRow({ name: body.name as string }), { status: 201 });
      }),
    );
    renderTab();

    await screen.findByText('No custom KPIs yet');
    fireEvent.click(screen.getByTestId('kpi-add-button'));
    fireEvent.change(screen.getByTestId('kpi-name-input'), {
      target: { value: 'Groceries under 200' },
    });
    fireEvent.click(screen.getByTestId('kpi-save-button'));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body?.name).toBe('Groceries under 200');
    expect(captured.body?.metric_type).toBe('spend_total');
    expect(captured.body?.evaluation_window).toBe('calendar_month');
  });

  it('deletes a KPI after confirming', async () => {
    let deleteCalled = false;
    server.use(
      http.get('*/v1/spending/kpis', () =>
        HttpResponse.json({ items: [kpiRow()], total: 1, limit: 20, offset: 0 }),
      ),
      http.delete('*/v1/spending/kpis/kpi-1', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderTab();

    await screen.findByText('Dining under 100');
    fireEvent.click(screen.getByTitle('Delete KPI'));
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(deleteCalled).toBe(true));
  });

  it('rejects a negative target value without submitting', async () => {
    let createCalled = false;
    server.use(
      http.get('*/v1/spending/kpis', () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
      http.post('*/v1/spending/kpis', () => {
        createCalled = true;
        return HttpResponse.json(kpiRow(), { status: 201 });
      }),
    );
    renderTab();

    await screen.findByText('No custom KPIs yet');
    fireEvent.click(screen.getByTestId('kpi-add-button'));
    fireEvent.change(screen.getByTestId('kpi-name-input'), { target: { value: 'Bad target' } });
    fireEvent.click(screen.getByLabelText('Set a target and get notified on breach'));
    fireEvent.change(screen.getByTestId('kpi-target-value'), { target: { value: '-5' } });
    fireEvent.click(screen.getByTestId('kpi-save-button'));

    expect(await screen.findByText('Target value must be a valid non-negative number')).toBeInTheDocument();
    expect(createCalled).toBe(false);
  });

  it('requires a filter value once a filter mode is selected', async () => {
    let createCalled = false;
    server.use(
      http.get('*/v1/spending/kpis', () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
      http.post('*/v1/spending/kpis', () => {
        createCalled = true;
        return HttpResponse.json(kpiRow(), { status: 201 });
      }),
    );
    renderTab();

    await screen.findByText('No custom KPIs yet');
    fireEvent.click(screen.getByTestId('kpi-add-button'));
    fireEvent.change(screen.getByTestId('kpi-name-input'), { target: { value: 'Needs a filter' } });
    fireEvent.click(screen.getByTestId('kpi-filter-mode'));
    fireEvent.click(await screen.findByRole('option', { name: 'One category' }));
    fireEvent.click(screen.getByTestId('kpi-save-button'));

    expect(await screen.findByText('Select a value for the chosen filter')).toBeInTheDocument();
    expect(createCalled).toBe(false);
  });
});
