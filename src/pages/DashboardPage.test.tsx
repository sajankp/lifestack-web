import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { DashboardPage } from './DashboardPage';
import { server } from '../test/setup';

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const emptyNotifications = () =>
  http.get('*/v1/notifications', () =>
    HttpResponse.json({ items: [], total: 0, limit: 5, offset: 0 }),
  );

describe('DashboardPage', () => {
  it('shows the budget spotlight when a group budget covers the current month', async () => {
    server.use(
      emptyNotifications(),
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
            budget_spotlight: [
              {
                category_group_id: 'group-1',
                category_group_name: 'Household',
                budget_amount: '100.00',
                actual_amount: '84.50',
                utilization_pct: 84.5,
                remaining: '15.50',
                status: 'warning',
                daily_amount_left: '2.21',
              },
            ],
            top_overspent_categories: [],
          },
          investing: {
            portfolio_value: '1680.00',
            invested_value: '1500.00',
            total_gain_loss: '180.00',
            total_gain_loss_pct: '12.00',
            daily_change: '-20.00',
            daily_change_pct: '-1.18',
            snapshot_date: '2026-05-24',
            previous_snapshot_date: '2026-05-23',
            valuation_status: 'current',
            holdings_count: 1,
            cash_total: '250.00',
          },
          system: { generated_at: '2026-05-24T10:00:00Z' },
        }),
      ),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(await screen.findByText('Household')).toBeInTheDocument();
    expect(screen.getByText('$84.50 of $100.00')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-portfolio-value')).toHaveTextContent('$1,680.00');
    expect(screen.getByText('Invested $1,500.00 · Gain +$180.00 (+12.00%)')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-portfolio-value').closest('a')).toHaveAttribute('href', '/investing');
    expect(screen.getByTestId('dashboard-data-as-of')).toHaveTextContent('Data as of');
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('shows no budget spotlight when there are no covering group budgets', async () => {
    server.use(
      emptyNotifications(),
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
            budget_spotlight: [],
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
    expect(await screen.findByText('No group budgets set')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-budget-spotlight')).not.toBeInTheDocument();
  });

  const minimalSummary = () =>
    http.get('*/v1/dashboard/summary', () =>
      HttpResponse.json({
        todos: { open_count: 0, overdue_count: 0, next_due_items: [], active_guardrail_todo_count: 0 },
        spending: { month_spent: '0.00', budget_spotlight: [], top_overspent_categories: [] },
        investing: { portfolio_value: null, daily_change: null, holdings_count: 0 },
        system: { generated_at: '2026-05-24T10:00:00Z' },
      }),
    );

  it('shows an empty state when there are no insights', async () => {
    server.use(emptyNotifications(), minimalSummary());

    renderWithQuery(<DashboardPage />);

    expect(
      await screen.findByText('No insights right now — check back after your next few transactions.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-insight-card')).not.toBeInTheDocument();
  });

  it('renders insight cards returned by the notifications API', async () => {
    server.use(
      http.get('*/v1/notifications', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'a1',
              category: 'insight',
              severity: 'warning',
              title: 'Dining spending is up this week',
              body: 'Dining spending this week is 3000.00, vs a trailing 4-week average of 1000.00.',
              module: 'spending',
              entity_type: 'spending_category_anomaly',
              entity_public_id: 'cat-1',
              is_read: false,
              read_at: null,
              created_at: '2026-05-24T10:00:00Z',
            },
            {
              public_id: 'a2',
              category: 'insight',
              severity: 'info',
              title: 'Recurring charge detected: Gym',
              body: 'Gym has a repeating charge of about 29.99 across 2 months.',
              module: 'spending',
              entity_type: 'spending_category_recurring',
              entity_public_id: 'cat-2',
              is_read: false,
              read_at: null,
              created_at: '2026-05-24T10:00:00Z',
            },
          ],
          total: 2,
          limit: 5,
          offset: 0,
        }),
      ),
      minimalSummary(),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Dining spending is up this week')).toBeInTheDocument();
    expect(screen.getByText('Recurring charge detected: Gym')).toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-insight-card')).toHaveLength(2);
  });

  const emptyPaginated = (total = 0) => ({ items: [], total, limit: 1, offset: 0 });

  it('shows the get-started checklist with incomplete steps for a brand-new workspace', async () => {
    server.use(
      emptyNotifications(),
      minimalSummary(),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: null,
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: null,
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/finance/accounts', () => HttpResponse.json(emptyPaginated())),
      http.get('*/v1/todo/', () => HttpResponse.json(emptyPaginated())),
      http.get('*/v1/spending/transactions', () => HttpResponse.json(emptyPaginated())),
      http.get('*/v1/notifications/push-subscriptions', () => HttpResponse.json([])),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Get started')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-onboarding-step-currency')).toHaveAttribute(
      'href',
      '/settings?tab=currency',
    );
    expect(screen.getByTestId('dashboard-onboarding-step-account')).toHaveAttribute(
      'href',
      '/settings?tab=accounts',
    );
    expect(screen.getByText('0 of 4 steps done')).toBeInTheDocument();
  });

  it('hides the get-started checklist once currency, an account, and an activity all exist', async () => {
    server.use(
      emptyNotifications(),
      minimalSummary(),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/finance/accounts', () => HttpResponse.json(emptyPaginated(1))),
      http.get('*/v1/todo/', () => HttpResponse.json(emptyPaginated(1))),
      http.get('*/v1/spending/transactions', () => HttpResponse.json(emptyPaginated())),
      http.get('*/v1/notifications/push-subscriptions', () => HttpResponse.json([])),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Get started')).not.toBeInTheDocument();
  });
});
