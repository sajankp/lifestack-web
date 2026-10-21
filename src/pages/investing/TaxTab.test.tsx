import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxTab } from './TaxTab';
import { investingService } from '../../services/investing';

vi.mock('../../services/investing', () => ({
  investingService: {
    getTaxSummary: vi.fn(),
    getTaxRegimes: vi.fn(),
  },
}));

const mockedInvesting = vi.mocked(investingService);

const REGIMES = [
  {
    key: 'foreign',
    label: 'Foreign / US listed (no STT)',
    description: 'Not on an Indian recognised stock exchange and no STT paid.',
    ltcg_holding_months: 24,
    stcg_section: '112(1)(a)(ii)',
    ltcg_section: '112(1)(c)',
    ltcg_rate_pct: '0.125',
    ltcg_exemption_inr: '0',
    stcg_is_flat: false,
    stcg_flat_rate_pct: null,
    cess_pct: '0.04',
  },
  {
    key: 'indian',
    label: 'Indian listed (STT paid)',
    description: 'Listed on an Indian recognised stock exchange with STT paid.',
    ltcg_holding_months: 12,
    stcg_section: '111A',
    ltcg_section: '112A',
    ltcg_rate_pct: '0.125',
    ltcg_exemption_inr: '125000',
    stcg_is_flat: true,
    stcg_flat_rate_pct: '0.20',
    cess_pct: '0.04',
  },
];

const SUMMARY = {
  status: 'success',
  fy_label: '2026-27',
  currency: 'INR',
  buckets: {
    'foreign:long_term': {
      regime: 'foreign',
      section: '112(1)(c)',
      rate_pct: '0.125',
      gain_native: '751.37',
      gain_inr: '71438.10',
      fees_native: '2.70',
      fees_inr: '257.63',
      exemption_applied: '0',
      tax: '9286.95',
      sell_count: 2,
      lot_count: 4,
    },
    'foreign:short_term': {
      regime: 'foreign',
      section: '112(1)(a)(ii)',
      rate_pct: '0',
      gain_native: '1097.55',
      gain_inr: '103894.25',
      fees_native: '8.76',
      fees_inr: '833.97',
      exemption_applied: '0',
      tax: '16207.50',
      sell_count: 4,
      lot_count: 8,
    },
  },
  total_gain_inr: '175332.35',
  total_tax_inr: '25494.45',
  effective_rate_pct: '14.54',
  slab: {
    rate_pct: '0.15',
    source: 'derived',
    tax_regime: 'new',
    surcharge_pct: '0',
    surcharge_source: 'derived',
    cess_pct: '0.04',
    rebate_amount: '0',
    total_income_considered: '1375332.35',
    marginal_relief_applied: true,
  },
  fx_rates: [
    {
      month: '2026-10',
      specified_date: '2026-09-30',
      currency: 'USD',
      rate: '95.42',
      source: 'manual',
      is_estimated: false,
    },
  ],
  positions: [
    {
      symbol: 'NVDA',
      account_name: 'IND Money',
      instrument_type: 'stock',
      currency: 'USD',
      quantity: '3.00000000',
      cost_per_unit: '15.506000',
      acquired_at: '2022-07-11T00:00:00+00:00',
      sold_at: '2026-10-16T00:00:00+00:00',
      long_term_mark_date: '2024-07-11T00:00:00+00:00',
      holding_months: 51,
      is_long_term: true,
      regime: 'foreign',
      classified_by: 'security_master',
      classification_detail: 'Reference security is listed in US.',
      gain_native: '602.47',
      gain_inr: '57474.72',
      fees_native: '1.96',
      sale_price_per_unit: '216.330000',
    },
  ],
  assumptions: ['Regime foreign applied to 5 of 7 sells.'],
  disclaimers: ['This is an estimate, not a filing-ready liability.'],
  reconciliation_failures: [],
  missing_fx_rates: [],
  message: null,
};

