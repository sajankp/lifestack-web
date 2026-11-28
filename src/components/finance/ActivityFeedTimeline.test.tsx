import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityFeedTimeline } from './ActivityFeedTimeline';
import type { ActivityFeedItem } from '../../types/finance';

// spec-113 §2.2: one row per transfer ("Wallet → Brokerage", one amount, or both when the currencies
// differ) and plain-English trade rows ("Bought 6 VTI @ $265.00").

vi.mock('../../hooks/useDisplayProfile', () => ({
  useDisplayProfile: () => ({
    currencyDisplay: 'symbol',
    locale: 'en-IN',
    decimalPlaces: 2,
  }),
}));

const item = (over: Partial<ActivityFeedItem> & { id: string }): ActivityFeedItem =>
  ({
    event_type: 'spend',
    date: '2026-07-02T10:00:00Z',
    description: 'entry',
    amount: '-100.00',
    currency: 'INR',
    account_id: 'acc-1',
    account_name: 'Wallet',
    account_type: 'wallet',
    counterpart_account_id: null,
    counterpart_account_name: null,
    category_name: null,
    category_color: null,
    category_icon: null,
    symbol: null,
    order_type: null,
    quantity: null,
    price_per_unit: null,
    amount_in: null,
    currency_in: null,
    fx_rate: null,
    fx_display: null,
    income_type: null,
    source_ref: '',
    ...over,
  }) as ActivityFeedItem;

const oneRowTransfer = (over: Partial<ActivityFeedItem> = {}) =>
  item({
    id: 'tf-row',
    event_type: 'transfer',
    description: 'Wallet → Brokerage',
    amount: '-5000.00',
    currency: 'INR',
    amount_in: '+5000.00',
    currency_in: 'INR',
    account_name: 'Wallet',
    counterpart_account_id: 'acc-2',
    counterpart_account_name: 'Brokerage',
    source_ref: 'tf-public-id',
    ...over,
  });

const renderTimeline = (
  items: ActivityFeedItem[],
  props: Partial<React.ComponentProps<typeof ActivityFeedTimeline>> = {},
) =>
  render(
    <ActivityFeedTimeline
      items={items}
      total={items.length}
      limit={50}
      offset={0}
      onPageChange={() => {}}
      accounts={[]}
      {...props}
    />,
  );

const row = (id: string) => screen.getByTestId(`activity-row-${id}`);

