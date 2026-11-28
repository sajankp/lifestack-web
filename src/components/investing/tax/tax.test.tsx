import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { investingService } from '../../../services/investing';
import { financeService } from '../../../services/finance';
import { TaxSummarySchema } from '../../../types/investing';
import {
  SaleSimulationSchema,
  TaxDatesResponseSchema,
  TaxOpportunitiesResponseSchema,
} from '../../../types/taxPlanning';
import { YearSoFar } from './YearSoFar';
import { WaysToPayLess } from './WaysToPayLess';
import { BeforeYouSell } from './BeforeYouSell';
import { LrsCard } from './LrsCard';
import { TaxDates } from './TaxDates';

vi.mock('../../../services/investing', () => ({
  investingService: {
    getTaxOpportunities: vi.fn(),
    getTaxDates: vi.fn(),
    simulateSale: vi.fn(),
    getHoldings: vi.fn(),
  },
}));
vi.mock('../../../services/finance', () => ({ financeService: { getLrsSummary: vi.fn() } }));

const investing = vi.mocked(investingService);
const finance = vi.mocked(financeService);

const renderWith = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => vi.clearAllMocks());

// ── This year so far ──────────────────────────────────────────────────────

const SUMMARY = TaxSummarySchema.parse({
  status: 'success',
  fy_label: '2026-27',
  total_gain_inr: '74000',
  total_tax_inr: '12480.00',
  effective_rate_pct: '16.86',
  buckets: {
    'indian:long_term': {
      regime: 'indian',
      gain_inr: '150000',
      set_off_inr: '25000',
      carry_forward_set_off_inr: '0',
      exemption_applied: '125000',
      taxable_inr: '0',
      tax: '0',
    },
    'foreign:short_term': {
      regime: 'foreign',
      gain_inr: '60000',
      set_off_inr: '0',
      carry_forward_set_off_inr: '0',
      exemption_applied: '0',
      taxable_inr: '60000',
      tax: '12480.00',
    },
    'indian:short_term': { regime: 'indian', gain_inr: '-36000', tax: '0' },
  },
  set_off_steps: [
    {
      loss_from: 'indian:short_term',
      applied_to: 'indian:long_term',
      amount_inr: '25000',
      rate_pct: '0.125',
    },
  ],
  unabsorbed_loss: { short_term: '11000', long_term: '0' },
  carry_forward: {
    used: [
      {
        arising_fy: '2025-26',
        applies_to_fy: '2026-27',
        term: 'short_term',
        amount_inr: '9000',
        used_inr: '4000',
        remaining_inr: '5000',
      },
    ],
    remaining: [],
    expired: [],
  },
});

describe('YearSoFar', () => {
  it('shows each bucket as gains -> after losses -> after exemption -> tax', () => {
    renderWith(<YearSoFar summary={SUMMARY} />);
    const lt = screen.getByTestId('tax-bucket-indian:long_term');
    expect(within(lt).getByText('Indian long-term')).toBeInTheDocument();
    // 150,000 gain, 25,000 set off -> 125,000, less the 125,000 exemption -> 0
    expect(lt).toHaveTextContent('after losses');
    expect(lt).toHaveTextContent('after the ₹1.25L exemption');
    expect(lt).toHaveTextContent('tax');
    const foreign = screen.getByTestId('tax-bucket-foreign:short_term');
    expect(foreign).not.toHaveTextContent('exemption');
    expect(foreign).toHaveTextContent('12,480.00');
  });

  it('shows a loss bucket as a loss, not a gain', () => {
    renderWith(<YearSoFar summary={SUMMARY} />);
    expect(screen.getByTestId('tax-bucket-indian:short_term')).toHaveTextContent(
      /Loss of .*36,000/,
    );
  });

  it('keeps the totals and their test ids', () => {
    renderWith(<YearSoFar summary={SUMMARY} />);
    expect(screen.getByTestId('tax-total-tax')).toHaveTextContent('12,480.00');
    expect(screen.getByTestId('tax-total-gain')).toHaveTextContent('74,000');
    expect(screen.getByTestId('tax-effective-rate')).toHaveTextContent('16.86%');
  });

  it('explains the set-off, the unabsorbed loss and the brought-forward loss in sentences', () => {
    renderWith(<YearSoFar summary={SUMMARY} />);
    const notes = screen.getByTestId('tax-set-off-notes');
    expect(notes).toHaveTextContent(
      'Indian short-term loss set off against Indian long-term gains',
    );
    expect(notes).toHaveTextContent('taxed at 12.5%');
    expect(notes).toHaveTextContent('11,000');
    expect(notes).toHaveTextContent('short-term loss has no gain to absorb it');
    expect(notes).toHaveTextContent('brought forward from 2025-26');
    expect(notes).toHaveTextContent('4,000');
  });

  it('has no notes block when nothing was set off', () => {
    const quiet = TaxSummarySchema.parse({
      fy_label: '2026-27',
      buckets: { 'foreign:long_term': { regime: 'foreign', gain_inr: '100', tax: '13' } },
    });
    renderWith(<YearSoFar summary={quiet} />);
    expect(screen.queryByTestId('tax-set-off-notes')).not.toBeInTheDocument();
  });
});

