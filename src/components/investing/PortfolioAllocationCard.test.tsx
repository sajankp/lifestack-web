import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { PortfolioAllocationCard } from './PortfolioAllocationCard';
import { server } from '../../test/setup';

const renderComponent = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PortfolioAllocationCard
        displayCurrency="USD"
        currencyDisplayPreference="symbol"
      />
    </QueryClientProvider>,
  );
};

describe('PortfolioAllocationCard', () => {
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

  it('renders asset class allocation with donut chart and toggles to sectors', async () => {
    server.use(
      http.get('*/v1/investing/analytics/allocation', () =>
        HttpResponse.json({
          as_of_date: '2026-09-12',
          currency: 'USD',
          total_portfolio_value: '50000.00',
          holdings_value: '50000.00',
          cash_value: '0.00',
          asset_classes: [
            { key: 'stock', label: 'Stocks', value: '35000.00', pct: 70.0, count: 5 },
            { key: 'etf', label: 'ETFs', value: '15000.00', pct: 30.0, count: 2 },
            { key: 'mutual_fund', label: 'Mutual Funds', value: '0.00', pct: 0.0, count: 0 },
            { key: 'cash', label: 'Cash', value: '0.00', pct: 0.0, count: 0 },
          ],
          sectors: [
            { sector: 'Information Technology', value: '30000.00', pct: 60.0 },
            { sector: 'Health Care', value: '20000.00', pct: 40.0 },
          ],
          lookthrough: false,
          fund_coverage: [],
          warnings: [],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText('Portfolio Allocation')).toBeInTheDocument();
    expect(await screen.findByText('Stocks & Equities')).toBeInTheDocument();
    expect(screen.getByText('ETFs & Funds')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument();
    expect(screen.getByText('30.0%')).toBeInTheDocument();
    // Empty buckets (0 holdings, 0 value) are not listed
    expect(screen.queryByText('Mutual Funds')).not.toBeInTheDocument();
    expect(screen.queryByText('Cash & Equivalents')).not.toBeInTheDocument();

    // Toggle to Sectors
    fireEvent.click(screen.getByRole('button', { name: 'Sectors' }));

    expect(await screen.findByText('Information Technology')).toBeInTheDocument();
    expect(screen.getByText('Health Care')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
  });

  it('lists a cash-only portfolio under Cash', async () => {
    server.use(
      http.get('*/v1/investing/analytics/allocation', () =>
        HttpResponse.json({
          as_of_date: '2026-09-12',
          currency: 'USD',
          total_portfolio_value: '1000.00',
          holdings_value: '0.00',
          cash_value: '1000.00',
          asset_classes: [
            { key: 'cash', label: 'Cash', value: '1000.00', pct: 100.0, count: 1 },
          ],
          sectors: [],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText('Cash & Equivalents')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('renders empty state when no holdings are present', async () => {
    server.use(
      http.get('*/v1/investing/analytics/allocation', () =>
        HttpResponse.json({
          as_of_date: '2026-09-12',
          currency: 'USD',
          total_portfolio_value: '0.00',
          holdings_value: '0.00',
          cash_value: '0.00',
          asset_classes: [],
          sectors: [],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText(/No holdings recorded for asset class allocation/)).toBeInTheDocument();
  });
});
