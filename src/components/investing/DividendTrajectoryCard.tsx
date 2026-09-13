import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { investingService } from '../../services/investing';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { toNumber } from '../../utils/numberFormat';
import type { MonthlyDividendPoint } from '../../types/investing';

interface DividendTrajectoryCardProps {
  displayCurrency?: string;
  currencyDisplayPreference: 'symbol' | 'code';
}

const formatMonthLabel = (monthStr: string): string => {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

export const DividendTrajectoryCard: React.FC<DividendTrajectoryCardProps> = ({
  displayCurrency = 'USD',
  currencyDisplayPreference,
}) => {
  const formatCurrency = useCurrencyFormatter();
  const [hoveredPoint, setHoveredPoint] = useState<MonthlyDividendPoint | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['investing-dividend-history'],
    queryFn: () => investingService.getDividendHistory(),
  });

  if (isLoading) {
    return (
      <div
        data-testid="dividend-trajectory-loading"
        className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 animate-pulse"
      >
        <div className="h-5 w-48 bg-slate-700/50 rounded mb-4" />
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <div className="h-20 bg-slate-700/30 rounded-xl" />
          <div className="h-20 bg-slate-700/30 rounded-xl" />
          <div className="h-20 bg-slate-700/30 rounded-xl" />
        </div>
        <div className="h-44 bg-slate-700/20 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  const currency = data.currency || displayCurrency;
  const trailing12m = toNumber(data.trailing_12m_total);
  const allTime = toNumber(data.all_time_total);
  const avgMonthly12m = trailing12m / 12;
  const points = data.points ?? [];

  const maxNet = points.reduce((acc, pt) => Math.max(acc, toNumber(pt.net_amount)), 0);

  return (
    <div
      data-testid="dividend-trajectory-card"
      className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Dividend Income Trajectory</h3>
            <p className="text-xs text-slate-400">
              Monthly passive yield and long-term income velocity
            </p>
          </div>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Trailing 12-Month Yield</span>
            <Calendar className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold text-emerald-400">
            {formatCurrency(trailing12m, currency, currencyDisplayPreference)}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Past 12 active months</p>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Average Monthly Income</span>
            <DollarSign className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold text-white">
            {formatCurrency(avgMonthly12m, currency, currencyDisplayPreference)}
            <span className="text-xs font-normal text-slate-400"> / mo</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Based on trailing 12M</p>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cumulative All-Time</span>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold text-white">
            {formatCurrency(allTime, currency, currencyDisplayPreference)}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">All historical dividends</p>
        </div>
      </div>

      {/* Monthly Bar Chart */}
      {points.length === 0 ? (
        <div className="rounded-xl border border-slate-700/30 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
          No dividend payments recorded yet. Add dividend transactions to see your passive income growth trajectory.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Monthly Dividend History
            </span>
            {hoveredPoint ? (
              <span className="text-xs text-emerald-400 font-medium">
                {formatMonthLabel(hoveredPoint.month)}: {formatCurrency(toNumber(hoveredPoint.net_amount), currency, currencyDisplayPreference)} ({hoveredPoint.count} payout{hoveredPoint.count === 1 ? '' : 's'})
              </span>
            ) : (
              <span className="text-xs text-slate-500">Hover bar for details</span>
            )}
          </div>

          <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-1">
            {points.map((pt) => {
              const netVal = toNumber(pt.net_amount);
              const heightPct = maxNet > 0 ? Math.max(8, Math.min(100, (netVal / maxNet) * 100)) : 8;
              const isHovered = hoveredPoint?.month === pt.month;

              return (
                <div
                  key={pt.month}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <div className="w-full flex items-end justify-center h-full pb-1">
                    <div
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${
                        isHovered
                          ? 'bg-emerald-400 shadow-lg shadow-emerald-500/20'
                          : 'bg-emerald-500/80 hover:bg-emerald-400'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 truncate mt-1">
                    {formatMonthLabel(pt.month)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