describe('ActivityFeedTimeline transfer rows (one row per transfer)', () => {
  it('shows "From → To" once, a Transfer badge and a single amount', () => {
    renderTimeline([oneRowTransfer()]);

    const r = row('tf-row');
    expect(within(r).getAllByText('Wallet → Brokerage')).toHaveLength(1);
    expect(within(r).getByText('Transfer')).toBeInTheDocument();
    expect(within(r).queryByText(/Transfer (In|Out)/)).not.toBeInTheDocument();
    expect(within(r).getByTestId('activity-amount')).toHaveTextContent('₹5,000.00');
    expect(within(r).getByTestId('activity-amount')).not.toHaveTextContent('→');
    expect(within(r).getByTestId('activity-amount')).not.toHaveTextContent('-');
  });

  it('shows the sent amount when only a fee separates the two sides in one currency', () => {
    renderTimeline([oneRowTransfer({ amount_in: '+4990.00' })]);

    const amount = within(row('tf-row')).getByTestId('activity-amount');
    expect(amount).toHaveTextContent('₹5,000.00');
    expect(amount).not.toHaveTextContent('4,990');
  });

  it('shows both amounts when the currencies differ', () => {
    renderTimeline([
      oneRowTransfer({
        description: 'US Broker → Wallet',
        account_name: 'US Broker',
        counterpart_account_name: 'Wallet',
        amount: '-100.00',
        currency: 'USD',
        amount_in: '+9500.00',
        currency_in: 'INR',
        fx_display: '95.0000 INR/USD',
      }),
    ]);

    const r = row('tf-row');
    expect(within(r).getByTestId('activity-amount')).toHaveTextContent('$100.00 → ₹9,500.00');
    expect(within(r).getByText('95.0000 INR/USD')).toBeInTheDocument();
  });

  it('keeps the signed one-sided rows of a single-account feed', () => {
    renderTimeline(
      [
        item({
          id: 'out',
          event_type: 'transfer',
          description: 'Transfer to Brokerage',
          amount: '-5000.00',
          counterpart_account_name: 'Brokerage',
          source_ref: 'tf-1',
        }),
        item({
          id: 'in',
          event_type: 'transfer',
          description: 'Transfer from Wallet',
          amount: '+5000.00',
          account_name: 'Brokerage',
          counterpart_account_name: 'Wallet',
          source_ref: 'tf-1',
        }),
      ],
      { selectedAccountId: 'acc-1' },
    );

    expect(within(row('out')).getByText('Transfer Out')).toBeInTheDocument();
    expect(within(row('in')).getByText('Transfer In')).toBeInTheDocument();
    expect(within(row('in')).getByTestId('activity-amount')).toHaveTextContent('+₹5,000.00');
  });

  it('hands the real transfer id (source_ref) to the delete handler', async () => {
    const onDeleteItem = vi.fn();
    renderTimeline([oneRowTransfer()], { onDeleteItem, onEditItem: () => {} });

    await userEvent.click(within(row('tf-row')).getByLabelText('Delete transfer'));

    expect(onDeleteItem).toHaveBeenCalledTimes(1);
    expect(onDeleteItem.mock.calls[0][0]).toMatchObject({
      event_type: 'transfer',
      source_ref: 'tf-public-id',
    });
  });

  it('finds a one-row transfer by either account name', () => {
    renderTimeline([oneRowTransfer()], { searchQuery: 'brokerage', onSearchChange: () => {} });
    expect(row('tf-row')).toBeInTheDocument();
  });
});

describe('ActivityFeedTimeline trade rows (plain words)', () => {
  const order = (over: Partial<ActivityFeedItem>) =>
    item({
      id: 'ord',
      event_type: 'order',
      account_name: 'US Broker',
      account_type: 'brokerage',
      currency: 'USD',
      symbol: 'VTI',
      ...over,
    });

  it('writes a buy as "Bought 6 VTI @ $265.00"', () => {
    renderTimeline([
      order({
        description: 'BUY VTI (6.00000000 @ 265.000000)',
        order_type: 'buy',
        quantity: '6.00000000',
        price_per_unit: '265.000000',
        amount: '-1590.00',
      }),
    ]);

    expect(within(row('ord')).getByText('Bought 6 VTI @ $265.00')).toBeInTheDocument();
    expect(screen.queryByText(/6\.00000000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/265\.000000/)).not.toBeInTheDocument();
  });

  it('writes a sell with a fractional quantity and trims only trailing zeros', () => {
    renderTimeline([
      order({
        description: 'SELL VTI (2.50000000 @ 270.500000)',
        order_type: 'sell',
        quantity: '2.50000000',
        price_per_unit: '270.500000',
        amount: '+676.25',
      }),
    ]);

    expect(within(row('ord')).getByText('Sold 2.5 VTI @ $270.50')).toBeInTheDocument();
  });

  it('formats the price in the account currency', () => {
    renderTimeline([
      order({
        description: 'BUY INFY (10.00000000 @ 1500.000000)',
        symbol: 'INFY',
        currency: 'INR',
        order_type: 'buy',
        quantity: '10.00000000',
        price_per_unit: '1500.000000',
        amount: '-15000.00',
      }),
    ]);

    expect(within(row('ord')).getByText('Bought 10 INFY @ ₹1,500.00')).toBeInTheDocument();
  });

  it('falls back to the server description when the order details are missing', () => {
    renderTimeline([order({ description: 'BUY VTI (? @ ?)', order_type: 'buy' })]);

    expect(within(row('ord')).getByText('BUY VTI (? @ ?)')).toBeInTheDocument();
  });
});
