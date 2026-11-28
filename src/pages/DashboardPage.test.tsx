import React from 'react';
import { afterEach, describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';

import { DashboardPage } from './DashboardPage';
import { server } from '../test/setup';

// spec-113 §3: "Today". The sections have their own tests (src/pages/today/*.test.tsx); these cover
// how the page puts them together, what it no longer shows, and what it is allowed to call.

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

const page = (total = 0) => ({ items: [], total, limit: 1, offset: 0 });

const settings = (over: Record<string, unknown> = {}) =>
  http.get('*/v1/finance/settings/user', () =>
    HttpResponse.json({
      reporting_currency_override_code: null,
      currency_display_preference_override: null,
      workspace_reporting_currency_code: 'USD',
      workspace_currency_display_preference: 'symbol',
      effective_reporting_currency_code: 'USD',
      effective_currency_display_preference: 'symbol',
      effective_locale: 'en-US',
      effective_decimal_places: 2,
      updated_at: '2026-05-24T00:00:00Z',
      ...over,
    }),
  );

const periodChange = () =>
  http.get('*/v1/finance/period-change', () =>
    HttpResponse.json({
      status: 'complete',
      start_date: '2026-05-17',
      end_date: '2026-05-24',
      currency: 'USD',
      net_worth: {
        start: '10000.00',
        end: '10500.00',
        change: '500.00',
        saved: '400.00',
        markets_and_other: '100.00',
      },
      investments: {
        start: '4000.00',
        end: '4300.00',
        change: '300.00',
        new_money: '200.00',
        growth: '100.00',
      },
    }),
  );

const briefing = (lines: unknown[] = []) =>
  http.get('*/v1/dashboard/briefing', () =>
    HttpResponse.json({
      generated_at: '2026-05-24T10:00:00Z',
      all_clear: lines.length === 0,
      reporting_currency: 'USD',
      lines,
    }),
  );

const monthBudget = (over: Record<string, unknown> = {}) => ({
  month: '2026-05',
  as_of: '2026-05-24',
  lines: [
    {
      kind: 'category',
      category_id: 'c1',
      category_name: 'Entertainment',
      limit: '120.00',
      spent: '108.00',
      remaining: '12.00',
      used_pct: 90,
      status: 'warning',
    },
  ],
  covered_spend: '108.00',
  covered_limit: '120.00',
  uncovered_spend: '692.05',
  used_pct: 90,
  breached_count: 0,
  total_spend: '800.05',
  ...over,
});

const summary = (over: Record<string, unknown> = {}) =>
  http.get('*/v1/dashboard/summary', () =>
    HttpResponse.json({
      todos: {
        open_count: 0,
        overdue_count: 0,
        next_due_items: [],
        active_guardrail_todo_count: 0,
      },
      spending: { month_spent: '800.05', top_overspent_categories: [] },
      investing: {
        portfolio_value: '4300.00',
        daily_change: null,
        holdings_count: 1,
        valuation_status: 'current',
        snapshot_date: '2026-05-23',
      },
      system: { generated_at: '2026-05-24T10:00:00Z' },
      month_budget: monthBudget(),
      ...over,
    }),
  );

const insight = (id: string, title: string) => ({
  public_id: id,
  category: 'insight',
  severity: 'info',
  title,
  body: 'Some detail.',
  module: 'spending',
  entity_type: 'x',
  entity_public_id: id,
  is_read: false,
  read_at: null,
  created_at: '2026-05-24T10:00:00Z',
});

const notifications = (items: unknown[] = []) =>
  http.get('*/v1/notifications', () =>
    HttpResponse.json({ items, total: items.length, limit: 5, offset: 0 }),
  );

/** Everything the page asks for, answered with an established, quiet workspace. */
const base = () => [
  settings(),
  summary(),
  briefing(),
  notifications(),
  periodChange(),
  http.get('*/v1/health/medications/schedule', () => HttpResponse.json([])),
  http.get('*/v1/finance/accounts', () => HttpResponse.json(page(1))),
  http.get('*/v1/todo/', () => HttpResponse.json(page(1))),
  http.get('*/v1/spending/transactions', () => HttpResponse.json(page(1))),
  http.get('*/v1/notifications/push-subscriptions', () => HttpResponse.json([{}])),
];

/** The overrides win over the base handlers (msw uses the first matching handler). */
const use = (...overrides: Parameters<typeof server.use>) => server.use(...overrides, ...base());

describe('DashboardPage (Today)', () => {
  it('is titled Today, with none of the old dashboard chrome', async () => {
    use();
    renderWithQuery(<DashboardPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    await screen.findByTestId('today-net-worth-value');
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText(/Workspace snapshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Live totals/i)).not.toBeInTheDocument();
  });

  it('shows net worth, needs you, this month and next up, in that order', async () => {
    use();
    renderWithQuery(<DashboardPage />);

    const ids = ['today-net-worth', 'today-needs-you', 'today-this-month', 'today-next-up'];
    const nodes = await Promise.all(ids.map((id) => screen.findByTestId(id)));
    const inDocumentOrder = Array.from(document.querySelectorAll('[data-testid]'));
    const positions = nodes.map((node) => inDocumentOrder.indexOf(node));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
    expect(new Set(positions).size).toBe(ids.length);
  });

  it('puts this month and next up side by side from tablet width, stacked on a phone', async () => {
    use();
    renderWithQuery(<DashboardPage />);

    const month = await screen.findByTestId('today-this-month');
    const grid = month.parentElement as HTMLElement;
    expect(grid).toContainElement(screen.getByTestId('today-next-up'));
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2');
  });

  it('takes the month from the dashboard summary: spent, left, not covered', async () => {
    use();
    renderWithQuery(<DashboardPage />);

    expect(await screen.findByTestId('today-month-spent')).toHaveTextContent('$800.05');
    expect(screen.getByTestId('today-month-left')).toHaveTextContent('$12.00');
    expect(screen.getByTestId('dashboard-uncovered-spend')).toHaveTextContent(
      '$692.05 not covered by a budget',
    );
  });

  it('says spending is unavailable when the summary carries no month budget', async () => {
    use(summary({ month_budget: null }));
    renderWithQuery(<DashboardPage />);

    expect(await screen.findByTestId('today-month-unavailable')).toBeInTheDocument();
  });

  it('shows the owner the next tasks due', async () => {
    use(
      summary({
        todos: {
          open_count: 1,
          overdue_count: 0,
          next_due_items: [
            { public_id: 't-1', title: 'Renew passport', due_date: '2099-01-01T10:00:00Z' },
          ],
          active_guardrail_todo_count: 0,
        },
      }),
    );
    renderWithQuery(<DashboardPage />);

    expect(await screen.findByText('Renew passport')).toBeInTheDocument();
  });

  it('still loads when a category budget is overspent (numeric category_id, as the API sends)', async () => {
    // top_overspent_categories rows carry an integer category_id. A string-typed id in the zod
    // schema once made the whole summary fail to parse for anyone with an overspent budget.
    use(
      summary({
        spending: {
          status: 'available',
          month_spent: '2168.47',
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
      }),
    );
    renderWithQuery(<DashboardPage />);

    expect(await screen.findByTestId('today-net-worth')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard data could not be loaded.')).not.toBeInTheDocument();
  });

  describe('needs you / all clear', () => {
    it('shows All clear and no list when nothing is actionable', async () => {
      use();
      renderWithQuery(<DashboardPage />);

      expect(await screen.findByTestId('today-all-clear')).toBeInTheDocument();
      expect(screen.queryByTestId('today-needs-you-line')).not.toBeInTheDocument();
    });

    it('shows the actionable lines and never All clear alongside them', async () => {
      use(
        briefing([
          {
            severity: 'critical',
            text: '2 overdue tasks — top: "Pay rent"',
            actionable: true,
            source: { route: '/todo', entity_type: 'todo', entity_public_id: 't1' },
          },
        ]),
      );
      renderWithQuery(<DashboardPage />);

      const line = await screen.findByTestId('today-needs-you-line');
      expect(line).toHaveTextContent('Pay rent');
      expect(line).toHaveAttribute('href', '/todo');
      expect(screen.queryByTestId('today-all-clear')).not.toBeInTheDocument();
    });

    it('does not claim All clear when the briefing cannot be loaded', async () => {
      use(http.get('*/v1/dashboard/briefing', () => HttpResponse.json({}, { status: 500 })));
      renderWithQuery(<DashboardPage />);

      expect(await screen.findByTestId('today-needs-you-error')).toBeInTheDocument();
      expect(screen.queryByTestId('today-all-clear')).not.toBeInTheDocument();
      // ...and the rest of the page is still there.
      expect(screen.getByTestId('today-this-month')).toBeInTheDocument();
    });

    it('keeps information-only lines out of Needs you, under Good to know', async () => {
      use(
        briefing([
          {
            severity: 'warning',
            text: 'Portfolio +1.00 (+0.10%) today — valuation partial',
            actionable: false,
            source: { route: '/investing', entity_type: null, entity_public_id: null },
          },
        ]),
      );
      renderWithQuery(<DashboardPage />);

      expect(await screen.findByTestId('today-all-clear')).toBeInTheDocument();
      expect(screen.queryByText(/valuation partial/)).not.toBeInTheDocument();
      await userEvent.click(await screen.findByTestId('today-good-to-know-toggle'));
      expect(screen.getByText(/valuation partial/)).toBeInTheDocument();
    });
  });

  describe('good to know', () => {
    it('holds the unread insights, collapsed until opened', async () => {
      use(
        notifications([
          insight('a1', 'Dining spending is up this week'),
          insight('a2', 'Recurring charge detected: Gym'),
        ]),
      );
      renderWithQuery(<DashboardPage />);

      const toggle = await screen.findByTestId('today-good-to-know-toggle');
      expect(screen.queryByTestId('dashboard-insight-card')).not.toBeInTheDocument();
      await userEvent.click(toggle);
      const section = screen.getByTestId('today-good-to-know');
      expect(within(section).getByText('Dining spending is up this week')).toBeInTheDocument();
      expect(within(section).getAllByTestId('dashboard-insight-card')).toHaveLength(2);
    });

    it('is absent when there is nothing to know', async () => {
      use();
      renderWithQuery(<DashboardPage />);

      await screen.findByTestId('today-all-clear');
      expect(screen.queryByTestId('today-good-to-know')).not.toBeInTheDocument();
      expect(screen.queryByText(/No insights right now/)).not.toBeInTheDocument();
    });
  });

  describe('what was removed', () => {
    it('has no KPI grid, stat cards, budget spotlight or cue cards, even when they would apply', async () => {
      use(
        summary({
          todos: {
            open_count: 3,
            overdue_count: 2,
            next_due_items: [],
            active_guardrail_todo_count: 1,
          },
          spending: {
            month_spent: '800.05',
            top_overspent_categories: [{ category_id: 1, spent: '9', budget: '5' }],
          },
          investing: {
            portfolio_value: '100.00',
            holdings_count: 1,
            valuation_status: 'estimated',
            snapshot_date: '2026-05-23',
          },
        }),
      );
      renderWithQuery(<DashboardPage />);
      await screen.findByTestId('today-net-worth-value');

      for (const id of [
        'dashboard-stat-grid',
        'dashboard-budget-spotlight',
        'dashboard-budget-spotlight-card',
        'dashboard-cue-overdue-todos',
        'dashboard-cue-budget-guardrails',
        'dashboard-cue-overspent-budgets',
        'dashboard-cue-valuation-alert',
        'dashboard-briefing',
        'dashboard-insights',
      ]) {
        expect(screen.queryByTestId(id), id).not.toBeInTheDocument();
      }
      expect(screen.queryByText('Open todos')).not.toBeInTheDocument();
      expect(screen.queryByText('This month spent')).not.toBeInTheDocument();
      expect(screen.queryByText('Budget spotlight')).not.toBeInTheDocument();
    });

    it('does not show the monthly spend twice', async () => {
      use();
      renderWithQuery(<DashboardPage />);
      await screen.findByTestId('today-month-spent');

      expect(screen.getAllByText('$800.05')).toHaveLength(1);
    });
  });

  describe('valuation wording', () => {
    it('says some prices are estimates under Investments, instead of a separate alert', async () => {
      use(
        summary({
          investing: {
            portfolio_value: '4300.00',
            holdings_count: 1,
            valuation_status: 'estimated',
            snapshot_date: '2026-05-23',
          },
        }),
      );
      renderWithQuery(<DashboardPage />);

      expect(await screen.findByTestId('today-valuation-note')).toHaveTextContent(
        'Some prices are estimates (updated 23-May-2026).',
      );
    });

    it.each([
      ['cost_basis_fallback', /shown at cost/i],
      ['multi_currency_unconverted', /other currencies/i],
      ['conversion_required', /other currencies/i],
    ])('never shows the raw status "%s" to the user', async (status, wording) => {
      use(
        summary({
          investing: {
            portfolio_value: '4300.00',
            holdings_count: 1,
            valuation_status: status,
            snapshot_date: '2026-05-23',
          },
        }),
      );
      renderWithQuery(<DashboardPage />);

      const note = await screen.findByTestId('today-valuation-note');
      expect(note).toHaveTextContent(wording);
      expect(note.textContent).not.toContain(status);
    });

    it("says nothing for an 'empty' valuation: a new workspace has nothing to value yet", async () => {
      use(
        summary({
          investing: { portfolio_value: null, holdings_count: 0, valuation_status: 'empty' },
        }),
      );
      renderWithQuery(<DashboardPage />);

      await screen.findByTestId('today-net-worth-value');
      expect(screen.queryByTestId('today-valuation-note')).not.toBeInTheDocument();
    });
  });

  describe('cost', () => {
    const requested: string[] = [];
    const record = ({ request }: { request: Request }) => {
      requested.push(new URL(request.url).pathname);
    };
    afterEach(() => server.events.removeListener('request:start', record));

    it('asks for nothing from Investing analytics, and each light read only once', async () => {
      requested.length = 0;
      server.events.on('request:start', record);
      use();
      renderWithQuery(<DashboardPage />);
      await screen.findByTestId('today-all-clear');
      await screen.findByTestId('today-net-worth-value');

      expect(requested.filter((path) => path.includes('/investing'))).toEqual([]);
      expect(requested.filter((p) => p.endsWith('/finance/period-change'))).toHaveLength(1);
      expect(requested.filter((p) => p.endsWith('/dashboard/summary'))).toHaveLength(1);
      expect(requested.filter((p) => p.endsWith('/dashboard/briefing'))).toHaveLength(1);
    });
  });

  describe('states', () => {
    it('says so when the dashboard data cannot be loaded', async () => {
      use(http.get('*/v1/dashboard/summary', () => HttpResponse.json({}, { status: 500 })));
      renderWithQuery(<DashboardPage />);

      expect(await screen.findByText('Dashboard data could not be loaded.')).toBeInTheDocument();
      expect(screen.queryByTestId('today-net-worth')).not.toBeInTheDocument();
    });

    it('shows the data-as-of time', async () => {
      use();
      renderWithQuery(<DashboardPage />);

      expect(await screen.findByTestId('dashboard-data-as-of')).toHaveTextContent(/Data as of/);
    });
  });

  describe('get-started checklist', () => {
    it('shows incomplete steps for a brand-new workspace', async () => {
      use(
        settings({
          workspace_reporting_currency_code: null,
          effective_reporting_currency_code: null,
        }),
        http.get('*/v1/finance/accounts', () => HttpResponse.json(page())),
        http.get('*/v1/todo/', () => HttpResponse.json(page())),
        http.get('*/v1/spending/transactions', () => HttpResponse.json(page())),
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

    it('is hidden once currency, an account and an activity all exist', async () => {
      use();
      renderWithQuery(<DashboardPage />);

      await screen.findByTestId('today-net-worth-value');
      expect(screen.queryByText('Get started')).not.toBeInTheDocument();
    });
  });
});
