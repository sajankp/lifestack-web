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
          currency: 'USD',
          total_portfolio_value: '50000.00',
          as_of: '2026-09-12T12:00:00Z',
          by_asset_class: [
            {
              asset_class: 'stock',
              total_value: '35000.00',
              percentage: '70.0',
              holdings_count: 5,
            },
            {
              asset_class: 'etf',
              total_value: '15000.00',
              percentage: '30.0',
              holdings_count: 2,
            },
          ],
          by_sector: [
            {
              sector: 'Technology',
              total_value: '30000.00',
              percentage: '60.0',
              holdings_count: 4,
            },
            {
              sector: 'Healthcare',
              total_value: '20000.00',
              percentage: '40.0',
              holdings_count: 3,
            },
          ],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText('Portfolio Allocation')).toBeInTheDocument();
    expect(screen.getByText('Stocks & Equities')).toBeInTheDocument();
    expect(screen.getByText('ETFs & Funds')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument();
    expect(screen.getByText('30.0%')).toBeInTheDocument();

    // Toggle to Sectors
    const sectorBtn = screen.getByRole('button', { name: 'Sectors' });
    fireEvent.click(sectorBtn);

    expect(await screen.findByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
  });

  it('renders empty state when no holdings are present', async () => {
    server.use(
      http.get('*/v1/investing/analytics/allocation', () =>
        HttpResponse.json({
          currency: 'USD',
          total_portfolio_value: '0.00',
          as_of: '2026-09-12T12:00:00Z',
          by_asset_class: [],
          by_sector: [],
        }),
      ),
    );

    renderComponent();

    expect(await screen.findByText(/No holdings recorded for asset class allocation/)).toBeInTheDocument();
  });
});