// ── Ways to pay less ──────────────────────────────────────────────────────

const OPPORTUNITIES = TaxOpportunitiesResponseSchema.parse({
  total_saves_this_fy_inr: '2288.00',
  opportunities: [
    {
      kind: 'wait_for_long_term',
      timing: 'this_fy',
      saves_inr: '2080.00',
      symbol: 'INFY',
      headline: 'Hold INFY until 16 Dec 2026',
      detail: 'Selling today is taxed as short-term. Waiting saves about ₹2,080.00.',
      act_by: '2026-12-16',
    },
    {
      kind: 'harvest_loss',
      timing: 'this_fy',
      saves_inr: '208.00',
      symbol: 'LOSER',
      headline: 'Sell 100 LOSER to book a loss',
      detail: 'Short-term loss of 2000.00 saves ₹208.00.',
      act_by: '2027-03-31',
    },
    {
      kind: 'use_exemption',
      timing: 'later_years',
      saves_inr: '15600.00',
      headline: 'Use your tax-free allowance',
      detail: '₹125,000.00 of your allowance is unused.',
      act_by: '2027-03-31',
      lots: [{ symbol: 'LTFUND', quantity: '100', gain_inr: '120000.00' }],
    },
  ],
});

describe('WaysToPayLess', () => {
  it('lists each opportunity and says when the saving lands', async () => {
    investing.getTaxOpportunities.mockResolvedValue(OPPORTUNITIES);
    renderWith(<WaysToPayLess />);

    const wait = await screen.findByTestId('tax-opportunity-wait_for_long_term');
    expect(wait).toHaveTextContent('Hold INFY until 16 Dec 2026');
    expect(wait).toHaveTextContent('saves about');
    expect(wait).toHaveTextContent('this year');
    expect(screen.getByTestId('tax-opportunity-harvest_loss')).toHaveTextContent('this year');

    const exemption = screen.getByTestId('tax-opportunity-use_exemption');
    expect(exemption).toHaveTextContent('in later years');
    expect(within(exemption).getByText('LTFUND')).toBeInTheDocument();
    expect(screen.getByTestId('tax-total-saves')).toHaveTextContent('2,288.00');
  });

  it('keeps the API order (this year first, later years last)', async () => {
    investing.getTaxOpportunities.mockResolvedValue(OPPORTUNITIES);
    renderWith(<WaysToPayLess />);
    await screen.findByTestId('tax-opportunity-wait_for_long_term');
    const kinds = screen
      .getAllByTestId(/^tax-opportunity-/)
      .map((el) => el.getAttribute('data-testid'));
    expect(kinds).toEqual([
      'tax-opportunity-wait_for_long_term',
      'tax-opportunity-harvest_loss',
      'tax-opportunity-use_exemption',
    ]);
  });

  it('says plainly when there is nothing to do', async () => {
    investing.getTaxOpportunities.mockResolvedValue(
      TaxOpportunitiesResponseSchema.parse({ opportunities: [] }),
    );
    renderWith(<WaysToPayLess />);
    expect(await screen.findByTestId('tax-no-opportunities')).toHaveTextContent('Nothing to do');
  });

  it('shows the API warnings', async () => {
    investing.getTaxOpportunities.mockResolvedValue(
      TaxOpportunitiesResponseSchema.parse({ warnings: ['Prices older than 3 days were used.'] }),
    );
    renderWith(<WaysToPayLess />);
    expect(await screen.findByText('Prices older than 3 days were used.')).toBeInTheDocument();
  });

  it('reports a failed load instead of an empty list', async () => {
    investing.getTaxOpportunities.mockRejectedValue(new Error('boom'));
    renderWith(<WaysToPayLess />);
    expect(await screen.findByText(/Could not load the suggestions/)).toBeInTheDocument();
    expect(screen.queryByTestId('tax-no-opportunities')).not.toBeInTheDocument();
  });
});

