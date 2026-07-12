import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { investingService } from '../../services/investing';
import type { AccountReturnMetrics, PositionMetrics } from '../../types/investing';
import { formatCurrency, toNumber } from '../../utils/numberFormat';
import { useDisplayProfile } from '../../hooks/useDisplayProfile';
import { queryKeys } from '../../lib/queryKeys';

interface ReturnMetricsPanelProps {
  currencyDisplayPreference: 'symbol' | 'code';
}

function formatXirr(value: PositionMetrics['xirr'] | undefined): string {
  if (value == null) return 'N/A';
  return `${(toNumber(value) * 100).toFixed(1)}%`;
}

function formatHoldingPeriod(days: number | null | undefined): string {
  if (days == null) return '';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

const PositionBlock: React.FC<{
  title: string;
  metrics: PositionMetrics;
  annualizationReliable: boolean;
  holdingDays: number | null;
  currency: string;
  currencyDisplayPreference: 'symbol' | 'code';
  locale: string;
  decimalPlaces: number;
  showUnrealized: boolean;
}> = ({ title, metrics, annualizationReliable, holdingDays, currency, currencyDisplayPreference, locale, decimalPlaces, showUnrealized }) => (
  <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</p>
    <p className="mt-2 text-xl font-bold text-white">
      {annualizationReliable && metrics.annualized_return_pct != null
        ? `${toNumber(metrics.annualized_return_pct).toFixed(1)}% p.a.`
        : metrics.total_return_pct != null
          ? `${toNumber(metrics.total_return_pct).toFixed(1)}%${holdingDays != null ? ` · held ${formatHoldingPeriod(holdingDays)}` : ''}`
          : 'N/A'}
    </p>
    {/* XIRR is annualized by definition — suppressed for sub-year spans (INV-7). */}
    {annualizationReliable && (
      <p className="mt-1 text-xs text-slate-500">XIRR: {formatXirr(metrics.xirr)}</p>
    )}
    <div className="mt-3 space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-slate-400">Realized</span>
        <span className={toNumber(metrics.realized) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatCurrency(metrics.realized, currency, currencyDisplayPreference, locale, decimalPlaces)}
        </span>
      </div>
      {showUnrealized && (
        <div className="flex justify-between">
          <span className="text-slate-400">Unrealized</span>
          <span className={toNumber(metrics.unrealized) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {formatCurrency(metrics.unrealized, currency, currencyDisplayPreference, locale, decimalPlaces)}
          </span>
        </div>
      )}
    </div>
  </div>
);

export const ReturnMetricsPanel: React.FC<ReturnMetricsPanelProps> = ({
  currencyDisplayPreference,
}) => {
  const { locale, decimalPlaces } = useDisplayProfile();
  const [segment, setSegment] = useState<'open' | 'closed'>('open');

  const res = useQuery({
    queryKey: queryKeys.investing.performance.returns(),
    queryFn: () => investingService.getReturnMetrics(),
  });
  const data = res.data;

  if (res.isLoading || !data) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 animate-pulse h-40" />
    );
  }

  const currency = data.currency ?? 'USD';
  const overall = data.overall;
  const segmentMetrics = segment === 'open' ? overall.open : overall.closed;

  if (data.valuation_status === 'conversion_required') {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-300">
        Return metrics need a historical FX rate that isn't available yet for one or more
        currencies. Add it under Net Worth → Add historical data, or set a reporting currency.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Investment returns
          </h3>
          <p
            className="mt-1 text-2xl font-bold text-white"
            data-testid="investing-xirr-overall"
          >
            {overall.annualization_reliable && overall.annualized_return_pct != null
              ? `${toNumber(overall.annualized_return_pct).toFixed(1)}% p.a. (XIRR ${formatXirr(overall.xirr)})`
              : overall.total_return_pct != null
                ? // INV-7: under a year, show the simple total return with the
                  // holding period — never an annualized figure, XIRR included.
                  `${toNumber(overall.total_return_pct).toFixed(1)}%${overall.holding_days != null ? ` · held ${formatHoldingPeriod(overall.holding_days)}` : ''}`
                : 'N/A'}
          </p>
        </div>
        {overall.max_drawdown && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            <TrendingDown className="h-4 w-4" />
            Max drawdown {toNumber(overall.max_drawdown.pct).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${segment === 'open' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          onClick={() => setSegment('open')}
        >
          Current holdings
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm ${segment === 'closed' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          onClick={() => setSegment('closed')}
        >
          Exited positions
        </button>
      </div>

      {segment === 'open' && toNumber(segmentMetrics.invested) === 0 ? (
        <p className="text-sm text-slate-500">No open positions yet.</p>
      ) : segment === 'closed' && toNumber(segmentMetrics.invested) === 0 ? (
        <p className="text-sm text-slate-500">No exited positions yet.</p>
      ) : (
        <PositionBlock
          title={segment === 'open' ? 'Current holdings' : 'Exited positions'}
          metrics={segmentMetrics}
          annualizationReliable={segmentMetrics.annualization_reliable}
          holdingDays={segmentMetrics.holding_days}
          currency={currency}
          currencyDisplayPreference={currencyDisplayPreference}
          locale={locale}
          decimalPlaces={decimalPlaces}
          showUnrealized={segment === 'open'}
        />
      )}

      {data.by_account.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            By account
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.by_account.map((a: AccountReturnMetrics) => (
              <div
                key={a.account_id}
                className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-200">{a.account_name}</span>
                  <span className="flex items-center gap-1 text-sm text-emerald-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {a.annualization_reliable
                      ? formatXirr(a.xirr)
                      : a.total_return_pct != null
                        ? `${toNumber(a.total_return_pct).toFixed(1)}% · ${formatHoldingPeriod(a.holding_days)}`
                        : 'N/A'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Realized {formatCurrency(a.realized, a.currency, currencyDisplayPreference, locale, decimalPlaces)} ·
                  Unrealized {formatCurrency(a.unrealized, a.currency, currencyDisplayPreference, locale, decimalPlaces)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
