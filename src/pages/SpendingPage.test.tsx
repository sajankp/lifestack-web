import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { MemoryRouter, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';

import { SpendingPage } from './SpendingPage';
import { server } from '../test/setup';

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="route-location">{`${location.pathname}${location.search}`}</output>;
};

const renderWithQuery = (ui: React.ReactNode, initialEntry = '/spending') => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const CATEGORY = {
  public_id: 'cat-food-id',
  name: 'Food',
  is_system: false,
  color: '#22c55e',
  icon: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const ACCOUNT = {
  public_id: 'acc-wallet-id',
  name: 'My Wallet',
  account_type: 'wallet' as const,
  default_currency_code: 'USD',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const USER_SETTINGS = {
  reporting_currency_override_code: null,
  currency_display_preference_override: null,
  workspace_reporting_currency_code: 'USD',
  workspace_currency_display_preference: 'symbol',
  effective_reporting_currency_code: 'USD',
  effective_currency_display_preference: 'symbol',
  effective_locale: 'en-US',
  effective_decimal_places: 2,
  updated_at: '2026-01-01T00:00:00Z',
};

const WORKSPACE_SETTINGS = {
  reporting_currency_code: 'USD',
  currency_display_preference: 'symbol',
  lookthrough_min_weight_pct: '0.5',
  default_spending_account_id: null,
  updated_at: '2026-01-01T00:00:00Z',
};

const EMPTY_PAGE = { items: [], total: 0, limit: 50, offset: 0 };
const EMPTY_SUMMARY = { income_total: 0, expense_total: 0, net_total: 0, category_totals: [] };

const baseHandlers = [
  http.get('*/v1/spending/categories', () =>
    HttpResponse.json({ items: [CATEGORY], total: 1, limit: 200, offset: 0 }),
  ),
  http.get('*/v1/spending/tags', () => HttpResponse.json(EMPTY_PAGE)),
  http.get('*/v1/spending/category-groups', () => HttpResponse.json(EMPTY_PAGE)),
  http.get('*/v1/spending/analytics/tag-breakdown', () =>
    HttpResponse.json({ from: '2026-01-01', to: '2026-01-31', type: 'expense', total: 0, tags: [] }),
  ),
  http.get('*/v1/finance/accounts', () =>
    HttpResponse.json({ items: [ACCOUNT], total: 1, limit: 200, offset: 0 }),
  ),
  http.get('*/v1/spending/transactions/summary', () => HttpResponse.json(EMPTY_SUMMARY)),
  http.get('*/v1/spending/budgets', () => HttpResponse.json(EMPTY_PAGE)),
  http.get('*/v1/spending/recurring', () => HttpResponse.json(EMPTY_PAGE)),
  http.get('*/v1/finance/settings/user', () => HttpResponse.json(USER_SETTINGS)),
  http.get('*/v1/finance/settings', () => HttpResponse.json(WORKSPACE_SETTINGS)),
  http.get('*/v1/spending/kpis', () => HttpResponse.json(EMPTY_PAGE)),
  http.get('*/v1/spending/analytics/pacing', () =>
    HttpResponse.json({
      month: '2026-10',
      total_budget: '0.00',
      total_spent: '0.00',
      remaining: '0.00',
      daily_burn_rate: '0.00',
      projected_total: '0.00',
      fixed_burn_spent: '0.00',
      discretionary_spent: '0.00',
      days_remaining: 20,
      days_elapsed: 10,
      total_days: 30,
      daily_spend: [],
      category_pacing: [],
    }),
  ),
  http.get('*/v1/spending/analytics/breakdown', () =>
    HttpResponse.json({ from: '2026-10-01', to: '2026-10-31', type: 'expense', total: '0.00', categories: [] }),
  ),
  http.get('*/v1/spending/analytics/trends', () =>
    HttpResponse.json({ from: '2026-04-01', to: '2026-10-01', points: [] }),
  ),
  http.get('*/v1/spending/analytics/savings-rate', () =>
    HttpResponse.json({ from: '2026-04-01', to: '2026-10-01', points: [] }),
  ),
];

describe('SpendingPage', () => {
  beforeEach(() => {
    server.use(...baseHandlers);
  });

  it('redirects root /spending to canonical /spending/recurring route', async () => {
    renderWithQuery(
      <>
        <LocationProbe />
        <SpendingPage />
      </>,
      '/spending',
    );

    await waitFor(() => {
      expect(screen.getByTestId('route-location')).toHaveTextContent('/spending/recurring');
    });
  });

  it('redirects legacy /spending/transactions to /money', async () => {
    renderWithQuery(
      <>
        <LocationProbe />
        <SpendingPage />
      </>,
      '/spending/transactions',
    );

    await waitFor(() => {
      expect(screen.getByTestId('route-location')).toHaveTextContent('/money');
    });
  });

  it('renders page hero and summary KPI cards', async () => {
    server.use(
      http.get('*/v1/spending/transactions/summary', () =>
        HttpResponse.json({
          income_total: 5000,
          expense_total: 1250,
          net_total: 3750,
          category_totals: [{ category_id: CATEGORY.public_id, total_amount: 1250 }],
        }),
      ),
      http.get('*/v1/spending/recurring', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'rec-1',
              category_id: CATEGORY.public_id,
              account_id: ACCOUNT.public_id,
              amount: '50.00',
              type: 'expense',
              description: 'Streaming Sub',
              frequency: 'monthly',
              interval: 1,
              anchor_date: '2026-01-01',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
    );

    renderWithQuery(<SpendingPage />, '/spending/recurring');

    expect(await screen.findByText('Spending Command Center')).toBeInTheDocument();
    expect(await screen.findByText('Recurring Rules')).toBeInTheDocument();
    expect(await screen.findByText('Streaming Sub')).toBeInTheDocument();
  });

  it('switches between 4 core planning tabs', async () => {
    renderWithQuery(
      <>
        <LocationProbe />
        <SpendingPage />
      </>,
      '/spending/recurring',
    );

    expect(await screen.findByTestId('spending-tab-recurring')).toBeInTheDocument();
    expect(screen.getByTestId('spending-tab-budgets')).toBeInTheDocument();
    expect(screen.getByTestId('spending-tab-kpis')).toBeInTheDocument();
    expect(screen.getByTestId('spending-tab-analytics')).toBeInTheDocument();

    // Switch to Budgets
    fireEvent.click(screen.getByTestId('spending-tab-budgets'));
    await waitFor(() => {
      expect(screen.getByTestId('route-location')).toHaveTextContent('/spending/budgets');
    });

    // Switch to KPIs
    fireEvent.click(screen.getByTestId('spending-tab-kpis'));
    await waitFor(() => {
      expect(screen.getByTestId('route-location')).toHaveTextContent('/spending/kpis');
    });

    // Switch to Analytics
    fireEvent.click(screen.getByTestId('spending-tab-analytics'));
    await waitFor(() => {
      expect(screen.getByTestId('route-location')).toHaveTextContent('/spending/analytics');
    });
  });

  it('creates a recurring rule and displays it in the list', async () => {
    let createdRule: Record<string, unknown> | null = null;
    server.use(
      http.post('*/v1/spending/recurring', async ({ request }) => {
        createdRule = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          public_id: 'rec-new',
          ...createdRule,
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        });
      }),
    );

    renderWithQuery(<SpendingPage />, '/spending/recurring');

    // Wait for categories to load
    expect(await screen.findByText('Recurring Rules')).toBeInTheDocument();

    const newBtn = screen.getByRole('button', { name: /New Rule/i });
    fireEvent.click(newBtn);

    expect(await screen.findByText('New Recurring Rule')).toBeInTheDocument();

    // Fill amount and description
    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '99.99' } });

    const descInput = screen.getByPlaceholderText(/Netflix/i);
    fireEvent.change(descInput, { target: { value: 'Gym Membership' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: 'Create Rule' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createdRule).toEqual(
        expect.objectContaining({
          amount: 99.99,
          description: 'Gym Membership',
        }),
      );
    });
  });

  it('deactivates recurring rule with confirmation dialog', async () => {
    let deactivatedId: string | null = null;
    server.use(
      http.get('*/v1/spending/recurring', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'rec-deact-1',
              category_id: CATEGORY.public_id,
              account_id: ACCOUNT.public_id,
              amount: '15.00',
              type: 'expense',
              description: 'Active Service',
              frequency: 'monthly',
              interval: 1,
              anchor_date: '2026-01-01',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      http.delete('*/v1/spending/recurring/:id', ({ params }) => {
        deactivatedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithQuery(<SpendingPage />, '/spending/recurring');

    expect(await screen.findByText('Active Service')).toBeInTheDocument();

    // Click deactivate toggle
    const toggleBtn = screen.getByTestId('spending-recurring-deactivate');
    fireEvent.click(toggleBtn);

    expect(await screen.findByText('Deactivate recurring rule?')).toBeInTheDocument();

    // Confirm dialog
    const confirmBtn = screen.getByRole('button', { name: 'Deactivate rule' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deactivatedId).toBe('rec-deact-1');
    });
  });

  it('creates and manages categories from dialog', async () => {
    let createdCategory: Record<string, unknown> | null = null;
    server.use(
      http.post('*/v1/spending/categories', async ({ request }) => {
        createdCategory = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          public_id: 'cat-new-created',
          name: createdCategory?.name ?? '',
          color: createdCategory?.color ?? null,
          is_system: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        });
      }),
    );

    renderWithQuery(<SpendingPage />, '/spending/recurring');

    const catBtn = await screen.findByRole('button', { name: /Categories/i });
    fireEvent.click(catBtn);

    expect(await screen.findByText('Manage Categories')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('Category name');
    fireEvent.change(nameInput, { target: { value: 'Entertainment' } });

    const addBtn = screen.getByRole('button', { name: 'Add Category' });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(createdCategory).toEqual(
        expect.objectContaining({
          name: 'Entertainment',
        }),
      );
    });
  });

  it('allows selecting multi-month budget performance range on budgets tab', async () => {
    server.use(
      http.get('*/v1/spending/analytics/budget-performance', () =>
        HttpResponse.json({
          from: '2026-01-01',
          to: '2026-03-31',
          categories: [
            {
              category_id: CATEGORY.public_id,
              category_name: 'Food',
              budget_amount: '900.00',
              actual_amount: '650.00',
              utilization_pct: 72.2,
              remaining: '250.00',
              monthly_breakdown: [
                {
                  month: '2026-01',
                  budget_amount: '300.00',
                  actual_amount: '200.00',
                  utilization_pct: 66.7,
                  remaining: '100.00',
                },
                {
                  month: '2026-02',
                  budget_amount: '300.00',
                  actual_amount: '250.00',
                  utilization_pct: 83.3,
                  remaining: '50.00',
                },
                {
                  month: '2026-03',
                  budget_amount: '300.00',
                  actual_amount: '200.00',
                  utilization_pct: 66.7,
                  remaining: '100.00',
                },
              ],
            },
          ],
        }),
      ),
    );

    renderWithQuery(<SpendingPage />, '/spending/budgets');

    const threeMonthsBtn = await screen.findByRole('button', { name: '3 Months' });
    fireEvent.click(threeMonthsBtn);

    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(screen.getByText(/72% utilized overall/i)).toBeInTheDocument();
  });
});
