import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { http, HttpResponse } from 'msw';

import { WeeklySummariesPage } from './WeeklySummariesPage';
import { server } from '../test/setup';

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <WeeklySummariesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('WeeklySummariesPage', () => {
  it('renders typed weekly metrics and keeps investment cash separate', async () => {
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              todo_summary: { tasks_created: 5, tasks_completed: 4 },
              spending_summary: {
                status: 'complete',
                total_income: '5000.00',
                total_expense: '3200.00',
                net: '1800.00',
                currency: 'INR',
                has_multiple_currencies: false,
                top_categories: [],
                budget_utilization_pct: null,
                budgets_breached: 0,
              },
              investing_summary: {
                status: 'complete',
                portfolio_value_start: '100000.00',
                portfolio_value_end: '102500.00',
                cash_start: '5000.00',
                cash_end: '5200.00',
                week_change: '2500.00',
                week_change_pct: '2.50',
                currency: 'INR',
                start_snapshot_date: '2026-06-14',
                end_snapshot_date: '2026-06-21',
              },
              highlights: { flags: [] },
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText('Tasks completed')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Portfolio value')).toBeInTheDocument();
    expect(screen.getByText(/₹102,500.00|₹1,02,500.00|INR 102,500.00/)).toBeInTheDocument();
    expect(screen.getByText('Investment cash')).toBeInTheDocument();
    expect(screen.getByText(/₹5,200.00|INR 5,200.00/)).toBeInTheDocument();
    expect(screen.getByText(/\(\+2\.50%\)/)).toBeInTheDocument();
    expect(screen.queryByText(/"portfolio_value_end"/)).not.toBeInTheDocument();
  });
});
