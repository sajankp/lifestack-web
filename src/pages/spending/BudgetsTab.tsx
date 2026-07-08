import React from 'react';
import { Edit2, Tag, Target, Users } from 'lucide-react';
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
}

export const BudgetsTab: React.FC<BudgetsTabProps> = ({
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
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h3 className="text-xl font-semibold text-white">Budgets for {monthLabel}</h3>
      {budgets?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
          <div className="mb-4 rounded-full bg-slate-800 p-4">
            <Target className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">No budgets set</h3>
          <p className="text-slate-400">Set a budget to track your limits.</p>
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
    </div>
  );
};
