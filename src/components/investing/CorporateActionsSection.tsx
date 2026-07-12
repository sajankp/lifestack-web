import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { investingService } from '../../services/investing';
import type {
  CorporateAction,
  CorporateActionCreate,
  CorporateActionType,
} from '../../types/investing';
import type { Account } from '../../types/finance';
import { formatDate, formatDateInputValue } from '../../utils/dateFormat';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { queryKeys } from '../../lib/queryKeys';
import { DropdownSelect } from '../DropdownSelect';
import { Button } from '../ui/button';
import { SkeletonList } from '../ui/FeedbackStates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const refreshKeys = [queryKeys.investing.all, queryKeys.finance.all, queryKeys.dashboard.all];

const ACTION_TYPE_OPTIONS = [
  { value: 'split', label: 'Split / reverse split' },
  { value: 'bonus', label: 'Bonus issue' },
];

// Ratio semantics are action_type-dependent (spec-051/spec-008 INV-2): a
// split renders "N old -> M new"; a bonus renders "M free per N held". A
// bonus must never be rendered with split phrasing or vice versa.
const describeRatio = (action: CorporateAction): string => {
  const base = String(action.ratio_base);
  const quote = String(action.ratio_quote);
  return action.action_type === 'bonus'
    ? `${quote} free per ${base} held`
    : `${base} old → ${quote} new`;
};

const emptyForm = () => ({
  account_id: '',
  symbol: '',
  action_type: 'split' as CorporateActionType,
  ratio_base: '1',
  ratio_quote: '1',
  ex_date: formatDateInputValue(new Date()),
  notes: '',
});

interface CorporateActionsSectionProps {
  accounts: Account[];
  accountFilter: string;
}

export const CorporateActionsSection: React.FC<CorporateActionsSectionProps> = ({
  accounts,
  accountFilter,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const brokerageAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'brokerage'),
    [accounts],
  );
  const accountDropdownOptions = useMemo(
    () => brokerageAccounts.map((a) => ({ value: a.public_id, label: a.name })),
    [brokerageAccounts],
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [pendingDelete, setPendingDelete] = useState<CorporateAction | null>(null);

  const actionsRes = useQuery({
    queryKey: queryKeys.investing.corporateActions(accountFilter),
    queryFn: () => investingService.getCorporateActions(200, 0, accountFilter || undefined),
    enabled: isExpanded,
  });
  const actions = useMemo(() => actionsRes.data?.items ?? [], [actionsRes.data]);

  const holdingsRes = useQuery({
    queryKey: queryKeys.investing.holdings(),
    queryFn: () => investingService.getHoldings(200, 0),
    enabled: isModalOpen,
  });
  const heldQuantity = useMemo(() => {
    const match = (holdingsRes.data?.items ?? []).find(
      (h) =>
        h.account_id === form.account_id &&
        h.symbol.toUpperCase() === form.symbol.trim().toUpperCase(),
    );
    return match ? Number(match.quantity) : 0;
  }, [holdingsRes.data, form.account_id, form.symbol]);

  const createMutation = useInvalidatingMutation(
    (data: CorporateActionCreate) => investingService.createCorporateAction(data),
    refreshKeys,
    {
      successMessage: 'Corporate action recorded',
      onSuccess: () => {
        setForm(emptyForm());
        setIsModalOpen(false);
      },
    },
  );

  const deleteMutation = useInvalidatingMutation(
    (publicId: string) => investingService.deleteCorporateAction(publicId),
    refreshKeys,
    { successMessage: 'Corporate action deleted', onSuccess: () => setPendingDelete(null) },
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_id || !form.symbol.trim() || !form.ex_date) return;
    const base = Number(form.ratio_base);
    const quote = Number(form.ratio_quote);
    if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(quote) || quote <= 0) return;
    createMutation.mutate({
      account_id: form.account_id,
      symbol: form.symbol.trim().toUpperCase(),
      action_type: form.action_type,
      ratio_base: base,
      ratio_quote: quote,
      ex_date: form.ex_date,
      notes: form.notes.trim() || null,
    });
  };

  const ratioBaseNum = Number(form.ratio_base) || 0;
  const ratioQuoteNum = Number(form.ratio_quote) || 0;
  const previewResult =
    form.action_type === 'bonus'
      ? `+${((heldQuantity * ratioQuoteNum) / (ratioBaseNum || 1)).toFixed(4)} bonus units (illustrative)`
      : `${heldQuantity} units → ${((heldQuantity * ratioQuoteNum) / (ratioBaseNum || 1)).toFixed(4)} units (illustrative)`;

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        data-testid="corporate-actions-toggle"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Corporate actions (splits / bonus issues)
        </span>
      </button>

      {isExpanded ? (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              data-testid="corporate-action-add-button"
              onClick={() => {
                setForm(emptyForm());
                setIsModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Record corporate action
            </Button>
          </div>

          {actionsRes.isLoading ? (
            <SkeletonList rows={2} />
          ) : actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No corporate actions recorded yet.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-left">Symbol</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Ratio</th>
                    <th className="px-3 py-2 text-left">Ex-date</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.public_id} data-testid={`corporate-action-row-${a.public_id}`} className="border-t border-border/60">
                      <td className="px-3 py-2">{a.account_name}</td>
                      <td className="px-3 py-2">{a.symbol}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {a.action_type === 'bonus' ? 'Bonus' : 'Split'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{describeRatio(a)}</td>
                      <td className="px-3 py-2">{formatDate(a.ex_date)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          data-testid={`corporate-action-delete-${a.public_id}`}
                          className="text-muted-foreground hover:text-rose-500"
                          onClick={() => setPendingDelete(a)}
                          aria-label="Delete corporate action"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record corporate action</DialogTitle>
            <DialogDescription>
              Splits and bonus issues are replayed against FIFO lots by ex-date. No cash impact.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Account (brokerage only)</label>
              <DropdownSelect
                testId="corporate-action-account"
                value={form.account_id}
                options={accountDropdownOptions}
                onChange={(v) => setForm((prev) => ({ ...prev, account_id: v }))}
                placeholder="Select account"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Symbol</label>
              <input
                data-testid="corporate-action-symbol"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.symbol}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. NVDA"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Action type</label>
              <DropdownSelect
                testId="corporate-action-type"
                value={form.action_type}
                options={ACTION_TYPE_OPTIONS}
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, action_type: v as CorporateActionType }))
                }
                placeholder="Type"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  {form.action_type === 'bonus' ? 'Held units (base)' : 'Old units (base)'}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  data-testid="corporate-action-ratio-base"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.ratio_base}
                  onChange={(e) => setForm((prev) => ({ ...prev, ratio_base: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  {form.action_type === 'bonus' ? 'Free units (quote)' : 'New units (quote)'}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  data-testid="corporate-action-ratio-quote"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.ratio_quote}
                  onChange={(e) => setForm((prev) => ({ ...prev, ratio_quote: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ex-date</label>
              <input
                type="date"
                required
                data-testid="corporate-action-ex-date"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.ex_date}
                onChange={(e) => setForm((prev) => ({ ...prev, ex_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes (optional)</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Preview (illustrative — actual effect computed by backend replay): {previewResult}
            </p>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="corporate-action-save" disabled={createMutation.isPending}>
                Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete corporate action?</DialogTitle>
            <DialogDescription>
              Deleting recomputes this symbol&apos;s holdings and realized gains from scratch (full
              replay). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="corporate-action-confirm-delete"
              disabled={deleteMutation.isPending}
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.public_id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
