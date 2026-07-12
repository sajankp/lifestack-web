import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { investingService } from '../../services/investing';
import type {
  Dividend,
  DividendCreate,
  DividendIncomeType,
} from '../../types/investing';
import { DIVIDEND_INCOME_TYPES } from '../../types/investing';
import type { Account } from '../../types/finance';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate, formatDateInputValue } from '../../utils/dateFormat';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { queryKeys } from '../../lib/queryKeys';
import { DropdownSelect } from '../DropdownSelect';
import { Pagination } from '../Pagination';
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

const INCOME_TYPE_OPTIONS = DIVIDEND_INCOME_TYPES.map((t) => ({ value: t, label: t }));

// One server page at a time (spec-009), same size as the Orders tab.
const DIVIDENDS_PAGE_SIZE = 10;

interface DividendsSectionProps {
  accounts: Account[];
  accountFilter: string;
  currencyDisplayPreference: 'symbol' | 'code';
}

const emptyForm = () => ({
  account_id: '',
  symbol: '',
  income_type: 'dividend' as DividendIncomeType,
  gross_amount: '',
  tax_withheld: '',
  currency: 'USD',
  pay_date: formatDateInputValue(new Date()),
});

export const DividendsSection: React.FC<DividendsSectionProps> = ({
  accounts,
  accountFilter,
  currencyDisplayPreference,
}) => {
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
  const [pendingDelete, setPendingDelete] = useState<Dividend | null>(null);

  const [offset, setOffset] = useState(0);
  // A filter change on a later page must never strand the user on an empty
  // page — reset during render (React's adjust-state-on-prop-change pattern).
  // Use a local `pageOffset` for the query in this same render so the
  // transient pre-reset offset never keys a redundant fetch.
  const [prevAccountFilter, setPrevAccountFilter] = useState(accountFilter);
  let pageOffset = offset;
  if (prevAccountFilter !== accountFilter) {
    setPrevAccountFilter(accountFilter);
    setOffset(0);
    pageOffset = 0;
  }

  const dividendsRes = useQuery({
    queryKey: queryKeys.investing.dividends(accountFilter, pageOffset),
    queryFn: () =>
      investingService.getDividends(DIVIDENDS_PAGE_SIZE, pageOffset, accountFilter || undefined),
  });
  const dividends = useMemo(() => dividendsRes.data?.items ?? [], [dividendsRes.data]);
  const dividendsTotal = dividendsRes.data?.total ?? 0;
  // If the server total shrinks below the current offset (e.g. the last row
  // of the last page was deleted), snap back to the first page instead of
  // stranding an empty page with the pagination controls hidden.
  if (dividendsRes.data && offset > 0 && offset >= dividendsTotal) {
    setOffset(0);
  }

  const createMutation = useInvalidatingMutation(
    (data: DividendCreate) => investingService.createDividend(data),
    refreshKeys,
    {
      successMessage: 'Dividend recorded',
      onSuccess: () => {
        setForm(emptyForm());
        setIsModalOpen(false);
      },
    },
  );

  const deleteMutation = useInvalidatingMutation(
    (publicId: string) => investingService.deleteDividend(publicId),
    refreshKeys,
    { successMessage: 'Dividend deleted', onSuccess: () => setPendingDelete(null) },
  );


  const selectedAccount = brokerageAccounts.find((a) => a.public_id === form.account_id);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_id || !form.gross_amount || !form.pay_date) return;
    const gross = Number(form.gross_amount);
    if (!Number.isFinite(gross) || gross <= 0) return;
    const hasSymbol = form.income_type === 'dividend' || form.income_type === 'coupon';
    createMutation.mutate({
      account_id: form.account_id,
      // Interest is account-level income: never submit a symbol typed
      // before the user switched the income type (the field is hidden then).
      symbol: hasSymbol ? form.symbol.trim() || null : null,
      income_type: form.income_type,
      gross_amount: gross,
      tax_withheld: form.tax_withheld ? Number(form.tax_withheld) : 0,
      currency: form.currency.trim().toUpperCase(),
      pay_date: form.pay_date,
    });
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Dividends / Income ({dividendsTotal})
        </h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            asChild
          >
            <Link to="/imports?module=investing-dividends">
              <Upload className="h-4 w-4 mr-1" /> Bulk import
            </Link>
          </Button>
          <Button
            size="sm"
            data-testid="dividend-add-button"
            onClick={() => {
              setForm(emptyForm());
              setIsModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Record dividend
          </Button>
        </div>
      </div>

      {dividendsRes.isLoading ? (
        <SkeletonList rows={3} />
      ) : dividends.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dividends or income recorded yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Gross</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2 text-left">Pay date</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {dividends.map((d) => (
                <tr key={d.public_id} data-testid={`dividend-row-${d.public_id}`} className="border-t border-border/60">
                  <td className="px-3 py-2">{d.account_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.symbol ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.income_type}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(d.gross_amount, d.currency, currencyDisplayPreference)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatCurrency(d.tax_withheld, d.currency, currencyDisplayPreference)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-500 font-medium">
                    {formatCurrency(d.net_amount, d.currency, currencyDisplayPreference)}
                  </td>
                  <td className="px-3 py-2">{formatDate(d.pay_date)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      data-testid={`dividend-delete-${d.public_id}`}
                      className="text-muted-foreground hover:text-rose-500"
                      onClick={() => setPendingDelete(d)}
                      aria-label="Delete dividend"
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

      <Pagination
        total={dividendsTotal}
        limit={DIVIDENDS_PAGE_SIZE}
        offset={offset}
        onPageChange={setOffset}
      />

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && setIsModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record dividend / income</DialogTitle>
            <DialogDescription>
              Credits the account's cash directly — no offsetting transfer is created.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Account (brokerage only)</label>
              <DropdownSelect
                testId="dividend-account"
                value={form.account_id}
                options={accountDropdownOptions}
                onChange={(v) => {
                  const acc = brokerageAccounts.find((a) => a.public_id === v);
                  setForm((prev) => ({
                    ...prev,
                    account_id: v,
                    currency: acc?.default_currency_code ?? prev.currency,
                  }));
                }}
                placeholder="Select account"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Income type</label>
              <DropdownSelect
                testId="dividend-income-type"
                value={form.income_type}
                options={INCOME_TYPE_OPTIONS}
                onChange={(v) =>
                  setForm((prev) => ({ ...prev, income_type: v as DividendIncomeType }))
                }
                placeholder="Type"
              />
            </div>
            {form.income_type === 'dividend' || form.income_type === 'coupon' ? (
              <div>
                <label className="text-xs text-muted-foreground">Symbol</label>
                <input
                  data-testid="dividend-symbol"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.symbol}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. NVDA"
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Gross amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  data-testid="dividend-gross-amount"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.gross_amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, gross_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tax withheld</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  data-testid="dividend-tax-withheld"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.tax_withheld}
                  onChange={(e) => setForm((prev) => ({ ...prev, tax_withheld: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Pay date</label>
              <input
                type="date"
                required
                data-testid="dividend-pay-date"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.pay_date}
                onChange={(e) => setForm((prev) => ({ ...prev, pay_date: e.target.value }))}
              />
            </div>
            {form.account_id && form.gross_amount ? (
              <p className="text-xs text-muted-foreground">
                Net credit:{' '}
                {formatCurrency(
                  Math.max(0, Number(form.gross_amount || 0) - Number(form.tax_withheld || 0)),
                  selectedAccount?.default_currency_code ?? form.currency,
                  currencyDisplayPreference,
                )}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="dividend-save" disabled={createMutation.isPending}>
                Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete dividend?</DialogTitle>
            <DialogDescription>
              This reverses the cash credit it created. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="dividend-confirm-delete"
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
