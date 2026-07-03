import React from 'react';
import { Clock, Edit2, Plus, RefreshCw, Tag, ToggleLeft } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { describeRecurrence } from '../../utils/recurrenceLabel';
import type { PaginatedResponse } from '../../types/common';
import type { RecurringTransaction } from '../../types/spending';
import { formatDueDate } from './format';

interface RecurringTabProps {
  recurringItems: RecurringTransaction[];
  recurringResponse: PaginatedResponse<RecurringTransaction> | undefined;
  displayCurrency: string;
  currencyDisplayPreference: 'symbol' | 'code';
  getCategoryTheme: (catId: string) => { name: string; color: string; icon: string | null };
  onOpenNew: () => void;
  onEdit: (r: RecurringTransaction) => void;
  onRequestDeactivate: (rule: { publicId: string; description: string }) => void;
  deactivateMutationPending: boolean;
  pendingDeactivate: { publicId: string; description: string } | null;
  onCancelDeactivate: () => void;
  onConfirmDeactivate: () => void;
  onPageChange: (offset: number) => void;
}

export const RecurringTab: React.FC<RecurringTabProps> = ({
  recurringItems,
  recurringResponse,
  displayCurrency,
  currencyDisplayPreference,
  getCategoryTheme,
  onOpenNew,
  onEdit,
  onRequestDeactivate,
  deactivateMutationPending,
  pendingDeactivate,
  onCancelDeactivate,
  onConfirmDeactivate,
  onPageChange,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h3 className="text-xl font-semibold text-white">Recurring Rules</h3>
      {recurringItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
          <div className="mb-4 rounded-full bg-slate-800 p-4">
            <RefreshCw className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">No recurring rules yet</h3>
          <p className="text-slate-400">Set up recurring transactions for rent, subscriptions, or salary.</p>
          <button
            onClick={onOpenNew}
            className="mt-6 flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-cyan-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add First Rule
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recurringItems.map((r) => {
            const catTheme = getCategoryTheme(r.category_id);
            const isIncome = r.type === 'income';
            const dueInfo = formatDueDate(r.next_due_date);
            return (
              <div
                key={r.public_id}
                data-testid={`spending-recurring-rule-${r.public_id}`}
                className="group flex flex-col gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 backdrop-blur-sm transition-all hover:border-slate-600 hover:bg-slate-800/60"
              >
                {/* Category + Type row */}
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ backgroundColor: `${catTheme.color}20`, color: catTheme.color }}
                  >
                    {catTheme.icon ? <span>{catTheme.icon}</span> : <Tag className="h-3 w-3" />}
                    {catTheme.name}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isIncome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {isIncome ? 'Income' : 'Expense'}
                  </span>
                </div>

                {/* Amount */}
                <div>
                  <p
                    className={`text-2xl font-bold ${
                      isIncome ? 'text-emerald-400' : 'text-white'
                    }`}
                  >
                    {isIncome ? '+' : '-'}{formatCurrency(Number(r.amount), displayCurrency, currencyDisplayPreference)}
                  </p>
                  {r.description && (
                    <p className="mt-0.5 text-sm text-slate-400 truncate">{r.description}</p>
                  )}
                </div>

                {/* Frequency + Next due */}
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {describeRecurrence(r)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dueInfo.color}`}>
                    {dueInfo.label}
                  </span>
                </div>

                {/* Last generated */}
                {r.last_generated_at && !Number.isNaN(Date.parse(r.last_generated_at)) && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    Last generated {formatDate(r.last_generated_at)}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-slate-700/50 pt-3">
                  <button
                    data-testid={`spending-recurring-edit-${r.public_id}`}
                    onClick={() => onEdit(r)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    data-testid="spending-recurring-deactivate"
                    onClick={() =>
                      onRequestDeactivate({
                        publicId: r.public_id,
                        description: r.description || 'this recurring rule',
                      })
                    }
                    disabled={deactivateMutationPending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Deactivate this rule"
                  >
                    <ToggleLeft className="h-3.5 w-3.5" /> Deactivate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {recurringResponse && (
        <Pagination
          total={recurringResponse.total}
          limit={recurringResponse.limit}
          offset={recurringResponse.offset}
          onPageChange={onPageChange}
        />
      )}
      <Dialog
        open={!!pendingDeactivate}
        onOpenChange={(open) => !open && onCancelDeactivate()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate recurring rule?</DialogTitle>
            <DialogDescription>
              {pendingDeactivate
                ? `Deactivate "${pendingDeactivate.description}"? Future recurring transactions will stop generating.`
                : 'Future recurring transactions will stop generating.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onCancelDeactivate}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-rose-300 hover:text-rose-200"
              onClick={onConfirmDeactivate}
              disabled={deactivateMutationPending}
            >
              {deactivateMutationPending ? 'Deactivating...' : 'Deactivate rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
