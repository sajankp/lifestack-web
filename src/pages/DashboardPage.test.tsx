import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { DashboardPage } from './DashboardPage';
import { server } from '../test/setup';

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('DashboardPage', () => {
  it('shows computed budget remaining when month budget exists', async () => {
    server.use(
      http.get('*/v1/dashboard/summary', () =>
        HttpResponse.json({
          todos: {
            open_count: 1,
            overdue_count: 0,
            next_due_items: [],
            active_guardrail_todo_count: 0,
          },
          spending: {
            month_spent: '15.50',
            month_budget: '100.00',
            top_overspent_categories: [],
          },
          investing: {
            portfolio_value: '1680.00',
            daily_change: null,
            holdings_count: 1,
          },
          system: { generated_at: '2026-05-24T10:00:00Z' },
        }),
      ),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(await screen.findByText('$84.50')).toBeInTheDocument();
  });

  it('shows N/A budget remaining when month budget is null', async () => {
    server.use(
      http.get('*/v1/dashboard/summary', () =>
        HttpResponse.json({
          todos: {
            open_count: 1,
            overdue_count: 0,
            next_due_items: [],
            active_guardrail_todo_count: 0,
          },
          spending: {
            month_spent: '15.50',
            month_budget: null,
            top_overspent_categories: [],
          },
          investing: {
            portfolio_value: '1680.00',
            daily_change: null,
            holdings_count: 1,
          },
          system: { generated_at: '2026-05-24T10:00:00Z' },
        }),
      ),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    const naValues = await screen.findAllByText('N/A');
    expect(naValues.length).toBeGreaterThan(0);
    expect(screen.getByText('Set a budget to track remaining spend')).toBeInTheDocument();
  });
});
