import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { HarvestCandidate } from '../../types/investing';
import { HarvestCandidatesCard } from './HarvestCandidatesCard';
import { server } from '../../test/setup';

const CANDIDATES: HarvestCandidate[] = [
  { symbol: 'RELIANCE', quantity: '10', loss: '45000.00', tax_saved: '13500.00' },
  { symbol: 'TATAMOTORS', quantity: '5', loss: '20000.00', tax_saved: '6000.00' },
];

const renderCard = (harvestCandidates: HarvestCandidate[]) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HarvestCandidatesCard harvestCandidates={harvestCandidates} />
    </QueryClientProvider>,
  );

describe('HarvestCandidatesCard', () => {
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

  it('renders harvest candidates with loss and tax saved', () => {
    renderCard(CANDIDATES);

    expect(screen.getByTestId('harvest-candidates-card')).toBeInTheDocument();
    expect(screen.getByText('Harvest Candidates')).toBeInTheDocument();

    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('10 qty')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('harvest-row-0')).getByText('− INR 45,000.00'),
    ).toBeInTheDocument();
    expect(screen.getByText('Tax saved INR 13,500.00')).toBeInTheDocument();

    expect(screen.getByText('TATAMOTORS')).toBeInTheDocument();
    expect(screen.getByText('5 qty')).toBeInTheDocument();
    expect(screen.getByText('− INR 20,000.00')).toBeInTheDocument();
    expect(screen.getByText('Tax saved INR 6,000.00')).toBeInTheDocument();

    // Totals
    expect(screen.getByText('Total (2)')).toBeInTheDocument();
    expect(screen.getByText('− INR 65,000.00')).toBeInTheDocument();
    expect(screen.getByText('INR 19,500.00')).toBeInTheDocument();
  });

  it('renders empty state when no candidates exist', () => {
    renderCard([]);

    expect(screen.getByText('No harvest candidates')).toBeInTheDocument();
    expect(screen.queryByText('RELIANCE')).not.toBeInTheDocument();
  });
});