// ── Dates ─────────────────────────────────────────────────────────────────

describe('TaxDates', () => {
  it('lists dates nearest first with an estimate badge only where it applies', async () => {
    investing.getTaxDates.mockResolvedValue(
      TaxDatesResponseSchema.parse({
        dates: [
          {
            kind: 'advance_tax',
            date: '2026-12-15',
            days_until: 17,
            headline: 'Advance tax due 15 Dec 2026',
            detail: 'About ₹75,000.00 should be paid by then.',
            estimate: true,
          },
          {
            kind: 'long_term',
            date: '2026-12-21',
            days_until: 1,
            headline: 'INFY turns long-term 21 Dec 2026',
            detail: '10 units become long-term.',
            estimate: false,
          },
        ],
      }),
    );
    renderWith(<TaxDates />);

    const advance = await screen.findByTestId('tax-date-advance_tax');
    expect(advance).toHaveTextContent('estimate');
    expect(advance).toHaveTextContent('in 17 days');
    const longTerm = screen.getByTestId('tax-date-long_term');
    expect(longTerm).not.toHaveTextContent('estimate');
    expect(longTerm).toHaveTextContent('tomorrow');
  });

  it('says so when no dates are coming up', async () => {
    investing.getTaxDates.mockResolvedValue(TaxDatesResponseSchema.parse({}));
    renderWith(<TaxDates />);
    expect(await screen.findByTestId('tax-no-dates')).toBeInTheDocument();
  });
});

// ── LRS ───────────────────────────────────────────────────────────────────

describe('LrsCard', () => {
  it('shows what is used and what is left of the cap', async () => {
    finance.getLrsSummary.mockResolvedValue({
      fy_label: '2026-27',
      transfer_count: 2,
      total_usd: '60000.00',
      cap_usd: '250000.00',
      cap_remaining_usd: '190000.00',
      cap_exceeded: false,
      pct_of_cap: '24.00',
      total_inr: '5000000.00',
      tcs_threshold_inr: '1000000',
      tcs_applicable: true,
      tcs_amount_inr: '800000.00',
      assumptions: [],
    });
    renderWith(<LrsCard />);
    expect(await screen.findByTestId('tax-lrs-used')).toHaveTextContent('60,000');
    expect(screen.getByTestId('tax-lrs-headroom')).toHaveTextContent('190,000');
    expect(screen.getByTestId('tax-lrs-tcs')).toHaveTextContent('800,000');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '24');
  });

  it('says the limit has been passed', async () => {
    finance.getLrsSummary.mockResolvedValue({
      fy_label: '2026-27',
      transfer_count: 1,
      total_usd: '260000.00',
      cap_usd: '250000.00',
      cap_remaining_usd: '0.00',
      cap_exceeded: true,
      pct_of_cap: '104.00',
      total_inr: '1',
      tcs_threshold_inr: '1',
      tcs_applicable: false,
      tcs_amount_inr: '0',
      assumptions: [],
    });
    renderWith(<LrsCard />);
    expect(await screen.findByTestId('tax-lrs-headroom')).toHaveTextContent(
      'limit has been passed',
    );
    expect(screen.queryByTestId('tax-lrs-tcs')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders nothing when the summary cannot load', async () => {
    finance.getLrsSummary.mockRejectedValue(new Error('boom'));
    renderWith(<LrsCard />);
    await waitFor(() => expect(finance.getLrsSummary).toHaveBeenCalled());
    expect(screen.queryByTestId('tax-lrs')).not.toBeInTheDocument();
  });
});

// ── Before you sell ───────────────────────────────────────────────────────

const HOLDINGS = {
  items: [
    { public_id: 'h-infy', symbol: 'INFY', account_name: 'in-broker', quantity: '150' },
    { public_id: 'h-zero', symbol: 'GONE', account_name: 'in-broker', quantity: '0' },
  ],
  total: 2,
  limit: 200,
  offset: 0,
  has_more: false,
};

