import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { PortfolioReport } from '../../types/investing';
import { PortfolioReportCards } from './PortfolioReportCards';
import { server } from '../../test/setup';

const MOCK_REPORT: PortfolioReport = {
  public_id: '550e8400-e29b-41d4-a716-446655440000',
  as_of: '2026-10-31',
  run_id: 'run-1',
  theme_weights: { 'US Equities': 55, 'India Equities': 30, Gold: 10, Cash: 5 },
  harvest_candidates: [
    { symbol: 'RELIANCE', quantity: '10', loss: '45000.00', tax_saved: '13500.00' },
  ],
  lrs_headroom_inr: '750000.00',
  tax_buckets: {
    foreign_115AD: {
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
    },
  },
  created_at: '2026-11-01T00:00:00Z',
  scalars_json: null,
  foundation_json: {
    countries: JSON.stringify([
      { country: 'US', weight: 70 },
      { country: 'IN', weight: 20 },
      { country: 'GB', weight: 7 },
      { country: 'AE', weight: 3 },
    ]),
  },
  actions_md: null,
};

const renderCards = (props: Parameters<typeof PortfolioReportCards>[0]) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PortfolioReportCards {...props} />
    </QueryClientProvider>,
  );

describe('PortfolioReportCards', () => {
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

  it('renders tax and harvest rows from the shapes the cron actually stores', async () => {
    // Production rows: flat tax scalars and the script's harvest_detail keys.
    renderCards({
      report: {
        ...MOCK_REPORT,
        harvest_candidates: [
          {
            symbol: 'ABC',
            account: 'IND Money',
            qty: 4,
            unrealised_loss_inr: 2500.5,
            days_to_long_term: 40,
            tax_saved_inr: 780.25,
          },
        ],
        tax_buckets: {
          lt_gain_inr: 1000,
          lt_tax_inr: 125,
          st_gain_inr: 200,
          st_tax_inr: 70,
          total_tax_inr: 195,
          slab_pct: 30,
          advance_paid_inr: 0,
        },
      },
      currencyDisplayPreference: 'symbol',
    });

    expect(await screen.findByTestId('tax-bucket-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('tax-bucket-row-1')).toBeInTheDocument();
    expect(screen.queryByText('No tax buckets recorded')).not.toBeInTheDocument();

    expect(await screen.findByTestId('harvest-row-0')).toHaveTextContent('ABC');
    expect(screen.queryByText('No harvest candidates')).not.toBeInTheDocument();
  });

  it('renders all five report cards from the latest report', async () => {
    renderCards({ report: MOCK_REPORT, currencyDisplayPreference: 'symbol' });

    expect(screen.getByTestId('portfolio-report-cards')).toBeInTheDocument();

    expect(await screen.findByText('LRS Headroom')).toBeInTheDocument();
    // Currency formatting may vary by locale
    expect(
      await screen.findByText((content) => content.includes('750') && content.includes('000')),
    ).toBeInTheDocument();

    expect(await screen.findByText('Tax Buckets')).toBeInTheDocument();
    // Check totals with flexible matching
    const totalGain = screen.getByTestId('tax-buckets-total-gain');
    expect(totalGain.textContent).toMatch(/100.*000/);
    const totalTax = screen.getByTestId('tax-buckets-total-tax');
    expect(totalTax.textContent).toMatch(/12.*500/);

    expect(await screen.findByText('Theme Split')).toBeInTheDocument();
    expect(screen.getByText('US Equities')).toBeInTheDocument();
    expect(screen.getByText('55.0%')).toBeInTheDocument();

    expect(await screen.findByText('Country Split')).toBeInTheDocument();
    expect(screen.getByText('US')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument();

    expect(await screen.findByText('Harvest Candidates')).toBeInTheDocument();
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('harvest-row-0')).getByText(
        (content) => content.includes('45') && content.includes('000'),
      ),
    ).toBeInTheDocument();
    const totalLoss = screen.getByTestId('harvest-total-loss');
    expect(totalLoss.textContent).toMatch(/45.*000/);
    const totalTaxSaved = screen.getByTestId('harvest-total-tax-saved');
    expect(totalTaxSaved.textContent).toMatch(/13.*500/);
  });

  it('renders empty state when no report exists', () => {
    renderCards({ report: null, currencyDisplayPreference: 'symbol' });

    expect(screen.getByText('No portfolio report available')).toBeInTheDocument();
    expect(screen.queryByText('LRS Headroom')).not.toBeInTheDocument();
  });
});
