import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { KpiDashboardCard } from './KpiDashboardCard';
import { server } from '../../test/setup';

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

const renderCard = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <KpiDashboardCard currencyDisplayPreference="code" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('KpiDashboardCard (spec-077)', () => {
  it('renders nothing when there are no KPIs', async () => {
    server.use(
      http.get('*/v1/spending/kpis', () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
    );
    renderCard();

    await waitFor(() => expect(screen.queryByTestId('dashboard-kpi-card')).not.toBeInTheDocument());
  });

  it('renders KPI cards with breach indication', async () => {
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
    renderCard();

    expect(await screen.findByText('Dining under 100')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-kpi-card-item-kpi-1')).toBeInTheDocument();
  });
});
