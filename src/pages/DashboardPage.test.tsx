import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { MemoryRouter } from 'react-router';
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

const allClearBriefing = () =>
  http.get('*/v1/dashboard/briefing', () =>
    HttpResponse.json({
      generated_at: '2026-05-24T10:00:00Z',
      all_clear: true,
      reporting_currency: 'USD',
      lines: [],
    }),
  );

const summaryWithBudgets = (spending: Record<string, unknown>, valuationStatus = 'current') =>
  http.get('*/v1/dashboard/summary', () =>
    HttpResponse.json({
      todos: {
        open_count: 0,
        overdue_count: 0,
        next_due_items: [],
        active_guardrail_todo_count: 0,
      },
      spending: { month_spent: '750.04', top_overspent_categories: [], ...spending },
      investing: {
        portfolio_value: '100.00',
        daily_change: null,
        holdings_count: 1,
        valuation_status: valuationStatus,
      },
      system: { generated_at: '2026-05-24T10:00:00Z' },
    }),
  );

describe('DashboardPage', () => {
  it('shows a category-only budget in the spotlight and what no budget covers (spec-115)', async () => {
    server.use(
      emptyNotifications(),
      allClearBriefing(),
      summaryWithBudgets({
        budgets_tracked: 1,
        uncovered_spend: '692.05',
        budget_spotlight: [
          {
            category_group_id: null,
            category_group_name: null,
            category_id: 'cat-1',
            category_name: 'Entertainment',
            budget_amount: '120.00',
            actual_amount: '57.99',
            utilization_pct: 48.3,
            remaining: '62.01',
            status: 'on_track',
            daily_amount_left: '2.58',
          },
        ],
      }),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Entertainment')).toBeInTheDocument();
    expect(screen.getByText('$57.99 of $120.00')).toBeInTheDocument();
    expect(screen.getByText('1 budget tracked')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-uncovered-spend')).toHaveTextContent(
      '$692.05 not covered by a budget',
    );
    expect(screen.queryByText(/No group budgets set/)).not.toBeInTheDocument();
  });

  it('gives group and category spotlight cards distinct keys and pluralises the count', async () => {
    server.use(
      emptyNotifications(),
      allClearBriefing(),
      summaryWithBudgets({
        budgets_tracked: 3,
        uncovered_spend: '0',
        budget_spotlight: [
          {
            category_group_id: 'group-1',
            category_group_name: 'Household',
            category_id: null,
            category_name: null,
            budget_amount: '100.00',
            actual_amount: '95.00',
            utilization_pct: 95,
            remaining: '5.00',
            status: 'warning',
            daily_amount_left: '1.00',
          },
          {
            category_group_id: null,
            category_group_name: null,
            category_id: 'cat-1',
            category_name: 'Gym',
            budget_amount: '50.00',
            actual_amount: '10.00',
            utilization_pct: 20,
            remaining: '40.00',
            status: 'on_track',
            daily_amount_left: '1.50',
          },
        ],
      }),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Household')).toBeInTheDocument();
    expect(screen.getByText('Gym')).toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-budget-spotlight-card')).toHaveLength(2);
    expect(screen.getByText('3 budgets tracked')).toBeInTheDocument();
    // nothing uncovered -> no "not covered" line
    expect(screen.queryByTestId('dashboard-uncovered-spend')).not.toBeInTheDocument();
  });

  it('keeps showing All clear above a degraded-valuation note: the valuation card is information', async () => {
    server.use(
      emptyNotifications(),
      http.get('*/v1/dashboard/briefing', () =>
        HttpResponse.json({
          generated_at: '2026-05-24T10:00:00Z',
          all_clear: true,
          reporting_currency: 'USD',
          // info-only lines no longer make the briefing "not clear" (spec-115 §2.2)
          lines: [
            {
              severity: 'warning',
              actionable: false,
              text: 'Portfolio +1.00 (+0.10%) today (as of 10:00 UTC) — valuation partial',
              source: { route: '/investing' },
            },
          ],
        }),
      ),
      summaryWithBudgets({ budget_spotlight: [] }, 'estimated'),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByTestId('dashboard-briefing-all-clear')).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard-cue-valuation-alert')).toBeInTheDocument();
  });

  it('shows the budget spotlight when a group budget covers the current month', async () => {
    server.use(
      emptyNotifications(),
      allClearBriefing(),
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
    expect(screen.getByTestId('dashboard-portfolio-value').closest('a')).toHaveAttribute(
      'href',
      '/investing',
    );
    expect(screen.getByTestId('dashboard-data-as-of')).toHaveTextContent('Data as of');
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('shows no budget spotlight when there are no covering group budgets', async () => {
    server.use(
      emptyNotifications(),
      allClearBriefing(),
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
    expect(await screen.findByText('No budgets set')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-uncovered-spend')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-budget-spotlight')).not.toBeInTheDocument();
  });

  const minimalSummary = () =>
    http.get('*/v1/dashboard/summary', () =>
      HttpResponse.json({
        todos: {
          open_count: 0,
          overdue_count: 0,
          next_due_items: [],
          active_guardrail_todo_count: 0,
        },
        spending: { month_spent: '0.00', budget_spotlight: [], top_overspent_categories: [] },
        investing: { portfolio_value: null, daily_change: null, holdings_count: 0 },
        system: { generated_at: '2026-05-24T10:00:00Z' },
      }),
    );

  const summaryWithValuationStatus = (status: string) =>
    http.get('*/v1/dashboard/summary', () =>
      HttpResponse.json({
        todos: {
          open_count: 0,
          overdue_count: 0,
          next_due_items: [],
          active_guardrail_todo_count: 0,
        },
        spending: { month_spent: '0.00', budget_spotlight: [], top_overspent_categories: [] },
        investing: {
          portfolio_value: '100.00',
          daily_change: null,
          holdings_count: 1,
          valuation_status: status,
        },
        system: { generated_at: '2026-05-24T10:00:00Z' },
      }),
    );

  it("does not alarm with a valuation alert when the status is 'empty'", async () => {
    // A pristine workspace has nothing to value — no alert (UX review Part 2 #1).
    server.use(emptyNotifications(), allClearBriefing(), summaryWithValuationStatus('empty'));

    renderWithQuery(<DashboardPage />);

    // Wait for summary data to render (data-as-of derives from the response)
    // before asserting the alert's absence, so the check isn't vacuous.
    expect(await screen.findByTestId('dashboard-data-as-of')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-cue-valuation-alert')).not.toBeInTheDocument();
  });

  it('renders the overspent-budgets cue from the real API shape (numeric category_id)', async () => {
    // The API returns top_overspent_categories as
    // { category_id: <int>, spent, budget, overspend, ratio } (workflows.py).
    // A string-typed category_id in the zod schema made the whole summary fail to
    // parse, so any user with an overspent budget saw "Dashboard data could not be loaded".
    server.use(
      emptyNotifications(),
      allClearBriefing(),
      http.get('*/v1/dashboard/summary', () =>
        HttpResponse.json({
          todos: {
            status: 'available',
            open_count: 0,
            overdue_count: 0,
            next_due_items: [],
            active_guardrail_todo_count: 0,
          },
          spending: {
            status: 'available',
            month_spent: '2168.47',
            budget_spotlight: [],
            top_overspent_categories: [
              {
                category_id: 35,
                spent: '289.26',
                budget: '200.00',
                overspend: '89.26',
                ratio: '1.4463',
              },
            ],
          },
          investing: { portfolio_value: null, daily_change: null, holdings_count: 0 },
          system: { generated_at: '2026-05-24T10:00:00Z' },
        }),
      ),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByTestId('dashboard-cue-overspent-budgets')).toBeInTheDocument();
    // The API gives only an internal integer id (no name), so the cue counts
    // categories rather than printing "Unknown".
    expect(screen.getByTestId('dashboard-cue-overspent-budgets')).toHaveTextContent(
      'exceeded monthly budget limits in 1 category',
    );
    expect(screen.queryByText(/Unknown/)).not.toBeInTheDocument();
  });

  it('shows the valuation alert only for genuinely degraded statuses', async () => {
    server.use(emptyNotifications(), allClearBriefing(), summaryWithValuationStatus('estimated'));

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByTestId('dashboard-cue-valuation-alert')).toBeInTheDocument();
  });

  it('shows an empty state when there are no insights', async () => {
    server.use(emptyNotifications(), allClearBriefing(), minimalSummary());

    renderWithQuery(<DashboardPage />);

    expect(
      await screen.findByText(
        'No insights right now — check back after your next few transactions.',
      ),
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
      allClearBriefing(),
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
      allClearBriefing(),
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
      '/settings/currency',
    );
    expect(screen.getByTestId('dashboard-onboarding-step-account')).toHaveAttribute(
      'href',
      '/settings/accounts',
    );
    expect(screen.getByText('0 of 4 steps done')).toBeInTheDocument();
  });

  it('hides the get-started checklist once currency, an account, and an activity all exist', async () => {
    server.use(
      emptyNotifications(),
      allClearBriefing(),
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

  it('shows the all-clear state when the briefing has no lines', async () => {
    server.use(emptyNotifications(), allClearBriefing(), minimalSummary());

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(
      await screen.findByText('All clear — nothing needs your attention today.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-briefing-line')).not.toBeInTheDocument();
  });

  it('renders ordered briefing lines with working links', async () => {
    server.use(
      emptyNotifications(),
      minimalSummary(),
      http.get('*/v1/dashboard/briefing', () =>
        HttpResponse.json({
          generated_at: '2026-05-24T10:00:00Z',
          all_clear: false,
          reporting_currency: 'USD',
          lines: [
            {
              severity: 'critical',
              text: '2 overdue tasks — top: "Pay rent"',
              source: { entity_type: 'todo', entity_public_id: 'todo-1', route: '/todo' },
            },
            {
              severity: 'info',
              text: 'Portfolio +50.00 (+0.50%) today',
              source: { entity_type: null, entity_public_id: null, route: '/investing' },
            },
          ],
        }),
      ),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('2 overdue tasks — top: "Pay rent"')).toBeInTheDocument();
    expect(screen.getByText('Portfolio +50.00 (+0.50%) today')).toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-briefing-line')).toHaveLength(2);
    expect(screen.getByText('2 overdue tasks — top: "Pay rent"').closest('a')).toHaveAttribute(
      'href',
      '/todo',
    );
    expect(screen.queryByTestId('dashboard-briefing-all-clear')).not.toBeInTheDocument();
  });

  it('hides the briefing card when the briefing fails to load', async () => {
    server.use(
      emptyNotifications(),
      minimalSummary(),
      http.get('*/v1/dashboard/briefing', () => HttpResponse.error()),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-briefing')).not.toBeInTheDocument();
  });

  it('falls back to the all-clear state when all_clear is false but lines is empty', async () => {
    // Defensive fallback: a malformed or stale API response shouldn't ever
    // render an empty card with just the "Today" header.
    server.use(
      emptyNotifications(),
      minimalSummary(),
      http.get('*/v1/dashboard/briefing', () =>
        HttpResponse.json({
          generated_at: '2026-05-24T10:00:00Z',
          all_clear: false,
          reporting_currency: 'USD',
          lines: [],
        }),
      ),
    );

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(
      await screen.findByText('All clear — nothing needs your attention today.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-briefing-line')).not.toBeInTheDocument();
  });

  it('does not orphan the third stat card at tablet-landscape widths (web#204)', async () => {
    server.use(emptyNotifications(), allClearBriefing(), minimalSummary());

    renderWithQuery(<DashboardPage />);

    expect(await screen.findByTestId('dashboard-stat-grid')).toHaveClass(
      'md:grid-cols-2',
      'xl:grid-cols-3',
    );
  });
});
