import React from 'react';
import { Link } from 'react-router';
import { formatCurrency, toNumber, type NumericValue } from '../../utils/numberFormat';
import type { MonthBudgetStatus } from '../../types/spending';

// spec-113 §3.3. This month: spent · left in budget · not covered by a budget. Every figure comes
// from the dashboard summary's month_budget, the one budget answer (spec-115), so there is no
// second request and no second way of adding spend up.

interface ThisMonthSectionProps {
  monthBudget: MonthBudgetStatus | null;
  currency: string;
  currencyDisplay: 'symbol' | 'code';
  locale: string;
  decimalPlaces: number;
}

export const ThisMonthSection: React.FC<ThisMonthSectionProps> = ({
  monthBudget,
  currency,
  currencyDisplay,
  locale,
  decimalPlaces,
}) => {
  const money = (value: NumericValue) =>
    formatCurrency(value, currency, currencyDisplay, locale, decimalPlaces);

  const limit = monthBudget ? toNumber(monthBudget.covered_limit) : 0;
  const hasBudgets = !!monthBudget && monthBudget.lines.length > 0 && limit > 0;
  const left = hasBudgets ? limit - toNumber(monthBudget.covered_spend) : 0;
  const uncovered = monthBudget ? toNumber(monthBudget.uncovered_spend) : 0;
  const usedPct = hasBudgets ? Math.min(100, Math.max(0, monthBudget.used_pct ?? 0)) : 0;

  return (
    <section
      data-testid="today-this-month"
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-black/10 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          This month
        </h2>
        <Link
          to="/spending/budgets"
          className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
        >
          Budgets
        </Link>
      </div>

      {!monthBudget ? (
        <p data-testid="today-month-unavailable" className="mt-3 text-sm text-slate-400">
          Spending isn&apos;t available right now.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p data-testid="today-month-spent" className="text-2xl font-bold text-white">
                {money(monthBudget.total_spend)}
              </p>
              <p className="text-xs text-slate-400">spent</p>
            </div>
            {hasBudgets ? (
              <div data-testid="today-month-left">
                <p
                  className={`text-2xl font-bold ${
                    left < 0 ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  {money(Math.abs(left))}
                </p>
                <p className="text-xs text-slate-400">
                  {left < 0 ? 'over budget' : 'left in budget'}
                </p>
              </div>
            ) : (
              <div data-testid="today-month-no-budgets">
                <p className="text-sm font-medium text-slate-300">No budgets set</p>
                <p className="text-xs text-slate-500">
                  Set one in Budgets to see what is left each month.
                </p>
              </div>
            )}
          </div>

          {hasBudgets ? (
            <div className="mt-3">
              <div
                role="progressbar"
                aria-label="Budget used"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usedPct)}
                className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
              >
                <div
                  className={`h-full rounded-full ${
                    left < 0 ? 'bg-rose-500' : usedPct >= 90 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              <p data-testid="today-month-used" className="mt-1 text-xs text-slate-400">
                {Math.round(monthBudget.used_pct ?? 0)}% of your budgets used
              </p>
            </div>
          ) : null}

          {hasBudgets && uncovered > 0 ? (
            <p data-testid="dashboard-uncovered-spend" className="mt-2 text-sm text-slate-400">
              {money(uncovered)} not covered by a budget
            </p>
          ) : null}
        </>
      )}
    </section>
  );
};
