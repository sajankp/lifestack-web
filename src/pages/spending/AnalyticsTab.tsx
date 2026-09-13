import React, { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BarChart2, PieChart, PiggyBank, Percent, Tag, TrendingUp } from 'lucide-react';
import { DropdownSelect, type DropdownOption } from '../../components/DropdownSelect';
import { spendingService } from '../../services/spending';
import { useCurrencyFormatter, useDisplayProfile } from '../../hooks/useDisplayProfile';
import { formatCompactNumber } from '../../utils/numberFormat';
import { formatMonthLabel, monthShortLabel } from './format';
import { SpendPacingCard } from './SpendPacingCard';


const DONUT_COLORS = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
];
const DONUT_OTHER_COLOR = '#64748b';

const niceCeil = (value: number): number => {
  if (value <= 0) return 100;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);

  let niceFraction = 10;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;

  return niceFraction * Math.pow(10, exponent);
};

// Generates a smooth cubic Bezier path for SVG line charts
function generateSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

interface AnalyticsTabProps {
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  monthOptions: readonly DropdownOption[];
  displayCurrency: string;
  currencyDisplayPreference: 'symbol' | 'code';
}

const AnalyticsTabImpl: React.FC<AnalyticsTabProps> = ({
  selectedMonth,
  onMonthChange,
  monthOptions,
  displayCurrency,
  currencyDisplayPreference,
}) => {
  const formatCurrency = useCurrencyFormatter();
  const displayProfile = useDisplayProfile();
  const formatTrendTick = (value: number) => formatCompactNumber(value, displayProfile.locale);
  const [rangeMonths, setRangeMonths] = useState(6);
  const [breakdownType, setBreakdownType] = useState<'income' | 'expense'>('expense');

  // Interactive Hover States
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredSavingsIdx, setHoveredSavingsIdx] = useState<number | null>(null);
  const [hoveredCategoryIdx, setHoveredCategoryIdx] = useState<number | null>(null);

  // Calculate the dates range for queries
  const analyticsRange = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) {
      return { fromMonth: selectedMonth, toMonth: selectedMonth, fromDate: '', toDate: '' };
    }
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    // Calculate starting month of range
    const startMonthDate = new Date(Date.UTC(year, month - 1 - (rangeMonths - 1), 1));
    const fromMonthVal = `${startMonthDate.getUTCFullYear()}-${String(
      startMonthDate.getUTCMonth() + 1,
    ).padStart(2, '0')}`;

    const endMonthDate = new Date(Date.UTC(year, month - 1, 1));
    const toMonthVal = `${endMonthDate.getUTCFullYear()}-${String(
      endMonthDate.getUTCMonth() + 1,
    ).padStart(2, '0')}`;

    const fromDate = `${fromMonthVal}-01`;
    // Last day of the selected month
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const toDate = `${toMonthVal}-${String(lastDay).padStart(2, '0')}`;

    return {
      fromMonth: fromMonthVal,
      toMonth: toMonthVal,
      fromDate,
      toDate,
    };
  }, [selectedMonth, rangeMonths]);

  // Queries
  const { data: trendsData, isLoading: isTrendsLoading } = useQuery({
    queryKey: ['spending-trends', analyticsRange.fromMonth, analyticsRange.toMonth],
    queryFn: () => spendingService.getTrends(analyticsRange.fromMonth, analyticsRange.toMonth),
    enabled: !!analyticsRange.fromMonth,
  });

  const { data: breakdownData, isLoading: isBreakdownLoading } = useQuery({
    queryKey: ['spending-breakdown', analyticsRange.fromDate, analyticsRange.toDate, breakdownType],
    queryFn: () =>
      spendingService.getCategoryBreakdown(
        analyticsRange.fromDate,
        analyticsRange.toDate,
        breakdownType,
      ),
    enabled: !!analyticsRange.fromDate,
    placeholderData: keepPreviousData,
  });

  const { data: tagBreakdownData } = useQuery({
    queryKey: [
      'spending-tag-breakdown',
      analyticsRange.fromDate,
      analyticsRange.toDate,
      breakdownType,
    ],
    queryFn: () =>
      spendingService.getTagBreakdown(
        analyticsRange.fromDate,
        analyticsRange.toDate,
        breakdownType,
      ),
    enabled: !!analyticsRange.fromDate,
    placeholderData: keepPreviousData,
  });

  const { data: savingsRateData, isLoading: isSavingsRateLoading } = useQuery({
    queryKey: ['spending-savings-rate', analyticsRange.fromMonth, analyticsRange.toMonth],
    queryFn: () => spendingService.getSavingsRate(analyticsRange.fromMonth, analyticsRange.toMonth),
    enabled: !!analyticsRange.fromMonth,
  });

  const isInitialAnalyticsLoad =
    (isTrendsLoading && !trendsData) ||
    (isBreakdownLoading && !breakdownData) ||
    (isSavingsRateLoading && !savingsRateData);

  if (isInitialAnalyticsLoad) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl border border-slate-800 bg-slate-800/30"
            />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-80 rounded-2xl border border-slate-800 bg-slate-800/30" />
          <div className="h-80 rounded-2xl border border-slate-800 bg-slate-800/30" />
        </div>
      </div>
    );
  }

  // Short month names (Jan, Feb, ...) for chart x-axis labels.
  const formatMonthShort = (monthStr: string) =>
    /^\d{4}-\d{2}$/.test(monthStr) ? monthShortLabel(monthStr) : monthStr;

  // Period stats summary
  const totalIncome = savingsRateData?.period_totals?.total_income ?? 0;
  const totalExpense = savingsRateData?.period_totals?.total_expense ?? 0;
  const totalSavings = savingsRateData?.period_totals?.total_savings ?? 0;
  const averageSavingsRate = savingsRateData?.period_totals?.average_savings_rate_pct ?? null;

  // --- 1. Trends Bar Chart Setup ---
  const trendsList = trendsData?.months ?? [];
  const maxTrendVal = niceCeil(
    Math.max(...trendsList.flatMap((m) => [Number(m.total_income), Number(m.total_expense)]), 100),
  );

  // --- 2. Savings Rate Area Chart Setup ---
  const savingsRateList = (savingsRateData?.months ?? []).filter((m) => m.savings_rate_pct != null);
  const rates = savingsRateList.map((m) => Number(m.savings_rate_pct));
  const minRate = Math.min(...rates, 0);
  const maxRate = Math.max(...rates, 100);
  const rateRange = maxRate - minRate || 100;

  // --- 3. Category Breakdown donut calculation ---
  const breakdownCategories = breakdownData?.categories ?? [];
  const otherItem = breakdownData?.other;
  const donutItems = [...breakdownCategories];
  if (otherItem) {
    donutItems.push({
      category_id: 'other',
      category_name: 'Other Categories',
      amount: otherItem.amount,
      pct_of_total: otherItem.pct_of_total,
      transaction_count: 0,
    });
  }
  const tagBreakdownItems = tagBreakdownData?.tags ?? [];

  const activeCategory = hoveredCategoryIdx !== null ? donutItems[hoveredCategoryIdx] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Analytics Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 shadow-lg shadow-black/10">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Reporting Period
          </label>
          <div className="min-w-[220px] max-w-[260px]">
            <DropdownSelect
              testId="spending-analytics-month"
              value={selectedMonth}
              onChange={onMonthChange}
              options={monthOptions}
              placeholder="Select month"
            />
          </div>
          <p className="text-xs text-slate-400">
            {rangeMonths === 1
              ? `Showing single month (${formatMonthLabel(selectedMonth)})`
              : `Comparing ${rangeMonths}-month trend ending in ${formatMonthLabel(selectedMonth)}`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Horizon
          </span>
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-slate-800">
            {[1, 3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setRangeMonths(m)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  rangeMonths === m
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                {m === 1 ? '1M' : `${m}M`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Spend Pacing Card */}
      <SpendPacingCard
        selectedMonth={selectedMonth}
        displayCurrency={displayCurrency}
        currencyDisplayPreference={currencyDisplayPreference}
      />

      {/* Period Stats Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card: Total Income */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10 transition-all hover:border-slate-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Period Income
              </p>
              <h3 className="mt-2 text-2xl font-bold text-white tracking-tight">
                {formatCurrency(Number(totalIncome), displayCurrency, currencyDisplayPreference)}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">Total inflows in period</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400 ring-1 ring-emerald-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Card: Total Expenses */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10 transition-all hover:border-slate-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Period Expenses
              </p>
              <h3 className="mt-2 text-2xl font-bold text-rose-400 tracking-tight">
                {formatCurrency(Number(totalExpense), displayCurrency, currencyDisplayPreference)}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">Total outflows in period</p>
            </div>
            <div className="rounded-xl bg-rose-500/10 p-2.5 text-rose-400 ring-1 ring-rose-500/20">
              <TrendingUp className="h-5 w-5 rotate-180" />
            </div>
          </div>
        </div>

        {/* Card: Period Savings */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10 transition-all hover:border-slate-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Net Savings
              </p>
              <h3
                className={`mt-2 text-2xl font-bold tracking-tight ${
                  Number(totalSavings) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatCurrency(Number(totalSavings), displayCurrency, currencyDisplayPreference)}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">Inflows minus expenses</p>
            </div>
            <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400 ring-1 ring-cyan-500/20">
              <PiggyBank className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Card: Savings Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10 transition-all hover:border-slate-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Avg Savings Rate
              </p>
              <h3 className="mt-2 text-2xl font-bold text-white tracking-tight">
                {averageSavingsRate !== null ? `${Number(averageSavingsRate).toFixed(1)}%` : 'N/A'}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                {averageSavingsRate !== null && Number(averageSavingsRate) >= 20
                  ? 'Strong surplus velocity'
                  : 'Tight discretionary gap'}
              </p>
            </div>
            <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-400 ring-1 ring-violet-500/20">
              <Percent className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trends Chart */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <BarChart2 className="h-4 w-4 text-cyan-400" />
              Income vs Expenses Trend
            </h4>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-tr from-cyan-600 to-cyan-400" />
                Income
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-tr from-rose-600 to-rose-400" />
                Expenses
              </div>
            </div>
          </div>

          {trendsList.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No trend data available for the period
            </div>
          ) : (
            <div className="relative h-64 w-full">
              {/* Dynamic Floating Tooltip on Hover */}
              {hoveredTrendIdx !== null && trendsList[hoveredTrendIdx] && (
                <div className="absolute top-2 right-2 z-10 rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <p className="font-semibold text-white border-b border-slate-800 pb-1">
                    {formatMonthLabel(trendsList[hoveredTrendIdx].month)}
                  </p>
                  <div className="flex items-center justify-between gap-4 text-cyan-400 font-medium pt-0.5">
                    <span>Income:</span>
                    <span>
                      {formatCurrency(
                        Number(trendsList[hoveredTrendIdx].total_income),
                        displayCurrency,
                        currencyDisplayPreference,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-rose-400 font-medium">
                    <span>Expense:</span>
                    <span>
                      {formatCurrency(
                        Number(trendsList[hoveredTrendIdx].total_expense),
                        displayCurrency,
                        currencyDisplayPreference,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-slate-300 font-semibold border-t border-slate-800/80 pt-1">
                    <span>Net:</span>
                    {(() => {
                      const netVal = Number(trendsList[hoveredTrendIdx].net ?? (Number(trendsList[hoveredTrendIdx].total_income) - Number(trendsList[hoveredTrendIdx].total_expense)));
                      return (
                        <span className={netVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatCurrency(netVal, displayCurrency, currencyDisplayPreference)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              <svg className="h-full w-full" viewBox="0 0 500 300" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#0891b2" />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" />
                    <stop offset="100%" stopColor="#e11d48" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines & Y Axis Labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                  const y = 20 + (1 - p) * 235;
                  const labelVal = maxTrendVal * p;
                  return (
                    <g key={idx}>
                      <line
                        x1="55"
                        y1={y}
                        x2="485"
                        y2={y}
                        stroke="#334155"
                        strokeOpacity="0.4"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                      <text
                        x="48"
                        y={y + 4}
                        textAnchor="end"
                        className="text-[10px] font-semibold fill-slate-500"
                      >
                        {formatTrendTick(labelVal)}
                      </text>
                    </g>
                  );
                })}

                {/* Bars per Month */}
                {(() => {
                  const step = 430 / trendsList.length;
                  const barW = Math.max(8, Math.min(22, step * 0.28));
                  return trendsList.map((m, idx) => {
                    const xCenter = 55 + idx * step + step * 0.5;
                    const incomeH = (Number(m.total_income) / maxTrendVal) * 235;
                    const expenseH = (Number(m.total_expense) / maxTrendVal) * 235;
                    const isHovered = hoveredTrendIdx === idx;

                    return (
                      <g
                        key={m.month}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredTrendIdx(idx)}
                        onMouseLeave={() => setHoveredTrendIdx(null)}
                      >
                        {/* Hover Column Background Highlight */}
                        {isHovered && (
                          <rect
                            x={xCenter - step * 0.45}
                            y={15}
                            width={step * 0.9}
                            height={245}
                            rx="8"
                            fill="#38bdf8"
                            fillOpacity="0.08"
                          />
                        )}

                        {/* Income Bar */}
                        <rect
                          x={xCenter - barW - 2}
                          y={20 + 235 - incomeH}
                          width={barW}
                          height={Math.max(2, incomeH)}
                          rx="3"
                          fill="url(#incomeGrad)"
                          className={`transition-all duration-200 ${
                            isHovered ? 'brightness-125 filter drop-shadow(0 0 6px #06b6d4)' : ''
                          }`}
                        />
                        {/* Expense Bar */}
                        <rect
                          x={xCenter + 2}
                          y={20 + 235 - expenseH}
                          width={barW}
                          height={Math.max(2, expenseH)}
                          rx="3"
                          fill="url(#expenseGrad)"
                          className={`transition-all duration-200 ${
                            isHovered ? 'brightness-125 filter drop-shadow(0 0 6px #f43f5e)' : ''
                          }`}
                        />
                        {/* X Axis Label */}
                        <text
                          x={xCenter}
                          y="275"
                          textAnchor="middle"
                          className={`text-[10px] font-semibold transition-colors ${
                            isHovered ? 'fill-cyan-300 font-bold' : 'fill-slate-400'
                          }`}
                        >
                          {formatMonthShort(m.month)}
                        </text>
                      </g>
                    );
                  });
                })()}
                <line x1="55" y1="255" x2="485" y2="255" stroke="#475569" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>

        {/* Savings Rate Chart */}
        <div
          data-testid="savings-rate-trend-chart"
          className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10"
        >
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Percent className="h-4 w-4 text-emerald-400" />
              Savings Rate Trend (%)
            </h4>
            <span className="text-xs font-semibold text-emerald-400/90 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Avg: {averageSavingsRate !== null ? `${Number(averageSavingsRate).toFixed(1)}%` : '0%'}
            </span>
          </div>

          {savingsRateList.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No savings rate data available
            </div>
          ) : (
            <div className="relative h-64 w-full">
              {/* Dynamic Floating Tooltip on Hover */}
              {hoveredSavingsIdx !== null && savingsRateList[hoveredSavingsIdx] && (
                <div className="absolute top-2 right-2 z-10 rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <p className="font-semibold text-white border-b border-slate-800 pb-1">
                    {formatMonthLabel(savingsRateList[hoveredSavingsIdx].month)}
                  </p>
                  <div className="flex items-center justify-between gap-4 text-emerald-400 font-bold pt-0.5 text-sm">
                    <span>Savings Rate:</span>
                    <span>
                      {Number(savingsRateList[hoveredSavingsIdx].savings_rate_pct).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Inflow retained as net asset surplus
                  </p>
                </div>
              )}

              <svg className="h-full w-full" viewBox="0 0 500 300" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="savingsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="60%" stopColor="#10b981" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                  const y = 20 + (1 - p) * 235;
                  const labelVal = minRate + rateRange * p;
                  return (
                    <g key={idx}>
                      <line
                        x1="55"
                        y1={y}
                        x2="485"
                        y2={y}
                        stroke="#334155"
                        strokeOpacity="0.4"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                      <text
                        x="48"
                        y={y + 4}
                        textAnchor="end"
                        className="text-[10px] font-semibold fill-slate-500"
                      >
                        {labelVal.toFixed(0)}%
                      </text>
                    </g>
                  );
                })}

                {/* Area and Line Graph */}
                {(() => {
                  const step = 430 / Math.max(savingsRateList.length - 1, 1);
                  const points = savingsRateList.map((m, idx) => {
                    const rate = m.savings_rate_pct ?? 0;
                    const x = 55 + idx * step;
                    const y = 20 + 235 - ((rate - minRate) / rateRange) * 235;
                    return { x, y, rate, month: m.month };
                  });

                  const lineD = generateSmoothPath(points);
                  const zeroY = 20 + 235 - ((0 - minRate) / rateRange) * 235;
                  const lastPt = points[points.length - 1];
                  const firstPt = points[0];
                  const areaD = `${lineD} L ${lastPt.x} ${zeroY} L ${firstPt.x} ${zeroY} Z`;

                  return (
                    <g>
                      {/* Gradient Area */}
                      <path d={areaD} fill="url(#savingsAreaGrad)" />
                      {/* Smooth Stroke Line */}
                      <path
                        d={lineD}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        className="filter drop-shadow(0 2px 4px #10b98150)"
                      />
                      {/* Zero line */}
                      {minRate < 0 && (
                        <line
                          x1="55"
                          y1={zeroY}
                          x2="485"
                          y2={zeroY}
                          stroke="#f43f5e"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                      )}

                      {/* Data Point Circles + Interactive Hit Areas */}
                      {points.map((p, idx) => {
                        const isHovered = hoveredSavingsIdx === idx;
                        return (
                          <g
                            key={idx}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredSavingsIdx(idx)}
                            onMouseLeave={() => setHoveredSavingsIdx(null)}
                          >
                            {/* Hover Vertical Guide Line */}
                            {isHovered && (
                              <line
                                x1={p.x}
                                y1={20}
                                x2={p.x}
                                y2={255}
                                stroke="#34d399"
                                strokeWidth="1.5"
                                strokeDasharray="3 3"
                              />
                            )}

                            {/* Circle Node */}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isHovered ? 7 : 5}
                              className={`transition-all duration-150 ${
                                isHovered
                                  ? 'fill-white stroke-emerald-400 stroke-[3] filter drop-shadow(0 0 8px #10b981)'
                                  : 'fill-emerald-400 stroke-slate-900 stroke-2'
                              }`}
                            />
                            {/* Value label directly above dot */}
                            <text
                              x={p.x}
                              y={p.y - 10}
                              textAnchor="middle"
                              className={`text-[9px] font-bold transition-colors ${
                                isHovered ? 'fill-white font-extrabold' : 'fill-emerald-300'
                              }`}
                            >
                              {p.rate.toFixed(0)}%
                            </text>
                            {/* Month Label */}
                            <text
                              x={p.x}
                              y="275"
                              textAnchor="middle"
                              className={`text-[10px] font-semibold transition-colors ${
                                isHovered ? 'fill-emerald-300 font-bold' : 'fill-slate-400'
                              }`}
                            >
                              {formatMonthShort(p.month)}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}
                <line x1="55" y1="255" x2="485" y2="255" stroke="#475569" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid gap-6">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <PieChart className="h-4 w-4 text-cyan-400" />
              Category Allocation Breakdown
            </h4>
            <div className="flex shrink-0 rounded-xl bg-slate-900/60 p-1 border border-slate-800">
              <button
                onClick={() => setBreakdownType('expense')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  breakdownType === 'expense'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Expenses
              </button>
              <button
                onClick={() => setBreakdownType('income')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  breakdownType === 'income'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Income
              </button>
            </div>
          </div>

          {donutItems.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-500">
              No transactions for breakdown during this period
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-12 items-center">
              {/* SVG Donut */}
              <div className="lg:col-span-5 flex items-center justify-center">
                <div className="relative h-52 w-52 flex-shrink-0">
                  <svg className="h-full w-full" viewBox="0 0 200 200">
                    {(() => {
                      let currentOffset = 0;
                      return donutItems.map((cat, index) => {
                        const theme =
                          cat.category_id === 'other'
                            ? { color: DONUT_OTHER_COLOR }
                            : { color: DONUT_COLORS[index % DONUT_COLORS.length] };
                        const strokeDash = `${(Number(cat.pct_of_total) / 100) * 376.99} 376.99`;
                        const offset = -currentOffset;
                        currentOffset += (Number(cat.pct_of_total) / 100) * 376.99;
                        const isHovered = hoveredCategoryIdx === index;

                        return (
                          <circle
                            key={cat.category_id}
                            cx={100}
                            cy={100}
                            r={60}
                            fill="transparent"
                            stroke={theme.color}
                            strokeWidth={isHovered ? 18 : 14}
                            strokeDasharray={strokeDash}
                            strokeDashoffset={offset}
                            transform="rotate(-90 100 100)"
                            className="cursor-pointer transition-all duration-300 hover:opacity-100"
                            style={{
                              opacity: hoveredCategoryIdx === null || isHovered ? 1 : 0.35,
                              filter: isHovered ? `drop-shadow(0 0 6px ${theme.color}80)` : undefined,
                            }}
                            onMouseEnter={() => setHoveredCategoryIdx(index)}
                            onMouseLeave={() => setHoveredCategoryIdx(null)}
                          />
                        );
                      });
                    })()}
                  </svg>
                  {/* Center dynamic hub */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate max-w-[110px]">
                      {activeCategory ? activeCategory.category_name : 'Total Flow'}
                    </span>
                    <span className="text-base font-extrabold text-white mt-0.5">
                      {activeCategory
                        ? formatCurrency(
                            Number(activeCategory.amount),
                            displayCurrency,
                            currencyDisplayPreference,
                          )
                        : formatCurrency(
                            Number(breakdownData?.total ?? 0),
                            displayCurrency,
                            currencyDisplayPreference,
                          )}
                    </span>
                    <span className="text-[11px] font-semibold text-cyan-400 mt-0.5">
                      {activeCategory
                        ? `${Number(activeCategory.pct_of_total).toFixed(1)}%`
                        : `${donutItems.length} Categories`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="lg:col-span-7 max-h-64 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
                {donutItems.map((cat, index) => {
                  const theme =
                    cat.category_id === 'other'
                      ? { color: DONUT_OTHER_COLOR }
                      : { color: DONUT_COLORS[index % DONUT_COLORS.length] };
                  const isHovered = hoveredCategoryIdx === index;

                  return (
                    <div
                      key={cat.category_id}
                      className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-2 rounded-xl transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-slate-700/40 border border-slate-600/60 shadow-sm'
                          : 'hover:bg-slate-800/60 border border-transparent'
                      }`}
                      onMouseEnter={() => setHoveredCategoryIdx(index)}
                      onMouseLeave={() => setHoveredCategoryIdx(null)}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-md transition-transform duration-200"
                          style={{
                            backgroundColor: theme.color,
                            transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                            boxShadow: isHovered ? `0 0 8px ${theme.color}` : undefined,
                          }}
                        />
                        <div className="truncate flex flex-col">
                          <span
                            className={`font-semibold text-xs truncate transition-colors ${
                              isHovered ? 'text-white' : 'text-slate-300'
                            }`}
                          >
                            {cat.category_name}
                          </span>
                          {/* Mini Progress Track */}
                          <div className="h-1.5 w-24 bg-slate-900 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, Number(cat.pct_of_total))}%`,
                                backgroundColor: theme.color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400 font-semibold text-xs">
                        {Number(cat.pct_of_total).toFixed(1)}%
                      </span>
                      <span className="text-white font-bold text-xs">
                        {formatCurrency(
                          Number(cat.amount),
                          displayCurrency,
                          currencyDisplayPreference,
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spending by Tag */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Tag className="h-4 w-4 text-cyan-400" />
            Spending by Tag
          </h4>
          <span className="text-xs text-slate-400 font-medium">Cross-category attribution</span>
        </div>
        {tagBreakdownItems.length === 0 ? (
          <p className="text-sm text-slate-500">
            Add tags to transactions to see trips, people, merchants, and behaviors here.
          </p>
        ) : (
          <div className="space-y-3.5">
            {tagBreakdownItems.map((item) => (
              <div
                key={item.tag_id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/40 transition-colors"
              >
                <div className="min-w-28 truncate flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span className="truncate text-xs font-semibold text-slate-200">
                    {item.tag_name}
                  </span>
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Number(item.pct_of_total))}%` }}
                  />
                </div>
                <span className="w-24 text-right text-xs font-bold text-white">
                  {formatCurrency(Number(item.amount), displayCurrency, currencyDisplayPreference)}
                </span>
                <span className="w-12 text-right text-xs font-semibold text-cyan-400/90">
                  {Number(item.pct_of_total).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Memoized presentational tab — see TransactionsTab for rationale.
export const AnalyticsTab = React.memo(AnalyticsTabImpl);
