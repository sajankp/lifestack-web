import { render, screen } from '@testing-library/react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { PortfolioPerformanceChart } from './PortfolioPerformanceChart';
import { server } from '../../test/setup';

const renderComponent = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PortfolioPerformanceChart currencyDisplayPreference="symbol" />
    </QueryClientProvider>,
  );
};

describe('PortfolioPerformanceChart', () => {
  it('renders KPI metrics and SVG chart with performance points', async () => {
    server.use(
      http.get('*/v1/investing/performance/history', () =>
        HttpResponse.json({
          currency: 'USD',
          net_change: '1500.00',
          net_change_pct: '3.00',
          points: [
            {
              snapshot_date: '2026-08-01',
              total_value: '50000.00',
              cost_basis: '45000.00',
              cash_balance: '2000.00',
              unrealized_gain: '5000.00',
              unrealized_gain_pct: '11.11',
            },
            {
              snapshot_date: '2026-09-01',
              total_value: '51500.00',
              cost_basis: '45000.00',
              cash_balance: '2000.00',
              unrealized_gain: '6500.00',
              unrealized_gain_pct: '14.44',
            },
          ],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText('Market Value')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Performance Over Time')).toBeInTheDocument();
    expect(screen.getByText('Cost Basis')).toBeInTheDocument();
    expect(screen.getByText('$51,500.00')).toBeInTheDocument();
    expect(screen.getByText('+$1,500.00')).toBeInTheDocument();


    // Range buttons
    expect(screen.getByTestId('perf-range-1M')).toBeInTheDocument();
    expect(screen.getByTestId('perf-range-3M')).toBeInTheDocument();
    expect(screen.getByTestId('perf-range-ALL')).toBeInTheDocument();
  });

  it('renders empty state when insufficient snapshot history exists', async () => {
    server.use(
      http.get('*/v1/investing/performance/history', () =>
        HttpResponse.json({
          currency: 'USD',
          net_change: '0.00',
          net_change_pct: '0.00',
          points: [],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText('Not enough history yet')).toBeInTheDocument();
  });
});
