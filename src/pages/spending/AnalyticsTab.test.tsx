import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { AnalyticsTab } from './AnalyticsTab';
import { server } from '../../test/setup';

const renderComponent = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnalyticsTab
        selectedMonth="2026-08"
        onMonthChange={() => {}}
        monthOptions={[{ value: '2026-08', label: 'August 2026' }]}
        displayCurrency="USD"
        currencyDisplayPreference="symbol"
      />
    </QueryClientProvider>,
  );
};

describe('Spending AnalyticsTab Visuals & Charts', () => {
  beforeEach(() => {
    server.use(
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          base_currency: 'USD',
          currency_display_preference: 'symbol',
        }),
      ),
      http.get('*/v1/spending/analytics/pacing', () =>
        HttpResponse.json({
          currency: 'USD',
          month: '2026-08',
          days_in_month: 31,
          days_elapsed: 15,
          days_remaining: 16,
          month_progress_pct: 48.39,
          actual_spend: '1500.00',
          daily_burn_rate: '100.00',
          projected_month_end_spend: '3100.00',
          total_budget: '3000.00',
          budget_consumed_pct: 50.0,
          target_pace_pct: 48.39,
          pacing_delta_pct: 1.61,
          status: 'on_track',
          fixed_spend: '500.00',
          discretionary_spend: '1000.00',
          fixed_burn_rate: '33.33',
          discretionary_burn_rate: '66.67',
          categories: [],
        }),
      ),
      http.get('*/v1/spending/analytics/trends', () =>
        HttpResponse.json({
          currency: 'USD',
          months: [
            {
              month: '2026-07',
              total_income: '5000.00',
              total_expense: '3500.00',
              net_savings: '1500.00',
            },
            {
              month: '2026-08',
              total_income: '5200.00',
              total_expense: '3800.00',
              net_savings: '1400.00',
            },
          ],
        }),
      ),
      http.get('*/v1/spending/analytics/breakdown', () =>
        HttpResponse.json({
          from: '2026-03-01',
          to: '2026-08-31',
          type: 'expense',
          currency: 'USD',
          total: '3800.00',
          categories: [
            {
              category_id: 'cat-1',
              category_name: 'Housing & Rent',
              amount: '1800.00',
              pct_of_total: 47.37,
              transaction_count: 2,
            },
            {
              category_id: 'cat-2',
              category_name: 'Groceries & Dining',
              amount: '1200.00',
              pct_of_total: 31.58,
              transaction_count: 14,
            },
          ],
          other: {
            amount: '800.00',
            pct_of_total: 21.05,
            category_count: 3,
          },
        }),
      ),
      http.get('*/v1/spending/analytics/tag-breakdown', () =>
        HttpResponse.json({
          from: '2026-03-01',
          to: '2026-08-31',
          type: 'expense',
          currency: 'USD',
          total: '3800.00',
          tags: [
            {
              tag_id: 'tag-1',
              tag_name: 'Vacation',
              amount: '500.00',
              pct_of_total: 13.16,
              transaction_count: 2,
            },
          ],
        }),
      ),
      http.get('*/v1/spending/analytics/savings-rate', () =>
        HttpResponse.json({
          currency: 'USD',
          period_totals: {
            total_income: '10200.00',
            total_expense: '7300.00',
            total_savings: '2900.00',
            average_savings_rate_pct: 28.4,
          },
          months: [
            {
              month: '2026-07',
              savings_rate_pct: 30.0,
            },
            {
              month: '2026-08',
              savings_rate_pct: 26.92,
            },
          ],
        }),
      ),
    );
  });

  it('renders modern period summary stats, trend bar chart, and savings rate curve', async () => {
    renderComponent();

    expect(await screen.findByText('Period Income')).toBeInTheDocument();
    expect(screen.getByText('$10,200.00')).toBeInTheDocument();
    expect(screen.getByText('Period Expenses')).toBeInTheDocument();
    expect(screen.getByText('$7,300.00')).toBeInTheDocument();
    expect(screen.getByText('Net Savings')).toBeInTheDocument();
    expect(screen.getByText('$2,900.00')).toBeInTheDocument();
    expect(screen.getByText('Avg Savings Rate')).toBeInTheDocument();
    expect(screen.getByText('28.4%')).toBeInTheDocument();

    expect(screen.getByText('Income vs Expenses Trend')).toBeInTheDocument();
    expect(screen.getByTestId('savings-rate-trend-chart')).toBeInTheDocument();
  });

  it('renders interactive category allocation donut and tags breakdown', async () => {
    renderComponent();

    expect(await screen.findByText('Housing & Rent')).toBeInTheDocument();
    expect(screen.getByText('Groceries & Dining')).toBeInTheDocument();
    expect(screen.getByText('Other Categories')).toBeInTheDocument();
    expect(screen.getByText('$1,800.00')).toBeInTheDocument();

    expect(await screen.findByText('Vacation')).toBeInTheDocument();
    expect(screen.getAllByText('$500.00').length).toBeGreaterThanOrEqual(1);
  });

  it('switches between Expense and Income breakdown views', async () => {
    renderComponent();

    const incomeBtn = await screen.findByRole('button', { name: 'Income' });
    fireEvent.click(incomeBtn);
    expect(await screen.findByRole('button', { name: 'Income' })).toHaveClass('text-cyan-300');
  });
});