const simulation = (overrides: Record<string, unknown> = {}) =>
  SaleSimulationSchema.parse({
    status: 'success',
    sale: {
      date: '2026-11-28',
      quantity_requested: '120',
      quantity_consumed: '120',
      quantity_locked: '0',
      price_per_unit: '200',
      currency: 'INR',
    },
    lots: [
      {
        fifo_position: 1,
        acquired_date: '2025-11-15',
        quantity: '100',
        gain_inr: '10000',
        is_long_term: false,
        long_term_from: '2026-11-16',
      },
      {
        fifo_position: 2,
        acquired_date: '2024-01-01',
        quantity: '20',
        gain_inr: '2000',
        is_long_term: true,
      },
    ],
    tax: { incremental_tax_inr: '2496.00' },
    ...overrides,
  });

const fillAndCheck = async () => {
  investing.getHoldings.mockResolvedValue(HOLDINGS as never);
  renderWith(<BeforeYouSell />);
  const select = await screen.findByTestId('tax-sell-holding');
  await waitFor(() => expect(within(select).getByText(/INFY/)).toBeInTheDocument());
  fireEvent.change(select, { target: { value: 'h-infy' } });
  fireEvent.change(screen.getByTestId('tax-sell-quantity'), { target: { value: '120' } });
  fireEvent.click(screen.getByTestId('tax-sell-check'));
};

describe('BeforeYouSell', () => {
  it('lists only holdings you still have', async () => {
    investing.getHoldings.mockResolvedValue(HOLDINGS as never);
    renderWith(<BeforeYouSell />);
    const select = await screen.findByTestId('tax-sell-holding');
    await waitFor(() => expect(within(select).getByText(/INFY/)).toBeInTheDocument());
    expect(within(select).queryByText(/GONE/)).not.toBeInTheDocument();
  });

  it('cannot be run without a holding and units', async () => {
    investing.getHoldings.mockResolvedValue(HOLDINGS as never);
    renderWith(<BeforeYouSell />);
    expect(await screen.findByTestId('tax-sell-check')).toBeDisabled();
    expect(investing.simulateSale).not.toHaveBeenCalled();
  });

  it('compares today with the day the last short-term lot turns long-term', async () => {
    investing.simulateSale.mockImplementation(async (req) =>
      req.sale_date ? simulation({ tax: { incremental_tax_inr: '1560.00' } }) : simulation(),
    );
    await fillAndCheck();

    expect(await screen.findByTestId('tax-sell-today')).toHaveTextContent('2,496.00');
    await waitFor(() => expect(screen.getByTestId('tax-sell-later')).toHaveTextContent('1,560.00'));
    expect(screen.getByTestId('tax-sell-saving')).toHaveTextContent('936.00');

    expect(investing.simulateSale).toHaveBeenCalledWith({
      holding_id: 'h-infy',
      quantity: '120',
    });
    expect(investing.simulateSale).toHaveBeenCalledWith({
      holding_id: 'h-infy',
      quantity: '120',
      sale_date: '2026-11-16',
    });
    const lots = screen.getByTestId('tax-sell-lots');
    expect(within(lots).getAllByRole('row')).toHaveLength(3); // header + 2 lots
  });

  it('does not ask for a later date when every lot is already long-term', async () => {
    investing.simulateSale.mockResolvedValue(
      simulation({
        lots: [{ fifo_position: 1, quantity: '120', is_long_term: true, gain_inr: '12000' }],
      }),
    );
    await fillAndCheck();

    expect(await screen.findByTestId('tax-sell-later')).toHaveTextContent('Already long-term');
    expect(investing.simulateSale).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('tax-sell-saving')).not.toBeInTheDocument();
  });

  it('says how many units are locked and until when', async () => {
    investing.simulateSale.mockResolvedValue(
      simulation({
        status: 'insufficient_quantity',
        sale: {
          date: '2026-11-28',
          quantity_requested: '120',
          quantity_consumed: '100',
          quantity_locked: '50',
          locked_until: '2029-06-10',
          price_per_unit: '80',
          currency: 'INR',
        },
        lots: [{ fifo_position: 1, quantity: '100', is_long_term: true, gain_inr: '-2000' }],
        tax: null,
      }),
    );
    await fillAndCheck();

    expect(await screen.findByTestId('tax-sell-locked')).toHaveTextContent('50 units locked until');
    expect(screen.getByTestId('tax-sell-result')).toHaveTextContent('more units than can be sold');
    expect(screen.getByTestId('tax-sell-today')).toHaveTextContent('—');
  });
});
