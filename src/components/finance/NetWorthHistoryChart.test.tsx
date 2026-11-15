import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetWorthHistoryChart } from './NetWorthHistoryChart';
import type { NetWorthHistoryItem } from '../../types/finance';

const profile = { locale: 'en-US', decimalPlaces: 2, currencyDisplay: 'symbol' as const };

const series = (n: number, overrides: Partial<NetWorthHistoryItem> = {}): NetWorthHistoryItem[] =>
  Array.from({ length: n }, (_, i) => ({
    snapshot_date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    reporting_currency: 'USD',
    holdings_value: String(1000 + i),
    investing_cash: '100',
    spending_cash: '200',
    total_net_worth: String(1300 + i),
    source: 'live',
    data_revised: false,
    ...overrides,
  }));

const dots = (container: HTMLElement) => container.querySelectorAll('svg circle').length;

describe('NetWorthHistoryChart', () => {
  it('marks every snapshot with a dot while the series is short', () => {
    const { container } = render(
      <NetWorthHistoryChart history={series(8)} currency="USD" displayProfile={profile} />,
    );
    expect(dots(container)).toBe(8);
  });

  it('drops the per-point dots on a dense series so the line stays a line', () => {
    // 120 daily snapshots drew 120 overlapping 4px dots: a beaded band, not a line.
    const { container } = render(
      <NetWorthHistoryChart history={series(31 + 20)} currency="USD" displayProfile={profile} />,
    );
    expect(dots(container)).toBe(0);
  });

  it('still marks user-provided and revised points on a dense series', () => {
    const history = series(60);
    history[10] = { ...history[10], source: 'user_provided' };
    history[20] = { ...history[20], data_revised: true };
    const { container } = render(
      <NetWorthHistoryChart history={history} currency="USD" displayProfile={profile} />,
    );
    expect(dots(container)).toBe(2);
  });

  it('shows the tooltip when a point is entered by pointer (touch drag)', () => {
    const { container } = render(
      <NetWorthHistoryChart history={series(8)} currency="USD" displayProfile={profile} />,
    );
    const bands = container.querySelectorAll('svg rect[fill="transparent"]');
    expect(bands.length).toBe(8);
    fireEvent.pointerEnter(bands[3]);
    expect(screen.getByText('Investing cash')).toBeInTheDocument();
  });
});
