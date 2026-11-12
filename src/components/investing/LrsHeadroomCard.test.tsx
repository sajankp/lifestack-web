import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { LrsHeadroomCard } from './LrsHeadroomCard';
import { server } from '../../test/setup';

const renderCard = (props: Parameters<typeof LrsHeadroomCard>[0]) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LrsHeadroomCard {...props} currencyDisplayPreference="symbol" />
    </QueryClientProvider>,
  );

describe('LrsHeadroomCard', () => {
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

  it('renders the LRS headroom value in INR', () => {
    renderCard({ lrsHeadroom: { headroom_inr: '750000.00' }, asOf: '2026-10-31' });

    expect(screen.getByTestId('lrs-headroom-card')).toBeInTheDocument();
    expect(screen.getByText('LRS Headroom')).toBeInTheDocument();
    expect(screen.getByText('₹750,000.00')).toBeInTheDocument();
    expect(screen.getByText('As of 2026-10-31')).toBeInTheDocument();
  });

  it('renders empty state when no headroom exists', () => {
    renderCard({ lrsHeadroom: null });

    expect(screen.getByText('No LRS headroom data')).toBeInTheDocument();
    expect(screen.queryByText('₹750,000.00')).not.toBeInTheDocument();
  });

  it('treats a missing lrs_headroom object as empty', () => {
    renderCard({ lrsHeadroom: undefined });

    expect(screen.getByText('No LRS headroom data')).toBeInTheDocument();
  });
});
