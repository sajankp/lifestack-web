import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  CheckCircle2,
  PieChart,
  PiggyBank,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { spendingService } from '../../services/spending';
import { formatCurrency } from '../../utils/numberFormat';
import { formatMonthLabel } from './format';

interface AnalyticsTabProps {
  selectedMonth: string;
  displayCurrency: string;
  currencyDisplayPreference: 'symbol' | 'code';
  getCategoryTheme: (catId: string) => { name: string; color: string; icon: string | null };
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  selectedMonth,
  displayCurrency,
  currencyDisplayPreference,
  getCategoryTheme,
}) => {
  const [rangeMonths, setRangeMonths] = useState(6);
  const [breakdownType, setBreakdownType] = useState<'income' | 'expense'>('expense');

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
    const fromMonthVal = `${startMonthDate.getUTCFullYear()}-${String(startMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const endMonthDate = new Date(Date.UTC(year, month - 1, 1));
    const toMonthVal = `${endMonthDate.getUTCFullYear()}-${String(endMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const fromDate = `${fromMonthVal}-01`;
    // Last day of the selected month
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const toDate = `${toMonthVal}-${String(lastDay).padStart(2, '0')}`;

    return {
      fromMonth: fromMonthVal,
      toMonth: toMonthVal,
      fromDate,
      toDate
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
    queryFn: () => spendingService.getCategoryBreakdown(analyticsRange.fromDate, analyticsRange.toDate, breakdownType),
    enabled: !!analyticsRange.fromDate,
  });

  const { data: budgetPerfData, isLoading: isBudgetPerfLoading } = useQuery({
    queryKey: ['spending-budget-perf', analyticsRange.fromMonth, analyticsRange.toMonth],
    queryFn: () => spendingService.getBudgetPerformance(analyticsRange.fromMonth, analyticsRange.toMonth),
    enabled: !!analyticsRange.fromMonth,
  });

  const { data: savingsRateData, isLoading: isSavingsRateLoading } = useQuery({
    queryKey: ['spending-savings-rate', analyticsRange.fromMonth, analyticsRange.toMonth],
    queryFn: () => spendingService.getSavingsRate(analyticsRange.fromMonth, analyticsRange.toMonth),
    enabled: !!analyticsRange.fromMonth,
  });

  const isAnalyticsLoading = isTrendsLoading || isBreakdownLoading || isBudgetPerfLoading || isSavingsRateLoading;

  if (isAnalyticsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-800/30" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-slate-800/30" />
          <div className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-slate-800/30" />
        </div>
      </div>
    );
  }

  // Format month names (Jan, Feb, ...)
  const formatMonthShort = (monthStr: string) => {
    if (!/^\d{4}-\d{2}$/.test(monthStr)) return monthStr;
    const [, m] = monthStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[Number(m) - 1];
  };

  // Period stats summary
  const totalIncome = savingsRateData?.period_totals?.total_income ?? 0;
  const totalExpense = savingsRateData?.period_totals?.total_expense ?? 0;
  const totalSavings = savingsRateData?.period_totals?.total_savings ?? 0;
  const averageSavingsRate = savingsRateData?.period_totals?.average_savings_rate_pct ?? null;

  // --- 1. Trends Bar Chart Setup ---
  const trendsList = trendsData?.months ?? [];
  const maxTrendVal = Math.max(
    ...trendsList.flatMap((m) => [Number(m.total_income), Number(m.total_expense)]),
    100
  );

  // --- 2. Savings Rate Area Chart Setup ---
  const savingsRateList = savingsRateData?.months ?? [];
  const rates = savingsRateList.map((m) => m.savings_rate_pct ?? 0);
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
      transaction_count: 0
    });
  }

  // --- 4. Budget Performance sorting ---
  const sortedBudgetItems = [...(budgetPerfData?.categories ?? [])].sort(
    (a, b) => (b.utilization_pct ?? 0) - (a.utilization_pct ?? 0)
  );
  const sortedGroupBudgetItems = [...(budgetPerfData?.groups ?? [])].sort(
    (a, b) => (b.utilization_pct ?? 0) - (a.utilization_pct ?? 0)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Analytics Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-700/50 bg-slate-800/20 p-4">
        <div>
          <h4 className="text-base font-semibold text-white">Analysis Window</h4>
          <p className="text-xs text-slate-400">
            {rangeMonths === 1
              ? `Showing ${formatMonthLabel(selectedMonth)}`
              : `Comparing trends ending in ${formatMonthLabel(selectedMonth)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Duration:</span>
          {[1, 3, 6, 12].map((m) => (
            <button
              key={m}
              onClick={() => setRangeMonths(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                rangeMonths === m
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-800/40 text-slate-400 border border-transparent hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              {m === 1 ? 'This Month' : `${m} Months`}
            </button>
          ))}
        </div>
      </div>

      {/* Period Stats Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card: Total Income */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Period Income</p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {formatCurrency(Number(totalIncome), displayCurrency, currencyDisplayPreference)}
              </h3>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Card: Total Expenses */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Period Expenses</p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {formatCurrency(Number(totalExpense), displayCurrency, currencyDisplayPreference)}
              </h3>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400">
              <TrendingUp className="h-5 w-5 rotate-180" />
            </div>
          </div>
        </div>

        {/* Card: Period Savings */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Net Savings</p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {formatCurrency(Number(totalSavings), displayCurrency, currencyDisplayPreference)}
              </h3>
            </div>
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
              <PiggyBank className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Card: Savings Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Avg Savings Rate</p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {averageSavingsRate !== null ? `${Number(averageSavingsRate).toFixed(1)}%` : 'N/A'}
              </h3>
            </div>
            <div className="rounded-lg bg-violet-500/10 p-2 text-violet-400">
              <Percent className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trends Chart */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <BarChart2 className="h-4 w-4 text-cyan-400" />
              Income vs Expenses Trend
            </h4>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                Income
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Expenses
              </div>
            </div>
          </div>

          {trendsList.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No trend data available for the period
            </div>
          ) : (
            <div className="h-64 w-full">
              <svg className="h-full w-full" viewBox="0 0 500 300" preserveAspectRatio="none">
                {/* Horizontal Grid lines & Y Axis Labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                  const y = 20 + (1 - p) * 235;
                  const labelVal = maxTrendVal * p;
                  return (
                    <g key={idx}>
                      <line x1="50" y1={y} x2="480" y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="42" y={y + 4} textAnchor="end" className="text-[10px] font-medium fill-slate-400">
                        {labelVal >= 1000 ? `${(labelVal / 1000).toFixed(0)}k` : labelVal.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {/* Bars per Month */}
                {(() => {
                  const step = 430 / trendsList.length;
                  const barW = Math.max(4, step * 0.25);
                  return trendsList.map((m, idx) => {
                    const xCenter = 50 + idx * step + step * 0.5;
                    const incomeH = (Number(m.total_income) / maxTrendVal) * 235;
                    const expenseH = (Number(m.total_expense) / maxTrendVal) * 235;

                    return (
                      <g key={m.month}>
                        {/* Income Bar */}
                        <rect
                          x={xCenter - barW - 2}
                          y={20 + 235 - incomeH}
                          width={barW}
                          height={incomeH}
                          rx="2"
                          className="fill-cyan-500 hover:fill-cyan-400 transition-colors"
                        >
                          <title>{`Income: ${formatCurrency(Number(m.total_income), displayCurrency, currencyDisplayPreference)}`}</title>
                        </rect>
                        {/* Expense Bar */}
                        <rect
                          x={xCenter + 2}
                          y={20 + 235 - expenseH}
                          width={barW}
                          height={expenseH}
                          rx="2"
                          className="fill-rose-500 hover:fill-rose-400 transition-colors"
                        >
                          <title>{`Expense: ${formatCurrency(Number(m.total_expense), displayCurrency, currencyDisplayPreference)}`}</title>
                        </rect>
                        {/* X Axis Label */}
                        <text x={xCenter} y="275" textAnchor="middle" className="text-[10px] font-semibold fill-slate-400">
                          {formatMonthShort(m.month)}
                        </text>
                      </g>
                    );
                  });
                })()}
                <line x1="50" y1="255" x2="480" y2="255" stroke="#475569" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>

        {/* Savings Rate Chart */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Percent className="h-4 w-4 text-emerald-400" />
              Savings Rate Trend (%)
            </h4>
          </div>

          {savingsRateList.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No savings rate data available
            </div>
          ) : (
            <div className="h-64 w-full">
              <svg className="h-full w-full" viewBox="0 0 500 300" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="savingsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                  const y = 20 + (1 - p) * 235;
                  const labelVal = minRate + rateRange * p;
                  return (
                    <g key={idx}>
                      <line x1="50" y1={y} x2="480" y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="42" y={y + 4} textAnchor="end" className="text-[10px] font-medium fill-slate-400">
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
                    const x = 50 + idx * step;
                    const y = 20 + 235 - ((rate - minRate) / rateRange) * 235;
                    return { x, y, rate, month: m.month };
                  });

                  const lineD = points.map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
                  const zeroY = 20 + 235 - ((0 - minRate) / rateRange) * 235;
                  const areaD = `${lineD} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`;

                  return (
                    <g>
                      {/* Gradient Area */}
                      <path d={areaD} fill="url(#savingsAreaGrad)" />
                      {/* Stroke Line */}
                      <path d={lineD} fill="none" stroke="#10b981" strokeWidth="2.5" />
                      {/* Zero line */}
                      {minRate < 0 && (
                        <line x1="50" y1={zeroY} x2="480" y2={zeroY} stroke="#f43f5e" strokeWidth="1" strokeDasharray="2 2" />
                      )}
                      {/* Data Point Circles + X Labels */}
                      {points.map((p, idx) => (
                        <g key={idx}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="4.5"
                            className="fill-emerald-400 stroke-slate-900 stroke-2 hover:r-6 cursor-pointer transition-all"
                          >
                            <title>{`${p.month}: ${p.rate.toFixed(1)}%`}</title>
                          </circle>
                          {/* Value label directly above dot */}
                          <text x={p.x} y={p.y - 8} textAnchor="middle" className="text-[9px] font-bold fill-emerald-300 bg-slate-900/80 px-1 rounded">
                            {p.rate.toFixed(0)}%
                          </text>
                          <text x={p.x} y="275" textAnchor="middle" className="text-[10px] font-semibold fill-slate-400">
                            {formatMonthShort(p.month)}
                          </text>
                        </g>
                      ))}
                    </g>
                  );
                })()}
                <line x1="50" y1="255" x2="480" y2="255" stroke="#475569" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Categories Breakdown & Budget Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown Card */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 backdrop-blur-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <PieChart className="h-4 w-4 text-cyan-400" />
              Category Breakdown
            </h4>
            <div className="flex rounded-lg bg-slate-950/40 p-1">
              <button
                onClick={() => setBreakdownType('expense')}
                className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  breakdownType === 'expense'
                    ? 'bg-cyan-500/25 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Expenses
              </button>
              <button
                onClick={() => setBreakdownType('income')}
                className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  breakdownType === 'income'
                    ? 'bg-cyan-500/25 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
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
            <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
              {/* SVG Donut */}
              <div className="relative h-40 w-40 flex-shrink-0">
                <svg className="h-full w-full" viewBox="0 0 200 200">
                  {(() => {
                    let currentOffset = 0;
                    return donutItems.map((cat) => {
                      const theme = cat.category_id === 'other' ? { color: '#94a3b8' } : getCategoryTheme(cat.category_id as string);
                      const strokeDash = `${(Number(cat.pct_of_total) / 100) * 376.99} 376.99`;
                      const offset = -currentOffset;
                      currentOffset += (Number(cat.pct_of_total) / 100) * 376.99;
                      return (
                        <circle
                          key={cat.category_id}
                          cx={100}
                          cy={100}
                          r={60}
                          fill="transparent"
                          stroke={theme.color}
                          strokeWidth="14"
                          strokeDasharray={strokeDash}
                          strokeDashoffset={offset}
                          transform="rotate(-90 100 100)"
                          className="transition-all duration-300 hover:stroke-[18px]"
                        >
                          <title>{`${cat.category_name}: ${Number(cat.pct_of_total).toFixed(1)}%`}</title>
                        </circle>
                      );
                    });
                  })()}
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</span>
                  <span className="text-sm font-extrabold text-white">
                    {formatCurrency(Number(breakdownData?.total ?? 0), displayCurrency, currencyDisplayPreference)}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 w-full max-h-52 overflow-y-auto space-y-2.5 pr-2">
                {donutItems.map((cat) => {
                  const theme = cat.category_id === 'other' ? { color: '#94a3b8' } : getCategoryTheme(cat.category_id as string);
                  return (
                    <div key={cat.category_id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded" style={{ backgroundColor: theme.color }} />
                        <span className="font-medium text-slate-300 truncate">{cat.category_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-semibold">{Number(cat.pct_of_total).toFixed(1)}%</span>
                        <span className="text-slate-100 font-bold">
                          {formatCurrency(Number(cat.amount), displayCurrency, currencyDisplayPreference)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Budget Performance Card */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 backdrop-blur-sm">
          <div className="mb-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Budget Guardrails &amp; Performance
            </h4>
          </div>

          {sortedBudgetItems.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-500">
              No active budgets found for this month window
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-4 pr-2">
              {sortedBudgetItems.map((item) => {
                const isWarning = item.status === 'warning';
                const isExceeded = item.status === 'exceeded';
                const statusColor = isExceeded ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';
                const progressColor = isExceeded ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
                const uPct = item.utilization_pct !== null ? Math.round(item.utilization_pct) : 0;

                return (
                  <div key={item.category_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{item.category_name}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                        {item.status?.replace(/_/g, ' ') || ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Spent {formatCurrency(Number(item.actual_amount), displayCurrency, currencyDisplayPreference)} of{' '}
                        {item.budget_amount !== null
                          ? formatCurrency(Number(item.budget_amount), displayCurrency, currencyDisplayPreference)
                          : 'N/A'}
                      </span>
                      <span className="font-semibold">{uPct}%</span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950/40">
                      <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${Math.max(0, Math.min(100, uPct))}%` }} />
                    </div>

                    {item.remaining !== null && (
                      <p className="text-[10px] text-right font-medium text-slate-500">
                        {isExceeded
                          ? `${formatCurrency(Math.abs(Number(item.remaining)), displayCurrency, currencyDisplayPreference)} over limit`
                          : `${formatCurrency(Number(item.remaining), displayCurrency, currencyDisplayPreference)} remaining`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {sortedGroupBudgetItems.length > 0 ? (
            <div className="mt-6 border-t border-slate-800 pt-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <CheckCircle2 className="h-4 w-4 text-violet-400" />
                Group Budgets
              </h4>
              <div className="max-h-56 overflow-y-auto space-y-4 pr-2" data-testid="analytics-group-budgets">
                {sortedGroupBudgetItems.map((item) => {
                  const isWarning = item.status === 'warning';
                  const isExceeded = item.status === 'exceeded';
                  const statusColor = isExceeded ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';
                  const progressColor = isExceeded ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
                  const uPct = item.utilization_pct !== null ? Math.round(item.utilization_pct) : 0;

                  return (
                    <div key={item.category_group_id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{item.category_group_name}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                          {item.status?.replace(/_/g, ' ') || ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Spent {formatCurrency(Number(item.actual_amount), displayCurrency, currencyDisplayPreference)} of{' '}
                          {item.budget_amount !== null
                            ? formatCurrency(Number(item.budget_amount), displayCurrency, currencyDisplayPreference)
                            : 'N/A'}
                        </span>
                        <span className="font-semibold">{uPct}%</span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950/40">
                        <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${Math.max(0, Math.min(100, uPct))}%` }} />
                      </div>

                      {item.remaining !== null && (
                        <p className="text-[10px] text-right font-medium text-slate-500">
                          {isExceeded
                            ? `${formatCurrency(Math.abs(Number(item.remaining)), displayCurrency, currencyDisplayPreference)} over limit`
                            : `${formatCurrency(Number(item.remaining), displayCurrency, currencyDisplayPreference)} remaining`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
