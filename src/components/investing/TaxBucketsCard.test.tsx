import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { TaxBucket } from '../../types/investing';
import { TaxBucketsCard } from './TaxBucketsCard';
import { server } from '../../test/setup';

const BUCKET: TaxBucket = {
  regime: 'foreign',
  section: '115AD',
  rate_pct: '12.5',
  gain_native: '83333.33',
  gain_inr: '100000.00',
  fees_native: '0',
  fees_inr: '0',
  exemption_applied: '0',
  tax: '12500.00',
  sell_count: 2,
  lot_count: 2,
};

const renderCard = (taxBuckets: TaxBucket[], currencyDisplayPreference: 'symbol' | 'code' = 'symbol') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TaxBucketsCard
        taxBuckets={taxBuckets}
        currencyDisplayPreference={currencyDisplayPreference}
      />
    </QueryClientProvider>,
  );

describe('TaxBucketsCard', () => {
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

  it('renders buckets with totals', () => {
    renderCard([BUCKET, { ...BUCKET, regime: 'domestic', section: '112A', rate_pct: '10', gain_inr: '150000.00', tax: '2500.00' }]);

    expect(screen.getByTestId('tax-buckets-card')).toBeInTheDocument();
    expect(screen.getByText('Tax Buckets')).toBeInTheDocument();

    expect(screen.getByText('Foreign')).toBeInTheDocument();
    expect(screen.getByText('Domestic')).toBeInTheDocument();
    expect(screen.getByText('115AD')).toBeInTheDocument();
    expect(screen.getByText('112A')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();

    expect(screen.getByText('₹100,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹12,500.00')).toBeInTheDocument();
    expect(screen.getByText('₹150,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹2,500.00')).toBeInTheDocument();

    // Totals row: 250,000 gain, 15,000 tax
    expect(screen.getByTestId('tax-buckets-total-gain')).toHaveTextContent('₹250,000.00');
    expect(screen.getByTestId('tax-buckets-total-tax')).toHaveTextContent('₹15,000.00');
  });

  it('renders empty state when no buckets exist', () => {
    renderCard([]);

    expect(screen.getByText('No tax buckets recorded')).toBeInTheDocument();
    expect(screen.queryByTestId('tax-bucket-row-0')).not.toBeInTheDocument();
  });

  it('shows currency code instead of symbol when preferred', () => {
    renderCard([BUCKET], 'code');

    expect(screen.queryByText('₹100,000.00')).not.toBeInTheDocument();
    expect(screen.getByTestId('tax-buckets-total-gain')).toHaveTextContent('INR 100,000.00');
  });
});