const renderTab = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TaxTab />
    </QueryClientProvider>,
  );
};

describe('TaxTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvesting.getTaxSummary.mockResolvedValue(SUMMARY);
    mockedInvesting.getTaxRegimes.mockResolvedValue(REGIMES);
  });

  it('renders the total estimated tax and gain', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('tax-total-tax')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tax-total-gain')).toBeInTheDocument();
    expect(screen.getByTestId('tax-effective-rate')).toHaveTextContent('14.54%');
  });

  it('renders a card per regime bucket', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('tax-bucket-foreign:long_term')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tax-bucket-foreign:short_term')).toBeInTheDocument();
  });

  it('shows the per-lot detail table with the regime and the holding period', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('tax-positions-table')).toBeInTheDocument();
    });
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('51 mo')).toBeInTheDocument();
    expect(screen.getByText('Long-term')).toBeInTheDocument();
  });

  it('renders the FX table and marks an estimated rate', async () => {
    mockedInvesting.getTaxSummary.mockResolvedValue({
      ...SUMMARY,
      fx_rates: [
        {
          month: '2026-10',
          specified_date: '2026-09-30',
          currency: 'USD',
          rate: '95.00',
          source: 'app_rate_estimate',
          is_estimated: true,
        },
      ],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('tax-fx-table')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tax-fx-estimated-2026-10')).toBeInTheDocument();
  });

  it('does not mark a manual FX rate as estimated', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('tax-fx-table')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('tax-fx-estimated-2026-10')).not.toBeInTheDocument();
  });

  it('shows the assumptions and the disclaimer', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('tax-disclaimers')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Regime foreign applied to 5 of 7 sells/),
    ).toBeInTheDocument();
  });

  it('explains the estimate with an information affordance', async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByLabelText('About this estimate')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('About the exchange rate')).toBeInTheDocument();
    expect(screen.getByLabelText('About the marginal rate')).toBeInTheDocument();
  });

  it('shows an empty state when the year has no sells', async () => {
    mockedInvesting.getTaxSummary.mockResolvedValue({
      ...SUMMARY,
      buckets: {},
      positions: [],
      total_gain_inr: '0',
      total_tax_inr: '0',
      effective_rate_pct: '0',
      slab: null,
      fx_rates: [],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('tax-empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText(/No capital gains recorded/)).toBeInTheDocument();
  });

  it('shows the missing FX rate state instead of a number', async () => {
    mockedInvesting.getTaxSummary.mockResolvedValue({
      ...SUMMARY,
      status: 'missing_fx_rate',
      message:
        'No Rule 115 exchange rate is available for: 2026-10 (USD). Supply the rate for those months to compute the tax estimate.',
      missing_fx_rates: [{ month: '2026-10', currency: 'USD' }],
      total_gain_inr: '0',
      total_tax_inr: '0',
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('investing-tax-missing-fx')).toBeInTheDocument();
    });
    expect(screen.getByText(/No Rule 115 exchange rate is available/)).toBeInTheDocument();
    // No tax figure may be shown — the gain could not be converted.
    expect(screen.queryByTestId('tax-total-tax')).not.toBeInTheDocument();
  });

  it('shows the reconciliation failure instead of a number', async () => {
    mockedInvesting.getTaxSummary.mockResolvedValue({
      ...SUMMARY,
      status: 'reconciliation_failed',
      message: 'FIFO replay does not reproduce the recorded gain for 1 of 7 sells.',
      reconciliation_failures: [
        {
          symbol: 'MU',
          public_id: 'abc-123',
          expected_gain: '667.31',
          computed_gain: '671.96',
          expected_cost: '225.15',
          computed_cost: '220.50',
        },
      ],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId('investing-tax-reconciliation-failed')).toBeInTheDocument();
    });
    expect(screen.getByText(/does not reproduce the recorded gain/)).toBeInTheDocument();
    expect(screen.queryByTestId('tax-total-tax')).not.toBeInTheDocument();
  });
});
