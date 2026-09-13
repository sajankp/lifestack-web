import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Flame,
  Gauge,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { spendingService } from '../../services/spending';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { toNumber } from '../../utils/numberFormat';

interface SpendPacingCardProps {
  selectedMonth: string;
  displayCurrency: string;
  currencyDisplayPreference: 'symbol' | 'code';
}

export const SpendPacingCard: React.FC<SpendPacingCardProps> = ({
  selectedMonth,
  displayCurrency,
  currencyDisplayPreference,
}) => {
  const formatCurrency = useCurrencyFormatter();

  const { data: pacing, isLoading, isError } = useQuery({
    queryKey: ['spend-pacing', selectedMonth],
    queryFn: () => spendingService.getSpendPacing(selectedMonth),
    enabled: !!selectedMonth,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 animate-pulse">
        <div className="h-5 w-48 bg-slate-700/50 rounded mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-20 bg-slate-700/30 rounded-xl" />
          <div className="h-20 bg-slate-700/30 rounded-xl" />
          <div className="h-20 bg-slate-700/30 rounded-xl" />
          <div className="h-20 bg-slate-700/30 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !pacing) {
    return null;
  }

  const currency = pacing.currency || displayCurrency;
  const dailyBurn = toNumber(pacing.daily_burn_rate);
  const totalSpent = toNumber(pacing.actual_spend ?? pacing.total_spent ?? 0);

  const projectedSpend = toNumber(
    pacing.projected_month_end_spend ?? pacing.projected_spend ?? 0,
  );
  const totalBudget = pacing.total_budget != null ? toNumber(pacing.total_budget) : null;
  const budgetConsumedPct =
    pacing.budget_consumed_pct != null ? toNumber(pacing.budget_consumed_pct) : null;
  const monthElapsedPct = toNumber(pacing.month_progress_pct ?? pacing.month_elapsed_pct ?? 0);
  const pacingDelta =
    pacing.pacing_delta != null
      ? toNumber(pacing.pacing_delta)
      : totalBudget !== null
        ? projectedSpend - totalBudget
        : null;

  // Safe daily spend for remaining days to stay on budget
  const safeDailyRemaining =
    totalBudget !== null && pacing.days_remaining > 0
      ? Math.max(0, (totalBudget - totalSpent) / pacing.days_remaining)
      : null;

  const status = pacing.status ?? pacing.pacing_status ?? 'no_budget';
  const isOverBudget = status === 'over_budget' || status === 'over_pacing';
  const isUnderBudget = status === 'under_budget';
  const isOnTrack = status === 'on_track';

  const fixedSpend = pacing.fixed_spend != null ? toNumber(pacing.fixed_spend) : null;
  const discretionarySpend = pacing.discretionary_spend != null ? toNumber(pacing.discretionary_spend) : null;
  const fixedBurnRate = pacing.fixed_burn_rate != null ? toNumber(pacing.fixed_burn_rate) : null;
  const discretionaryBurnRate = pacing.discretionary_burn_rate != null ? toNumber(pacing.discretionary_burn_rate) : null;
  const categories = pacing.categories ?? [];



  return (
    <div
      data-testid="spend-pacing-card"
      className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 shadow-lg shadow-black/10"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Monthly Spend Pacing</h3>
            <p className="text-xs text-slate-400">
              Burn rate velocity & budget projection for {pacing.month}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {totalBudget !== null ? (
          <div className="flex items-center gap-1.5">
            {isUnderBudget && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Under Budget Pace
              </span>
            )}
            {isOnTrack && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/30">
                <Gauge className="h-3.5 w-3.5" />
                On Track Pace
              </span>
            )}
            {isOverBudget && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-400 border border-rose-500/30">
                <AlertCircle className="h-3.5 w-3.5" />
                Projected Over Budget
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/40 px-3 py-1 text-xs font-medium text-slate-400 border border-slate-700">
            No Budget Set
          </span>
        )}
      </div>

      {/* 4 Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Daily Burn Rate */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Daily Burn Rate</span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-white">
            {formatCurrency(dailyBurn, currency, currencyDisplayPreference)}
            <span className="text-xs font-normal text-slate-400"> / day</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Across {pacing.days_elapsed} active day{pacing.days_elapsed === 1 ? '' : 's'}
          </p>
        </div>

        {/* Projected Spend */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Projected EOM Spend</span>
            {isOverBudget ? (
              <TrendingUp className="h-4 w-4 text-rose-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          <div className="mt-2 text-xl font-bold text-white">
            {formatCurrency(projectedSpend, currency, currencyDisplayPreference)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {totalBudget !== null
              ? pacingDelta !== null && pacingDelta > 0
                ? `+${formatCurrency(pacingDelta, currency, currencyDisplayPreference)} vs budget`
                : `${formatCurrency(Math.abs(pacingDelta ?? 0), currency, currencyDisplayPreference)} buffer`
              : 'Based on current velocity'}
          </p>
        </div>

        {/* Budget / Spent */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Budget Consumed</span>
            <span className="font-semibold text-slate-300">
              {budgetConsumedPct !== null ? `${budgetConsumedPct.toFixed(1)}%` : 'N/A'}
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-white">
            {formatCurrency(totalSpent, currency, currencyDisplayPreference)}
            {totalBudget !== null && (
              <span className="text-xs font-normal text-slate-400">
                {' '}
                / {formatCurrency(totalBudget, currency, currencyDisplayPreference)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {totalBudget !== null && totalBudget > totalSpent
              ? `${formatCurrency(totalBudget - totalSpent, currency, currencyDisplayPreference)} remaining`
              : totalBudget !== null
                ? 'Budget exceeded'
                : 'No budget target set'}
          </p>
        </div>

        {/* Month Elapsed */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Month Elapsed</span>
            <Calendar className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-white">
            {monthElapsedPct.toFixed(1)}%
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Day {pacing.days_elapsed} of {pacing.days_in_month} ({pacing.days_remaining} day{pacing.days_remaining === 1 ? '' : 's'} left)
          </p>
        </div>
      </div>

      {/* Visual Progress Comparison Bar */}
      <div className="mt-4 rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
        <div className="space-y-3">
          {/* Time Elapsed Bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Time Elapsed ({monthElapsedPct.toFixed(0)}%)</span>
              <span>Day {pacing.days_elapsed} / {pacing.days_in_month}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, monthElapsedPct))}%` }}
              />
            </div>
          </div>

          {/* Budget Consumed Bar (if budget exists) */}
          {totalBudget !== null && budgetConsumedPct !== null && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Budget Consumed ({budgetConsumedPct.toFixed(0)}%)</span>
                <span>
                  {formatCurrency(totalSpent, currency, currencyDisplayPreference)} of{' '}
                  {formatCurrency(totalBudget, currency, currencyDisplayPreference)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetConsumedPct > 100
                      ? 'bg-rose-500'
                      : budgetConsumedPct > monthElapsedPct + 5
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, budgetConsumedPct))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Guidance / Actionable Advice Footer */}
        <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
          {totalBudget !== null ? (
            isOverBudget ? (
              <span className="text-rose-300">
                Runaway burn rate: At your current spend pace of{' '}
                <strong className="text-rose-200">
                  {formatCurrency(dailyBurn, currency, currencyDisplayPreference)}/day
                </strong>
                , you are projected to exceed your budget by{' '}
                <strong className="text-rose-200">
                  {formatCurrency(pacingDelta ?? 0, currency, currencyDisplayPreference)}
                </strong>
                .
                {safeDailyRemaining !== null && safeDailyRemaining > 0 && (
                  <> Reduce burn to <strong className="text-white">{formatCurrency(safeDailyRemaining, currency, currencyDisplayPreference)}/day</strong> to stay within budget.</>
                )}
              </span>
            ) : isUnderBudget ? (
              <span className="text-emerald-300">
                Pacing healthy: You have consumed{' '}
                <strong>{budgetConsumedPct?.toFixed(0)}%</strong> of your budget while{' '}
                <strong>{monthElapsedPct.toFixed(0)}%</strong> of the month has elapsed. Projected
                budget buffer of{' '}
                <strong className="text-emerald-200">
                  {formatCurrency(Math.abs(pacingDelta ?? 0), currency, currencyDisplayPreference)}
                </strong>
                .
              </span>
            ) : (
              <span className="text-cyan-300">
                Pacing on track: Your spending rate is aligned with the elapsed days this month.
              </span>
            )
          ) : (
            <span className="text-slate-400">
              Set a monthly budget to unlock pacing alerts, target burn recommendations, and budget
              consumption tracking.
            </span>
          )}
        </div>
      </div>

      {/* Fixed vs Discretionary Burn Breakdown */}
      {(fixedSpend !== null || discretionarySpend !== null) && (
        <div className="mt-4 rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Burn Velocity Split
            </span>
            <span className="text-xs text-slate-400">
              Survival vs Lifestyle
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/30">
              <div className="flex justify-between items-center text-xs">
                <span className="text-indigo-400 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Fixed (Committed)
                </span>
                {totalSpent > 0 && fixedSpend !== null && (
                  <span className="text-slate-400">
                    {((fixedSpend / totalSpent) * 100).toFixed(0)}% of spend
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-base font-bold text-white">
                  {formatCurrency(fixedSpend ?? 0, currency, currencyDisplayPreference)}
                </span>
                {fixedBurnRate !== null && (
                  <span className="text-xs text-slate-400">
                    {formatCurrency(fixedBurnRate, currency, currencyDisplayPreference)}/day
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/30">
              <div className="flex justify-between items-center text-xs">
                <span className="text-amber-400 font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Discretionary (Lifestyle)
                </span>
                {totalSpent > 0 && discretionarySpend !== null && (
                  <span className="text-slate-400">
                    {((discretionarySpend / totalSpent) * 100).toFixed(0)}% of spend
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-base font-bold text-white">
                  {formatCurrency(discretionarySpend ?? 0, currency, currencyDisplayPreference)}
                </span>
                {discretionaryBurnRate !== null && (
                  <span className="text-xs text-slate-400">
                    {formatCurrency(discretionaryBurnRate, currency, currencyDisplayPreference)}/day
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Spend Pacing Table / List */}
      {categories.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Category Pacing Breakdown
            </span>
            <span className="text-xs text-slate-400">
              {categories.length} tracked {categories.length === 1 ? 'category' : 'categories'}
            </span>
          </div>
          <div className="space-y-2.5">
            {categories.map((cat) => {
              const catActual = toNumber(cat.actual_spend);
              const catBudget = cat.budget_amount != null ? toNumber(cat.budget_amount) : null;
              const catConsumed = cat.budget_consumed_pct != null ? toNumber(cat.budget_consumed_pct) : null;
              const catProjected = toNumber(cat.projected_spend);
              const catBurn = toNumber(cat.daily_burn_rate);
              const catStatus = cat.pacing_status ?? cat.status ?? 'no_budget';
              const isCatOver = catStatus === 'over_budget' || catStatus === 'over_pacing';
              const isCatOnTrack = catStatus === 'on_track';
              const isCatUnder = catStatus === 'under_budget';

              return (
                <div
                  key={cat.category_id || cat.category_name}
                  className="rounded-lg bg-slate-800/40 p-3 border border-slate-700/20 hover:border-slate-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white">{cat.category_name}</span>
                      {isCatOver && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Over Pacing
                        </span>
                      )}
                      {isCatOnTrack && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          On Track
                        </span>
                      )}
                      {isCatUnder && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Under Budget
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(catActual, currency, currencyDisplayPreference)}
                      </span>
                      {catBudget !== null && (
                        <span className="text-xs text-slate-400">
                          {' '}/ {formatCurrency(catBudget, currency, currencyDisplayPreference)}
                        </span>
                      )}
                    </div>
                  </div>

                  {catBudget !== null && catConsumed !== null && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full rounded-full bg-slate-700/50 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            catConsumed > 100
                              ? 'bg-rose-500'
                              : catConsumed > monthElapsedPct + 10
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, catConsumed))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                    <span>Burn: {formatCurrency(catBurn, currency, currencyDisplayPreference)}/day</span>
                    <span>Proj: {formatCurrency(catProjected, currency, currencyDisplayPreference)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
