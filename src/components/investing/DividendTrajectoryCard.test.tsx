import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { DividendTrajectoryCard } from './DividendTrajectoryCard';
import { server } from '../../test/setup';

const renderComponent = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DividendTrajectoryCard
        displayCurrency="USD"
        currencyDisplayPreference="symbol"
      />
    </QueryClientProvider>,
  );
};

describe('DividendTrajectoryCard', () => {
  beforeEach(() => {
    server.use(
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          base_currency: 'USD',
          currency_display_preference: 'symbol',
        }),
      ),
    );
  });

  it('renders trailing 12M yield, monthly income KPI, and bar chart', async () => {
    server.use(
      http.get('*/v1/investing/dividends/history', () =>
        HttpResponse.json({
          currency: 'USD',
          trailing_12m_total: '1200.00',
          all_time_total: '3500.00',
          points: [
            {
              month: '2026-07',
              gross_amount: '120.00',
              net_amount: '100.00',
              count: 2,
            },
            {
              month: '2026-08',
              gross_amount: '180.00',
              net_amount: '150.00',
              count: 3,
            },
          ],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText('Dividend Income Trajectory')).toBeInTheDocument();
    expect(screen.getByText('Trailing 12-Month Yield')).toBeInTheDocument();
    expect(screen.getByText('$1,200.00')).toBeInTheDocument();
    expect(screen.getByText('Average Monthly Income')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('Cumulative All-Time')).toBeInTheDocument();
    expect(screen.getByText('$3,500.00')).toBeInTheDocument();
    expect(screen.getByText('Monthly Dividend History')).toBeInTheDocument();
  });

  it('renders empty state when no dividend points exist', async () => {
    server.use(
      http.get('*/v1/investing/dividends/history', () =>
        HttpResponse.json({
          currency: 'USD',
          trailing_12m_total: '0.00',
          all_time_total: '0.00',
          points: [],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText(/No dividend payments recorded yet/)).toBeInTheDocument();
  });
});
