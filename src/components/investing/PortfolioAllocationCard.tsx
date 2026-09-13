import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart } from 'lucide-react';
import { investingService } from '../../services/investing';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { toNumber } from '../../utils/numberFormat';
import type { AssetClassAllocationItem, SectorAllocationItem } from '../../types/investing';

const ALLOCATION_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#64748b', // slate
];

const DONUT_RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const GAP = 3;

interface PortfolioAllocationCardProps {
  asOf?: string;
  displayCurrency?: string;
  currencyDisplayPreference: 'symbol' | 'code';
}

const formatAssetClassName = (raw: string): string => {
  const map: Record<string, string> = {
    stock: 'Stocks & Equities',
    etf: 'ETFs & Funds',
    mutual_fund: 'Mutual Funds',
    crypto: 'Crypto & Digital Assets',
    bond: 'Bonds & Fixed Income',
    cash: 'Cash & Equivalents',
    commodity: 'Commodities',
    real_estate: 'Real Estate',
    other: 'Other Assets',
  };
  return map[raw.toLowerCase()] || raw.charAt(0).toUpperCase() + raw.slice(1);
};

export const PortfolioAllocationCard: React.FC<PortfolioAllocationCardProps> = ({
  asOf,
  displayCurrency = 'USD',
  currencyDisplayPreference,
}) => {
  const formatCurrency = useCurrencyFormatter();
  const [dimension, setDimension] = useState<'asset_class' | 'sector'>('asset_class');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['investing-allocation', asOf],
    queryFn: () => investingService.getAllocationAnalytics(asOf),
  });

  if (isLoading) {
    return (
      <div
        data-testid="portfolio-allocation-loading"
        className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 animate-pulse"
      >
        <div className="h-5 w-48 bg-slate-700/50 rounded mb-4" />
        <div className="h-44 bg-slate-700/30 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  const currency = data.currency || displayCurrency;
  const totalValue = toNumber(data.total_portfolio_value);
  const items: Array<{
    key: string;
    label: string;
    value: number;
    pct: number;
    count: number;
    color: string;
  }> = (dimension === 'asset_class' ? data.by_asset_class : data.by_sector).map(
    (item: AssetClassAllocationItem | SectorAllocationItem, idx: number) => {
      const isAssetClass = 'asset_class' in item;
      const rawKey = isAssetClass ? item.asset_class : item.sector;
      const label = isAssetClass ? formatAssetClassName(rawKey) : rawKey;
      const pct = toNumber(item.percentage);
      const val = toNumber(item.total_value);
      return {
        key: rawKey,
        label,
        value: val,
        pct,
        count: item.holdings_count,
        color: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length],
      };
    },
  );

  const hasHoldings = items.length > 0 && totalValue > 0;

  return (
    <div
      data-testid="portfolio-allocation-card"
      className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
            <PieChart className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Portfolio Allocation</h3>
            <p className="text-xs text-slate-400">
              Breakdown by {dimension === 'asset_class' ? 'asset class' : 'industry sector'}
            </p>
          </div>
        </div>

        {/* Dimension Switcher */}
        <div className="flex rounded-lg bg-slate-900/60 p-0.5 border border-slate-700/40">
          <button
            type="button"
            onClick={() => setDimension('asset_class')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              dimension === 'asset_class'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Asset Classes
          </button>
          <button
            type="button"
            onClick={() => setDimension('sector')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              dimension === 'sector'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sectors
          </button>
        </div>
      </div>

      {!hasHoldings ? (
        <div className="rounded-xl border border-slate-700/30 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
          No holdings recorded for {dimension === 'asset_class' ? 'asset class' : 'sector'} allocation.
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Donut Chart */}
          <div className="relative flex-shrink-0 h-44 w-44">
            <svg className="h-full w-full" viewBox="0 0 160 160">
              {(() => {
                let accumulatedPct = 0;
                return items.map((slice) => {
                  const slicePct = slice.pct / 100;
                  const dash = Math.max(
                    0,
                    slicePct * CIRCUMFERENCE - (items.length > 1 ? GAP : 0),
                  );
                  const offset = -(accumulatedPct * CIRCUMFERENCE);
                  accumulatedPct += slicePct;

                  return (
                    <circle
                      key={slice.key}
                      cx={80}
                      cy={80}
                      r={DONUT_RADIUS}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="16"
                      strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                      strokeDashoffset={offset}
                      transform="rotate(-90 80 80)"
                    >
                      <title>{`${slice.label}: ${slice.pct.toFixed(1)}%`}</title>
                    </circle>
                  );
                });
              })()}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Total Value
              </span>
              <span className="text-sm font-extrabold text-white text-center px-2 truncate max-w-[130px]">
                {formatCurrency(totalValue, currency, currencyDisplayPreference)}
              </span>
            </div>
          </div>

          {/* Allocation Breakdown Rows */}
          <div className="w-full flex-1 space-y-2">
            {items.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900/40 border border-slate-800/60 hover:border-slate-700/60 transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="truncate">
                    <span className="truncate font-medium text-slate-200">
                      {item.label}
                    </span>
                    <span className="ml-1.5 text-[11px] text-slate-500">
                      ({item.count} {item.count === 1 ? 'holding' : 'holdings'})
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <span className="font-semibold text-white">
                    {item.pct.toFixed(1)}%
                  </span>
                  <span className="ml-2 text-slate-400">
                    {formatCurrency(item.value, currency, currencyDisplayPreference)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
