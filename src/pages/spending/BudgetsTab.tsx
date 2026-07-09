import React from 'react';
import { Edit2, Plus, Tag, Target, Users } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { formatCurrency } from '../../utils/numberFormat';
import type { PaginatedResponse } from '../../types/common';
import type { Budget } from '../../types/spending';
import { formatBudgetRangeLabel } from './format';

interface BudgetsTabProps {
  budgets: Budget[] | undefined;
  budgetsResponse: PaginatedResponse<Budget> | undefined;
  monthLabel: string;
  spentByCategory: Map<string, number>;
  spentByGroup: Map<string, number>;
  displayCurrency: string;
  currencyDisplayPreference: 'symbol' | 'code';
  getCategoryTheme: (catId: string | null) => { name: string; color: string; icon: string | null };
  getGroupTheme: (groupId: string | null) => { name: string; color: string; icon: string | null };
  onEdit: (budget: Budget) => void;
  onPageChange: (offset: number) => void;
  onAddFirst?: () => void;
  isMultiMonth?: boolean;
  multiMonthBudgets?: Array<{
    id: string;
    name: string;
    isGroup: boolean;
    amount: number;
    spent: number;
    status: string;
    utilization: number;
    remaining: number;
    monthly: Array<{
      month: string;
      label: string;
      amount: number;
      spent: number;
      utilization: number;
      status: string;
    }>;
  }>;
}

const BudgetsTabImpl: React.FC<BudgetsTabProps> = ({
  budgets,
  budgetsResponse,
  monthLabel,
  spentByCategory,
  spentByGroup,
  displayCurrency,
  currencyDisplayPreference,
  getCategoryTheme,
  getGroupTheme,
  onEdit,
  onPageChange,
  onAddFirst,
  isMultiMonth = false,
  multiMonthBudgets = [],
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h3 className="text-xl font-semibold text-white">
        {isMultiMonth ? `Budget Performance: ${monthLabel}` : `Budgets for ${monthLabel}`}
      </h3>
      {isMultiMonth ? (
        multiMonthBudgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
            <div className="mb-4 rounded-full bg-slate-800 p-4">
              <Target className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-white">No budgets set</h3>
            <p className="text-slate-400">No active budgets found for this period window.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {multiMonthBudgets.map((b) => {
              const theme = b.isGroup ? getGroupTheme(b.id) : getCategoryTheme(b.id);
              const progress = Math.min(100, Math.max(0, b.utilization));
              const isWarning = b.status === 'warning';
              const isExceeded = b.status === 'exceeded';
              const statusColor = isExceeded ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';
              const statusBg = isExceeded ? 'bg-red-500/10' : isWarning ? 'bg-amber-500/10' : 'bg-emerald-500/10';
              const progressColor = isExceeded ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';

              return (
                <div key={`${b.isGroup ? 'g' : 'c'}-${b.id}`} className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 transition-all hover:border-slate-600 animate-in fade-in duration-200">
                  <div className="mb-4 flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: `${theme.color}20`, color: theme.color }}
                    >
                      {theme.icon ? <span>{theme.icon}</span> : b.isGroup ? <Users className="h-3 w-3" /> : <Tag className="h-3 w-3" />}
                      {theme.name}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBg} ${statusColor}`}>
                      {b.status?.replace(/_/g, ' ') || ''}
                    </span>
                  </div>

                  <div className="mb-1 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Total Spent</p>
                      <p className="text-lg font-bold text-white">{formatCurrency(b.spent, displayCurrency, currencyDisplayPreference)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Total Budget</p>
                      <p className="font-semibold text-slate-300">{formatCurrency(b.amount, displayCurrency, currencyDisplayPreference)}</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-900/50">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${progressColor}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{Math.round(b.utilization)}% utilized overall</span>
                    <span>
                      {isExceeded
                        ? `${formatCurrency(Math.abs(b.remaining), displayCurrency, currencyDisplayPreference)} over`
                        : `${formatCurrency(b.remaining, displayCurrency, currencyDisplayPreference)} left`}
                    </span>
                  </div>

                  {b.monthly.length > 0 ? (
                    <div className="mt-4 border-t border-slate-700/50 pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        By month
                      </p>
                      <div className="flex items-end gap-1.5" data-testid={`budget-monthly-${b.id || 'unassigned'}`}>
                        {b.monthly.map((m) => {
                          const mProgress = Math.min(100, Math.max(0, m.utilization));
                          const mColor =
                            m.status === 'exceeded' ? 'bg-red-500' : m.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
                          return (
                            <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${m.label}: ${Math.round(m.utilization)}% of ${formatCurrency(m.amount, displayCurrency, currencyDisplayPreference)}`}>
                              <div className="flex h-14 w-full items-end overflow-hidden rounded bg-slate-900/50">
                                <div
                                  className={`w-full rounded-t transition-all duration-500 ${mColor}`}
                                  style={{ height: `${Math.max(mProgress, 3)}%` }}
                                />
                              </div>
                              <span className="text-[9px] font-medium text-slate-500">{m.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <>
        {budgets?.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
            <div className="mb-4 rounded-full bg-slate-800 p-4">
              <Target className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-white">No budgets set</h3>
            <p className="text-slate-400">Set a budget to track your limits.</p>
            {onAddFirst ? (
              <button
                onClick={onAddFirst}
                className="mt-6 flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-cyan-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add First Budget
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {budgets?.map((b) => {
              const isGroup = !!b.category_group_id;
              const theme = isGroup ? getGroupTheme(b.category_group_id) : getCategoryTheme(b.category_id);
              const spent = isGroup
                ? spentByGroup.get(b.category_group_id ?? '') ?? 0
                : spentByCategory.get(b.category_id ?? '') ?? 0;

              const bAmount = parseFloat(b.amount.toString());
              const progress = Math.min(100, Math.max(0, (spent / bAmount) * 100));

              return (
                <div key={b.public_id} className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 transition-all hover:border-slate-600">
                  <div className="mb-4 flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: `${theme.color}20`, color: theme.color }}
                    >
                      {theme.icon ? <span>{theme.icon}</span> : isGroup ? <Users className="h-3 w-3" /> : <Tag className="h-3 w-3" />}
                      {theme.name}
                    </span>
                    <button
                      onClick={() => onEdit(b)}
                      className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300"
                      title="Edit Budget"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-1 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Spent this month</p>
                      <p className="text-lg font-bold text-white">{formatCurrency(spent, displayCurrency, currencyDisplayPreference)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Budget / month</p>
                      <p className="font-semibold text-slate-300">{formatCurrency(bAmount, displayCurrency, currencyDisplayPreference)}</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-900/50">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-red-500' : progress > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{formatBudgetRangeLabel(b.start_month, b.end_month)}</p>
                </div>
              );
            })}
          </div>
        )}
        {budgetsResponse && (
          <Pagination
            total={budgetsResponse.total}
            limit={budgetsResponse.limit}
            offset={budgetsResponse.offset}
            onPageChange={onPageChange}
          />
        )}
        </>
      )}
    </div>
  );
};

// Memoized presentational tab — see TransactionsTab for rationale.
export const BudgetsTab = React.memo(BudgetsTabImpl);
