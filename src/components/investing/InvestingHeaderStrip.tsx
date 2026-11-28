import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeService } from '../../services/finance';
import { queryKeys } from '../../lib/queryKeys';
import type { ChangePeriod } from '../../types/finance';
import type { InvestingSummary, PerformanceSummary } from '../../types/investing';
import { formatCurrency, toNumber, type NumericValue } from '../../utils/numberFormat';
import { formatPerformanceMetric, valuationLine } from '../../pages/investing/format';
import { valuationNote } from '../../utils/valuationWording';

const PERIODS: Array<{ value: ChangePeriod; label: string; words: string }> = [
  { value: 'day', label: 'Day', words: 'today' },
  { value: 'week', label: 'Week', words: 'this week' },
  { value: 'month', label: 'Month', words: 'this month' },
  { value: 'year', label: 'Year', words: 'this year' },
];

interface InvestingHeaderStripProps {
  summary: InvestingSummary | undefined;
  performance: PerformanceSummary | undefined;
  fallbackCurrency: string;
  currencyDisplayPreference: 'symbol' | 'code';
  locale: string;
  decimalPlaces: number;
}

const Tile: React.FC<{ label: string; testId?: string; children: React.ReactNode }> = ({
  label,
  testId,
  children,
}) => (
  <div className="min-w-0 rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3">
    <p className="text-xs text-slate-400">{label}</p>
    <div data-testid={testId} className="mt-1 break-words text-lg font-bold text-white sm:text-xl">
      {children}
    </div>
  </div>
);

/**
 * The Investments header strip (spec-113 §5.1): Value, Change over Day/Week/Month/Year, Gain since
 * bought and Cash to invest, plus one valuation badge. It replaces the five summary cards, the
 * collapsible detail block and the duplicated gain line.
 */
export const InvestingHeaderStrip: React.FC<InvestingHeaderStripProps> = ({
  summary,
  performance,
  fallbackCurrency,
  currencyDisplayPreference,
  locale,
  decimalPlaces,
}) => {
  const [period, setPeriod] = useState<ChangePeriod>('week');
  const change = useQuery({
    queryKey: queryKeys.finance.periodChange(period),
    queryFn: () => financeService.getPeriodChange(period),
  });

  const money = (value: NumericValue, currency: string) =>
    formatCurrency(value, currency, currencyDisplayPreference, locale, decimalPlaces);

  const needsConversion = summary?.valuation_status === 'multi_currency_unconverted';
  const valueText = needsConversion
    ? 'N/A'
    : performance
      ? money(performance.portfolio_value ?? performance.total_value, performance.currency)
      : summary?.portfolio_value != null
        ? money(summary.portfolio_value, summary.reporting_currency ?? fallbackCurrency)
        : 'N/A';

  const investments = change.data?.investments;
  const changeCurrency = change.data?.currency ?? performance?.currency ?? fallbackCurrency;
  const changeAmount = investments?.change;
  const complete = change.data?.status === 'complete';
  const words = PERIODS.find((p) => p.value === period)?.words ?? '';

  const badgeText = valuationLine({
    summaryStatus: summary?.valuation_status,
    performanceStatus: performance?.valuation_status,
    snapshotDate: performance?.snapshot_date,
  });
  const estimated =
    valuationNote(performance?.valuation_status, performance?.snapshot_date) != null;

  return (
    <section className="mb-6 space-y-3" data-testid="investing-header-strip">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Value" testId="investing-portfolio-value">
          {valueText}
        </Tile>

        <Tile label={`Change ${words}`}>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Period"
              className="inline-flex rounded-lg border border-slate-700 bg-slate-950/50 p-0.5"
            >
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  data-testid={`investing-period-${p.value}`}
                  aria-pressed={period === p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
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
          <div
            data-testid="investing-period-change"
            className={`mt-1 text-lg font-bold ${
              changeAmount != null && toNumber(changeAmount) < 0
                ? 'text-rose-300'
                : 'text-emerald-300'
            }`}
          >
            {change.isError
              ? '—'
              : changeAmount != null
                ? `${toNumber(changeAmount) > 0 ? '+' : ''}${money(changeAmount, changeCurrency)}`
                : '—'}
          </div>
          {complete && investments?.new_money != null && investments?.growth != null ? (
            <p
              className="mt-0.5 text-xs font-normal text-slate-400"
              data-testid="investing-period-split"
            >
              {money(investments.new_money, changeCurrency)} new money ·{' '}
              {money(investments.growth, changeCurrency)} growth
            </p>
          ) : null}
        </Tile>

        <Tile label="Gain since bought" testId="investing-total-gain-loss">
          {performance
            ? formatPerformanceMetric(
                performance.total_gain_loss,
                performance.total_gain_loss_pct,
                performance.currency,
                currencyDisplayPreference,
                locale,
                decimalPlaces,
              )
            : 'N/A'}
        </Tile>

        <Tile label="Cash to invest" testId="investing-cash-total">
          {performance?.cash_total != null
            ? money(performance.cash_total, performance.currency)
            : 'N/A'}
        </Tile>
      </div>

      <p
        data-testid="investing-valuation-line"
        className={`inline-block rounded-full border px-3 py-1 text-xs ${
          estimated
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : 'border-slate-700 bg-slate-900/50 text-slate-300'
        }`}
      >
        {badgeText}
      </p>
    </section>
  );
};
