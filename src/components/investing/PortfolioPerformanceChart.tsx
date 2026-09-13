import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  DollarSign,
  LineChart as LineChartIcon,
  TrendingUp,
} from 'lucide-react';
import { investingService } from '../../services/investing';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { toNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';

type RangeOption = '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface PortfolioPerformanceChartProps {
  currencyDisplayPreference: 'symbol' | 'code';
}

export const PortfolioPerformanceChart: React.FC<PortfolioPerformanceChartProps> = ({
  currencyDisplayPreference,
}) => {
  const formatCurrency = useCurrencyFormatter();
  const [range, setRange] = useState<RangeOption>('6M');
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Compute start_date based on range
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    if (range === 'ALL') {
      return { startDate: undefined, endDate: end };
    }
    const d = new Date(today);
    if (range === '1M') d.setMonth(d.getMonth() - 1);
    else if (range === '3M') d.setMonth(d.getMonth() - 3);
    else if (range === '6M') d.setMonth(d.getMonth() - 6);
    else if (range === '1Y') d.setFullYear(d.getFullYear() - 1);

    return { startDate: d.toISOString().split('T')[0], endDate: end };
  }, [range]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['investing-performance-history', startDate, endDate],
    queryFn: () =>
      investingService.getPerformanceHistory({
        start_date: startDate,
        end_date: endDate,
      }),
  });

  const points = useMemo(() => {
    if (!data?.points) return [];
    return data.points.map((p) => ({
      date: p.snapshot_date,
      value: toNumber(p.total_value),
      cost: toNumber(p.total_cost || p.cost_basis),
      cash: toNumber(p.cash_value || p.cash_balance),
      gain: toNumber(p.unrealized_gain_loss || p.unrealized_gain),
      gainPct: toNumber(p.unrealized_gain_loss_pct ?? p.unrealized_gain_pct ?? 0),
      bmVal: p.benchmark_value != null ? toNumber(p.benchmark_value) : null,
      bmReturnPct: p.benchmark_return_pct != null ? toNumber(p.benchmark_return_pct) : null,
    }));
  }, [data?.points]);

  const currency = data?.currency || 'USD';
  const firstPoint = points.length > 0 ? points[0] : null;
  const latestPoint = points.length > 0 ? points[points.length - 1] : null;
  const computedChange =
    firstPoint && latestPoint ? latestPoint.value - firstPoint.value : 0;
  const computedChangePct =
    firstPoint && firstPoint.value > 0 ? (computedChange / firstPoint.value) * 100 : 0;
  const netChange = data?.net_change != null ? toNumber(data.net_change) : computedChange;
  const netChangePct =
    data?.net_change_pct != null ? toNumber(data.net_change_pct) : computedChangePct;

  const benchmarkSymbol = data?.benchmark_symbol || 'S&P 500 (SPY)';
  const alphaPct = data?.alpha_pct != null ? toNumber(data.alpha_pct) : null;
  const benchmarkReturnPct =
    data?.benchmark_return_pct != null ? toNumber(data.benchmark_return_pct) : null;

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : latestPoint;

  // Chart SVG layout calculations
  const width = 800;
  const height = 300;
  const paddingX = 60;
  const paddingY = 40;

  const chartMetrics = useMemo(() => {
    if (points.length < 2) return null;

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const p of points) {
      if (p.value < minVal) minVal = p.value;
      if (p.cost < minVal) minVal = p.cost;
      if (showBenchmark && p.bmVal != null && p.bmVal < minVal) minVal = p.bmVal;
      if (p.value > maxVal) maxVal = p.value;
      if (p.cost > maxVal) maxVal = p.cost;
      if (showBenchmark && p.bmVal != null && p.bmVal > maxVal) maxVal = p.bmVal;
    }

    // Add buffer
    const rangeVal = maxVal - minVal;
    const buffer = rangeVal > 0 ? rangeVal * 0.1 : maxVal * 0.1 || 100;
    minVal = Math.max(0, minVal - buffer);
    maxVal = maxVal + buffer;

    const getX = (index: number) =>
      paddingX + (index / (points.length - 1)) * (width - 2 * paddingX);

    const getY = (val: number) => {
      const denom = maxVal - minVal || 1;
      return height - paddingY - ((val - minVal) / denom) * (height - 2 * paddingY);
    };

    const valueCoords = points.map((p, i) => `${getX(i)},${getY(p.value)}`);
    const costCoords = points.map((p, i) => `${getX(i)},${getY(p.cost)}`);
    const bmCoords = points
      .filter((p) => p.bmVal != null)
      .map((p, i) => `${getX(i)},${getY(p.bmVal!)}`);

    const valuePath = `M ${valueCoords.join(' L ')}`;
    const costPath = `M ${costCoords.join(' L ')}`;
    const bmPath = bmCoords.length > 1 ? `M ${bmCoords.join(' L ')}` : null;

    // Closed area for Market Value gradient fill
    const firstX = getX(0);
    const lastX = getX(points.length - 1);
    const baselineY = height - paddingY;
    const valueArea = `M ${firstX},${baselineY} L ${valueCoords.join(' L ')} L ${lastX},${baselineY} Z`;

    return {
      minVal,
      maxVal,
      getX,
      getY,
      valuePath,
      costPath,
      bmPath,
      valueArea,
    };
  }, [points, showBenchmark]);

  return (
    <div
      data-testid="portfolio-performance-chart-card"
      className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10"
    >
      {/* Header & Range Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Portfolio Performance Over Time</h3>
            <p className="text-xs text-slate-400">
              Track market value growth relative to invested capital
            </p>
          </div>
        </div>

        {/* Range Pill Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/60 p-1">
          {(['1M', '3M', '6M', '1Y', 'ALL'] as RangeOption[]).map((opt) => (
            <button
              key={opt}
              type="button"
              data-testid={`perf-range-${opt}`}
              onClick={() => setRange(opt)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                range === opt
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Latest Market Value */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Portfolio Value</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold text-white">
            {activePoint
              ? formatCurrency(activePoint.value, currency, currencyDisplayPreference)
              : 'N/A'}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {activePoint?.date ? formatDate(`${activePoint.date}T00:00:00Z`) : 'Latest valuation'}
          </p>
        </div>

        {/* Invested Capital / Cost Basis */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Invested Capital</span>
            <span className="h-2 w-2 rounded-full bg-violet-400" />
          </div>
          <div className="mt-1.5 text-lg font-bold text-white">
            {activePoint
              ? formatCurrency(activePoint.cost, currency, currencyDisplayPreference)
              : 'N/A'}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Book value basis</p>
        </div>

        {/* Unrealized Gain */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Unrealized Return</span>
            {activePoint && activePoint.gain >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-400" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-rose-400" />
            )}
          </div>
          <div
            className={`mt-1.5 text-lg font-bold ${
              activePoint && activePoint.gain >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {activePoint
              ? `${activePoint.gain >= 0 ? '+' : ''}${formatCurrency(
                  activePoint.gain,
                  currency,
                  currencyDisplayPreference,
                )}`
              : 'N/A'}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {activePoint
              ? `${activePoint.gainPct >= 0 ? '+' : ''}${activePoint.gainPct.toFixed(2)}% gain`
              : 'Total paper return'}
          </p>
        </div>

        {/* Period Net Change */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Period Movement</span>
            <Calendar className="h-4 w-4 text-cyan-400" />
          </div>
          <div
            className={`mt-1.5 text-lg font-bold ${
              netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {netChange >= 0 ? '+' : ''}
            {formatCurrency(netChange, currency, currencyDisplayPreference)}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {netChangePct >= 0 ? '+' : ''}
            {netChangePct.toFixed(2)}% in selected {range}
          </p>
        </div>

        {/* Tier 3: Benchmark Alpha */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Alpha vs Index</span>
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
          </div>
          <div
            className={`mt-1.5 text-lg font-bold ${
              alphaPct != null && alphaPct >= 0
                ? 'text-emerald-400'
                : alphaPct != null
                ? 'text-amber-400'
                : 'text-slate-300'
            }`}
          >
            {alphaPct != null ? `${alphaPct >= 0 ? '+' : ''}${alphaPct.toFixed(2)}%` : 'Active'}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 truncate" title={`Benchmark: ${benchmarkSymbol}`}>
            {benchmarkReturnPct != null
              ? `vs ${benchmarkSymbol} (${benchmarkReturnPct >= 0 ? '+' : ''}${benchmarkReturnPct.toFixed(1)}%)`
              : `vs ${benchmarkSymbol}`}
          </p>
        </div>
      </div>

      {/* Chart Canvas Area */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-slate-700/30 bg-slate-900/20">
          <p className="text-sm text-slate-400 animate-pulse">Loading performance history...</p>
        </div>
      ) : isError ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-slate-700/30 bg-slate-900/20">
          <p className="text-sm text-slate-400">Failed to load performance time-series.</p>
        </div>
      ) : points.length < 2 || !chartMetrics ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/20 p-6 text-center">
          <LineChartIcon className="h-8 w-8 text-slate-500" />
          <p className="font-medium text-slate-300">Not enough history yet</p>
          <p className="max-w-md text-xs text-slate-500">
            Portfolio snapshots are recorded daily and whenever prices are refreshed. As snapshots
            accumulate over time, your interactive value curve vs cost basis will render here.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Legend with Benchmark Toggle */}
          <div className="mb-2 flex items-center justify-end gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-emerald-400" />
              <span className="text-slate-300 font-medium">Market Value</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-violet-400" />
              <span className="text-slate-400">Cost Basis</span>
            </div>
            <button
              type="button"
              onClick={() => setShowBenchmark(!showBenchmark)}
              className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-all ${
                showBenchmark
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
              title="Toggle benchmark reference curve"
            >
              <span className="h-0.5 w-4 border-t-2 border-dashed border-cyan-400" />
              <span>Benchmark ({benchmarkSymbol})</span>
            </button>
          </div>

          <div className="relative w-full overflow-x-auto">
            <svg
              className="w-full min-w-[600px]"
              viewBox={`0 0 ${width} ${height}`}
              onMouseLeave={() => setHoverIndex(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const svgX = ((e.clientX - rect.left) / rect.width) * width;
                // Find closest point
                let closestIdx = 0;
                let minDist = Infinity;
                points.forEach((_, idx) => {
                  const x = chartMetrics.getX(idx);
                  const dist = Math.abs(x - svgX);
                  if (dist < minDist) {
                    minDist = dist;
                    closestIdx = idx;
                  }
                });
                setHoverIndex(closestIdx);
              }}
            >
              <defs>
                <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {[0, 0.5, 1].map((ratio) => {
                const val =
                  chartMetrics.minVal + ratio * (chartMetrics.maxVal - chartMetrics.minVal);
                const y = chartMetrics.getY(val);
                return (
                  <g key={ratio}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={width - paddingX}
                      y2={y}
                      stroke="#334155"
                      strokeDasharray="3 3"
                      strokeOpacity={0.6}
                    />
                    <text
                      x={paddingX - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[10px] fill-slate-500 font-medium"
                    >
                      {formatCurrency(val, currency, 'code')}
                    </text>
                  </g>
                );
              })}

              {/* Area fill under Market Value */}
              <path d={chartMetrics.valueArea} fill="url(#valueGrad)" />

              {/* Benchmark Reference Line (Dashed Cyan) */}
              {showBenchmark && chartMetrics.bmPath && (
                <path
                  d={chartMetrics.bmPath}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth={1.75}
                  strokeDasharray="4 4"
                  strokeOpacity={0.8}
                />
              )}

              {/* Cost Basis Line (Dashed Violet) */}
              <path
                d={chartMetrics.costPath}
                fill="none"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="4 4"
              />

              {/* Market Value Line (Solid Emerald) */}
              <path
                d={chartMetrics.valuePath}
                fill="none"
                stroke="#10b981"
                strokeWidth={2.5}
              />

              {/* Date ticks on X-axis */}
              {(() => {
                const tickIndices = Array.from(
                  new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
                );
                return tickIndices.map((idx) => {
                  const p = points[idx];
                  if (!p) return null;
                  return (
                    <text
                      key={idx}
                      x={chartMetrics.getX(idx)}
                      y={height - paddingY + 18}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-500"
                    >
                      {formatDate(`${p.date}T00:00:00Z`)}
                    </text>
                  );
                });
              })()}

              {/* Hover Indicator Crosshair */}
              {hoverIndex !== null && points[hoverIndex] && (
                <g>
                  {/* Vertical hairline */}
                  <line
                    x1={chartMetrics.getX(hoverIndex)}
                    y1={paddingY}
                    x2={chartMetrics.getX(hoverIndex)}
                    y2={height - paddingY}
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />

                  {/* Market Value Dot */}
                  <circle
                    cx={chartMetrics.getX(hoverIndex)}
                    cy={chartMetrics.getY(points[hoverIndex].value)}
                    r={5}
                    className="fill-emerald-400 stroke-slate-900 stroke-2"
                  />

                  {/* Cost Basis Dot */}
                  <circle
                    cx={chartMetrics.getX(hoverIndex)}
                    cy={chartMetrics.getY(points[hoverIndex].cost)}
                    r={4}
                    className="fill-violet-400 stroke-slate-900 stroke-2"
                  />

                  {/* Benchmark Dot */}
                  {showBenchmark && points[hoverIndex].bmVal != null && (
                    <circle
                      cx={chartMetrics.getX(hoverIndex)}
                      cy={chartMetrics.getY(points[hoverIndex].bmVal!)}
                      r={3.5}
                      className="fill-cyan-400 stroke-slate-900 stroke-2"
                    />
                  )}
                </g>
              )}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
