import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Upload } from 'lucide-react';
import { investingService } from '../../services/investing';
import type {
  Dividend,
  DividendBulkImportRow,
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
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkCsv, setBulkCsv] = useState('');
  const [bulkResult, setBulkResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    rejected: { row: number; reason: string }[];
  } | null>(null);

  const dividendsRes = useQuery({
    queryKey: queryKeys.investing.dividends(accountFilter),
    queryFn: () => investingService.getDividends(200, 0, accountFilter || undefined),
  });
  const dividends = useMemo(() => dividendsRes.data?.items ?? [], [dividendsRes.data]);

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

  const bulkImportMutation = useInvalidatingMutation(
    (rows: DividendBulkImportRow[]) => investingService.bulkImportDividends(rows),
    refreshKeys,
    {
      successMessage: 'Bulk import complete',
      onSuccess: (result) => setBulkResult(result),
    },
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

  const parseCsv = (text: string): DividendBulkImportRow[] => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const [header, ...rows] = lines;
    const cols = header.split(',').map((c) => c.trim().toLowerCase());
    return rows.map((line) => {
      const values = line.split(',').map((v) => v.trim());
      const get = (name: string) => {
        const idx = cols.indexOf(name);
        return idx >= 0 ? values[idx] : undefined;
      };
      const accountNameOrId = get('account') ?? '';
      const account = brokerageAccounts.find(
        (a) => a.public_id === accountNameOrId || a.name === accountNameOrId,
      );
      return {
        account_id: account?.public_id ?? accountNameOrId,
        symbol: get('symbol') || null,
        income_type: (get('income_type') as DividendIncomeType) || 'dividend',
        gross_amount: Number(get('gross') ?? get('gross_amount') ?? '0'),
        tax_withheld: Number(get('tax') ?? get('tax_withheld') ?? '0'),
        currency: (get('currency') || 'USD').toUpperCase(),
        pay_date: get('pay_date') || '',
        external_ref: get('external_ref') || null,
      };
    });
  };

  const onBulkImport = () => {
    const rows = parseCsv(bulkCsv);
    if (rows.length === 0) return;
    bulkImportMutation.mutate(rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Dividends / Income</h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setBulkResult(null);
              setBulkCsv('');
              setIsBulkModalOpen(true);
            }}
          >
            <Upload className="h-4 w-4 mr-1" /> Bulk import
          </Button>
          <Button
            size="sm"
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
                <tr key={d.public_id} className="border-t border-border/60">
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
              <Button type="submit" disabled={createMutation.isPending}>
                Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkModalOpen} onOpenChange={(open) => !open && setIsBulkModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk import dividends</DialogTitle>
            <DialogDescription>
              Paste CSV with headers:
              account,symbol,income_type,gross,tax,currency,pay_date,external_ref. Rows with an
              external_ref upsert on re-upload; without one, an exact re-upload is a no-op and a
              changed amount at the same (account, symbol, pay_date) is rejected.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            value={bulkCsv}
            onChange={(e) => setBulkCsv(e.target.value)}
            placeholder="account,symbol,income_type,gross,tax,currency,pay_date,external_ref"
          />
          {bulkResult ? (
            <div className="text-xs space-y-1">
              <p>
                Imported {bulkResult.imported}, updated {bulkResult.updated}, skipped{' '}
                {bulkResult.skipped}, rejected {bulkResult.rejected.length}
              </p>
              {bulkResult.rejected.map((r) => (
                <p key={r.row} className="text-rose-500">
                  Row {r.row}: {r.reason}
                </p>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsBulkModalOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={onBulkImport} disabled={bulkImportMutation.isPending}>
              Import
            </Button>
          </DialogFooter>
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
