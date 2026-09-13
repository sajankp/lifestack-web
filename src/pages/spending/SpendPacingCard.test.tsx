import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { SpendPacingCard } from './SpendPacingCard';
import { server } from '../../test/setup';

const renderComponent = (selectedMonth = '2026-09') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SpendPacingCard
        selectedMonth={selectedMonth}
        displayCurrency="USD"
        currencyDisplayPreference="symbol"
      />
    </QueryClientProvider>,
  );
};

describe('SpendPacingCard', () => {
  it('renders spend pacing with burn rate, budget comparison, and progress bars', async () => {
    server.use(
      http.get('*/v1/spending/analytics/pacing', () =>
        HttpResponse.json({
          currency: 'USD',
          month: '2026-09',
          days_in_month: 30,
          days_elapsed: 12,
          days_remaining: 18,
          month_elapsed_pct: '40.0',
          total_spent: '600.00',
          daily_burn_rate: '50.00',
          projected_spend: '1500.00',
          total_budget: '2000.00',
          budget_consumed_pct: '30.0',
          pacing_status: 'under_budget',
          pacing_delta: '-500.00',
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByTestId('spend-pacing-card')).toBeInTheDocument();
    expect(screen.getByText('Monthly Spend Pacing')).toBeInTheDocument();
    expect(screen.getByText('Under Budget Pace')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
    expect(screen.getByText(/Pacing healthy/)).toBeInTheDocument();
  });

  it('renders runaway burn alert when pacing exceeds budget', async () => {
    server.use(
      http.get('*/v1/spending/analytics/pacing', () =>
        HttpResponse.json({
          currency: 'USD',
          month: '2026-09',
          days_in_month: 30,
          days_elapsed: 15,
          days_remaining: 15,
          month_elapsed_pct: '50.0',
          total_spent: '1800.00',
          daily_burn_rate: '120.00',
          projected_spend: '3600.00',
          total_budget: '2500.00',
          budget_consumed_pct: '72.0',
          pacing_status: 'over_budget',
          pacing_delta: '1100.00',
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText('Projected Over Budget')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByText('$3,600.00')).toBeInTheDocument();
    expect(screen.getByText(/Runaway burn rate/)).toBeInTheDocument();
  });

  it('renders fixed vs discretionary burn split and category pacing breakdown', async () => {
    server.use(
      http.get('*/v1/spending/analytics/pacing', () =>
        HttpResponse.json({
          currency: 'USD',
          month: '2026-09',
          days_in_month: 30,
          days_elapsed: 15,
          days_remaining: 15,
          month_elapsed_pct: '50.0',
          total_spent: '2000.00',
          daily_burn_rate: '133.33',
          projected_spend: '4000.00',
          total_budget: '4500.00',
          budget_consumed_pct: '44.4',
          pacing_status: 'on_track',
          pacing_delta: '-500.00',
          fixed_spend: '1400.00',
          discretionary_spend: '600.00',
          fixed_burn_rate: '93.33',
          discretionary_burn_rate: '40.00',
          categories: [
            {
              category_id: 'cat-housing',
              category_name: 'Housing & Utilities',
              actual_spend: '1200.00',
              budget_amount: '1200.00',
              budget_consumed_pct: '100.0',
              daily_burn_rate: '80.00',
              projected_spend: '1200.00',
              status: 'on_track',
            },
            {
              category_id: 'cat-dining',
              category_name: 'Dining Out',
              actual_spend: '500.00',
              budget_amount: '400.00',
              budget_consumed_pct: '125.0',
              daily_burn_rate: '33.33',
              projected_spend: '1000.00',
              status: 'over_budget',
            },
          ],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText('Burn Velocity Split')).toBeInTheDocument();
    expect(screen.getByText('Fixed (Committed)')).toBeInTheDocument();
    expect(screen.getByText('$1,400.00')).toBeInTheDocument();
    expect(screen.getByText('Discretionary (Lifestyle)')).toBeInTheDocument();
    expect(screen.getByText('$600.00')).toBeInTheDocument();

    expect(screen.getByText('Category Pacing Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Housing & Utilities')).toBeInTheDocument();
    expect(screen.getByText('Dining Out')).toBeInTheDocument();
    expect(screen.getByText('Over Pacing')).toBeInTheDocument();
  });
});

