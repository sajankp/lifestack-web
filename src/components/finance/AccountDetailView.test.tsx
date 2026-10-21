import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { AccountDetailView } from './AccountDetailView';
import type { Account, ActivityFeedItem } from '../../types/finance';

// The daily-closing highlight (spec-011): the chronologically latest entry of
// each calendar day is that day's closing balance, so the user can match
// closing balances against a statement without doing the arithmetic.
//
// The activity feed is newest-first and paginated, so the entries are listed
// newest first here too.

vi.mock('../../hooks/useDisplayProfile', () => ({
  useDisplayProfile: () => ({
    currencyDisplay: 'symbol',
    locale: 'en-IN',
    decimalPlaces: 2,
  }),
}));

vi.mock('../../hooks/useEffectiveTimezone', () => ({
  useEffectiveTimezone: () => 'Asia/Kolkata',
}));

const account = {
  public_id: 'acc-1',
  name: 'Checking',
  account_type: 'bank',
  default_currency_code: 'INR',
} as unknown as Account;

const item = (over: Partial<ActivityFeedItem> & { id: string; date: string }): ActivityFeedItem =>
  ({
    event_type: 'spend',
    description: 'entry',
    amount: '-100.00',
    currency: 'INR',
    account_id: 'acc-1',
    account_name: 'Checking',
    account_type: 'bank',
    counterpart_account_id: null,
    counterpart_account_name: null,
    category_name: null,
    category_color: null,
    category_icon: null,
    symbol: null,
    order_type: null,
    quantity: null,
    price_per_unit: null,
    fx_rate: null,
    fx_display: null,
    income_type: null,
    source_ref: '',
    ...over,
  }) as ActivityFeedItem;

const renderView = (items: ActivityFeedItem[], offset = 0) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AccountDetailView
        account={account}
        currentBalance={1000}
        activityItems={items}
        total={items.length}
        limit={50}
        offset={offset}
        onBack={() => {}}
        onOpenTransfer={() => {}}
      />
    </QueryClientProvider>,
  );
};

const closingRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-daily-close="true"]')).map((el) =>
    el.getAttribute('data-entry-id'),
  );

describe('AccountDetailView daily closing highlight', () => {
  it('marks only the newest entry of a day as that day\'s close', () => {
    // Newest first: two entries on 2026-02-02, one on 2026-02-01.
    const { container } = renderView([
      item({ id: 'a', date: '2026-02-02T09:00:00Z', description: 'newest of day 2' }),
      item({ id: 'b', date: '2026-02-02T05:00:00Z', description: 'older of day 2' }),
      item({ id: 'c', date: '2026-02-01T10:00:00Z', description: 'only entry of day 1' }),
    ]);

    // 'a' is the newest of 2026-02-02, 'c' is the only entry of 2026-02-01.
    // 'b' is NOT the close of its day.
    expect(closingRows(container).sort()).toEqual(['a', 'c']);
  });

  it('shows a Daily close label so the meaning is not carried by colour alone', () => {
    renderView([
      item({ id: 'a', date: '2026-02-02T09:00:00Z' }),
      item({ id: 'b', date: '2026-02-01T10:00:00Z' }),
    ]);

    const labels = screen.getAllByText('Daily close');
    expect(labels).toHaveLength(2);
  });

  it('treats entries in different timezones by the user timezone', () => {
    // 2026-02-01T18:30Z is 2026-02-02 00:00 IST, so in Asia/Kolkata it is a
    // different calendar day from 2026-02-01T10:00Z.
    const { container } = renderView([
      item({ id: 'a', date: '2026-02-01T18:30:00Z' }),
      item({ id: 'b', date: '2026-02-01T10:00:00Z' }),
    ]);

    expect(closingRows(container).sort()).toEqual(['a', 'b']);
  });

  it('does not mark the first row of a page that starts mid-day', async () => {
    // Page 2 of the feed. The entry immediately preceding this page (newer,
    // fetched via the "preceding" query) is on the SAME day as this page's
    // first row, so that row is not the day's close.
    server.use(
      http.get('*/v1/finance/activity-feed', ({ request }) => {
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get('offset') ?? '0');
        if (offset === 0) {
          // The "preceding" query: the newest entry is on 2026-02-02.
          return HttpResponse.json({
            items: [item({ id: 'prev', date: '2026-02-02T09:00:00Z' })],
            total: 3,
            limit: 1,
            offset: 0,
          });
        }
        return HttpResponse.json({
          items: [
            item({ id: 'a', date: '2026-02-02T05:00:00Z' }),
            item({ id: 'b', date: '2026-02-01T10:00:00Z' }),
          ],
          total: 3,
          limit: 2,
          offset: 1,
        });
      }),
    );

    const { container } = renderView(
      [item({ id: 'a', date: '2026-02-02T05:00:00Z' }), item({ id: 'b', date: '2026-02-01T10:00:00Z' })],
      1,
    );

    // 'a' shares 2026-02-02 with the preceding newer entry, so it is not the
    // close of that day. 'b' is the only entry on 2026-02-01, so it is.
    await waitFor(() => {
      expect(closingRows(container)).toEqual(['b']);
    });
  });

  it('does not mark any row when the page is empty', () => {
    const { container } = renderView([]);
    expect(closingRows(container)).toEqual([]);
  });
});
