import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { financeService } from '../../services/finance';
import { queryKeys } from '../../lib/queryKeys';
import { formatCurrency, toNumber, type NumericValue } from '../../utils/numberFormat';
import { valuationNote } from '../../utils/valuationWording';
import type { ChangePeriod } from '../../types/finance';

// spec-113 §3.1. Net worth with a Day · Week · Month switch (default Week), the change over it, and
// on Week / Month how much of that was saved vs. markets & other. Under it an Investments line.
// A split the API could not compute is simply left out: totals only, with a small note.

type SwitchPeriod = Extract<ChangePeriod, 'day' | 'week' | 'month'>;

const PERIODS: Array<{ value: SwitchPeriod; label: string; words: string }> = [
  { value: 'day', label: 'Day', words: 'today' },
  { value: 'week', label: 'Week', words: 'this week' },
  { value: 'month', label: 'Month', words: 'this month' },
];

interface NetWorthSectionProps {
  fallbackCurrency: string;
  currencyDisplay: 'symbol' | 'code';
  locale: string;
  decimalPlaces: number;
  /**
   * Holdings plus investing cash from the dashboard summary: the same measure the period change
   * reports, used when the period has no value of its own, so the number keeps its meaning when
   * the period changes.
   */
  investmentsValue: NumericValue;
  valuationStatus: string;
  snapshotDate: string | null;
}

export const NetWorthSection: React.FC<NetWorthSectionProps> = ({
  fallbackCurrency,
  currencyDisplay,
  locale,
  decimalPlaces,
  investmentsValue,
  valuationStatus,
  snapshotDate,
}) => {
  const [searchParams] = useSearchParams();
  const requestedPeriod = searchParams.get('period');
  const initialPeriod: SwitchPeriod =
    requestedPeriod === 'day' || requestedPeriod === 'month' ? requestedPeriod : 'week';
  const [period, setPeriod] = useState<SwitchPeriod>(initialPeriod);
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.finance.periodChange(period),
    queryFn: () => financeService.getPeriodChange(period),
  });

  const words = PERIODS.find((p) => p.value === period)?.words ?? '';
  const currency = data?.currency ?? fallbackCurrency;
  const money = (value: NumericValue) =>
    formatCurrency(value, currency, currencyDisplay, locale, decimalPlaces);

  const changeText = (change: NumericValue): string => {
    const n = toNumber(change);
    if (n > 0) return `Up ${money(n)} ${words}`;
    if (n < 0) return `Down ${money(Math.abs(n))} ${words}`;
    return `No change ${words}`;
  };

  const netWorth = data?.net_worth;
  const investments = data?.investments;
  const complete = data?.status === 'complete';
  const showNetWorthSplit =
    period !== 'day' && complete && netWorth?.saved != null && netWorth?.markets_and_other != null;
  const showInvestmentSplit =
    complete && investments?.new_money != null && investments?.growth != null;
  const investmentValue = investments?.end ?? investmentsValue;
  const note = valuationNote(valuationStatus, snapshotDate);

  return (
    <section
      data-testid="today-net-worth"
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-black/10 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Net worth</h2>
        <div
          role="group"
          aria-label="Period"
          className="inline-flex rounded-xl border border-slate-700 bg-slate-950/50 p-0.5"
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              data-testid={`today-period-${p.value}`}
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                period === p.value
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <p data-testid="today-net-worth-error" className="mt-4 text-sm text-rose-300">
          Couldn&apos;t load your net worth change. Try refreshing.
        </p>
      ) : isLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-800" />
          <div className="h-4 w-64 animate-pulse rounded bg-slate-800" />
        </div>
      ) : (
        <>
          <p
            data-testid="today-net-worth-value"
            className="mt-3 break-words text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            {netWorth?.end != null ? money(netWorth.end) : '—'}
          </p>
          {netWorth?.change != null ? (
            <p
              data-testid="today-net-worth-change"
              className={`mt-1 text-sm font-medium ${
                toNumber(netWorth.change) < 0 ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {changeText(netWorth.change)}
            </p>
          ) : null}
          {showNetWorthSplit ? (
            <p data-testid="today-net-worth-split" className="mt-0.5 text-sm text-slate-400">
              {money(netWorth!.saved)} saved · {money(netWorth!.markets_and_other)} markets &amp;
              other
            </p>
          ) : null}
          {data?.status === 'partial' ? (
            <p data-testid="today-period-note" className="mt-2 text-xs text-slate-500">
              Showing totals only: there isn&apos;t enough history to split this period.
            </p>
          ) : null}
          {data?.status === 'unavailable' ? (
            <p data-testid="today-period-note" className="mt-2 text-xs text-slate-500">
              Not enough history yet to show a change.
            </p>
          ) : null}
        </>
      )}

      <Link
        to="/investing"
        data-testid="dashboard-portfolio-value"
        className="mt-4 block rounded-2xl border border-slate-800 bg-slate-950/40 p-3 transition hover:border-slate-600"
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-sm text-slate-400">Investments</span>
          <span className="font-semibold text-white">
            {investmentValue != null ? money(investmentValue) : '—'}
          </span>
        </span>
        {investments?.change != null ? (
          <span className="mt-0.5 block text-sm text-slate-300">
            {changeText(investments.change)}
            {showInvestmentSplit ? (
              <span className="text-slate-400">
                {' '}
                · {money(investments.new_money)} new money · {money(investments.growth)} growth
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>
      {note ? (
        <p data-testid="today-valuation-note" className="mt-2 text-xs text-slate-500">
          {note}
        </p>
      ) : null}
    </section>
  );
};
