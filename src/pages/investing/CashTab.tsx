import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Plus, Trash2 } from 'lucide-react';
import { financeService } from '../../services/finance';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { investingService } from '../../services/investing';
import type { CashBalance } from '../../services/investing';
import { toNumber } from '../../utils/numberFormat';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { FormattedNumberInput } from '../../components/ui/formatted-number-input';
import { formatDate, formatDateTime } from '../../utils/dateFormat';
import { DateTimePicker } from '../../components/DateTimePicker';
import { CompactFilterBar, CompactFilterField } from '../../components/filters/CompactFilterBar';
import { queryKeys } from '../../lib/queryKeys';
import { DropdownSelect } from '../../components/DropdownSelect';
import { Pagination } from '../../components/Pagination';
import { Combobox } from '../../components/Combobox';
import { Button } from '../../components/ui/button';
import { SkeletonList } from '../../components/ui/FeedbackStates';
import { TransferModal } from '../../components/finance/TransferModal';
import { DividendsSection } from '../../components/investing/DividendsSection';
import { QuickCreateAccountForm } from '../../components/finance/QuickCreateAccountForm';
import { ReconciliationCard } from '../../components/finance/ReconciliationCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import type { CashBalanceCreate } from '../../types/investing';
import { formatDateTimeLocalInput } from './format';

const refreshKeys = [queryKeys.investing.all, queryKeys.finance.all, queryKeys.dashboard.all];

// Every section on this tab is bounded to one server/client page (spec-009)
// so the page height stays constant and no section's reachability depends on
// another section's data volume. Same size as the Orders tab.
const CASH_PAGE_SIZE = 10;

interface CashTabProps {
  currencyDisplayPreference: 'symbol' | 'code';
}

export const CashTab: React.FC<CashTabProps> = ({ currencyDisplayPreference }) => {
  const formatCurrency = useCurrencyFormatter();
  const [cashAccountFilter, setCashAccountFilter] = useState('');
  const [cashOffset, setCashOffset] = useState(0);
  const [transfersOffset, setTransfersOffset] = useState(0);

  // A filter change on page 3 must never strand the user on an empty page.
  const onAccountFilterChange = (value: string) => {
    setCashAccountFilter(value);
    setCashOffset(0);
    setTransfersOffset(0);
  };

  const [isAddCashModalOpen, setIsAddCashModalOpen] = useState(false);
  const [cashForm, setCashForm] = useState({
    account_id: '',
    balance: '',
    currency: 'USD',
    as_of: formatDateTimeLocalInput(new Date()),
  });
  const [pendingDeleteCash, setPendingDeleteCash] = useState<CashBalance | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<
    'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card'
  >('brokerage');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const cashRes = useQuery({
    // account_id is a server-side filter (not just client-side), so switching
    // accounts fetches that account's full history instead of relying on
    // whatever happens to be in the current page ordered by as_of desc --
    // an old backfilled snapshot can otherwise be invisible past that window.
    // One server page at a time (spec-009), like the Orders tab.
    queryKey: queryKeys.investing.cashBalances(cashAccountFilter, cashOffset),
    queryFn: () =>
      investingService.getCashBalances(CASH_PAGE_SIZE, cashOffset, cashAccountFilter || undefined),
  });

  const currenciesRes = useQuery({
    queryKey: queryKeys.finance.currencies(),
    queryFn: () => financeService.getCurrencies(),
  });
  const currencies = useMemo(() => currenciesRes.data ?? [], [currenciesRes.data]);
  const currencyOptions = useMemo(() => currencies.map((currency) => currency.code), [currencies]);
  const currencyDropdownOptions = useMemo(
    () => currencyOptions.map((code) => ({ value: code, label: code })),
    [currencyOptions],
  );

  const accountsRes = useQuery({
    queryKey: queryKeys.finance.accounts(),
    queryFn: () => financeService.getAccounts(200, 0),
  });
  const accounts = useMemo(() => accountsRes.data?.items ?? [], [accountsRes.data]);
  const accountOptions = useMemo(() => accounts.map((account) => account.name), [accounts]);
  const accountDropdownOptions = useMemo(
    () => accounts.map((acc) => ({ value: acc.public_id, label: acc.name })),
    [accounts],
  );
  const userFinanceSettingsRes = useQuery({
    queryKey: queryKeys.finance.settings('user'),
    queryFn: () => financeService.getUserSettings(),
  });
  const userFinanceSettings = userFinanceSettingsRes.data;
  const preferredWorkspaceCurrency =
    (userFinanceSettings?.effective_reporting_currency_code &&
    currencyOptions.includes(userFinanceSettings.effective_reporting_currency_code)
      ? userFinanceSettings.effective_reporting_currency_code
      : null) ??
    currencyOptions[0] ??
    'USD';

  const selectedCashAccount = cashForm.account_id;
  const selectedCashCurrency = currencyOptions.includes(cashForm.currency)
    ? cashForm.currency
    : preferredWorkspaceCurrency;

  // Transfers are surfaced read-only on the Cash tab for reconciliation
  // context; full transfer CRUD stays in Spending.
  const transfersRes = useQuery({
    queryKey: queryKeys.finance.transfers('cash-tab'),
    queryFn: () => financeService.getTransfers(200, 0),
  });

  // Per-account reconciliation (projected-from-flows vs latest snapshot).
  // Only meaningful once a single account is selected in the Cash filter.
  const reconciliationRes = useQuery({
    queryKey: queryKeys.finance.reconciliation(cashAccountFilter),
    queryFn: () => financeService.getAccountReconciliation(cashAccountFilter),
    enabled: cashAccountFilter !== '',
  });

  const createCashMutation = useInvalidatingMutation(
    (payload: CashBalanceCreate) => investingService.createCashBalance(payload),
    refreshKeys,
    {
      successMessage: 'Cash balance added',
      onSuccess: () => {
        setCashForm({
          account_id: cashForm.account_id,
          balance: '',
          currency: cashForm.currency,
          as_of: formatDateTimeLocalInput(new Date()),
        });
        setIsAddCashModalOpen(false);
      },
    },
  );

  const deleteCashMutation = useInvalidatingMutation(
    (publicId: string) => investingService.deleteCashBalance(publicId),
    refreshKeys,
    {
      successMessage: 'Cash balance deleted',
      errorMessage: false,
      onSuccess: () => setPendingDeleteCash(null),
    },
  );

  const createAccountMutation = useInvalidatingMutation(
    () =>
      financeService.createAccount({
        name: newAccountName.trim(),
        account_type: newAccountType,
        default_currency_code: selectedCashCurrency,
      }),
    refreshKeys,
    {
      successMessage: 'Account created',
      onSuccess: (created) => {
        setNewAccountName('');
        setCashForm((prev) => ({ ...prev, account_id: created.public_id }));
      },
    },
  );

  const confirmDeleteCash = () => {
    if (!pendingDeleteCash) return;
    deleteCashMutation.mutate(pendingDeleteCash.public_id);
  };

  // With server-side pagination, client-side sorting and currency filtering
  // would silently operate on the current 10 rows only — misleading, so both
  // were removed (spec-009 rev. 2 / PR review). The server's as_of-desc order
  // is the natural one for a history feed, and the server-side account
  // filter subsumes the currency filter under spec-050's one-currency-per-
  // account rule.
  const cashBalances = useMemo(() => cashRes.data?.items ?? [], [cashRes.data]);
  const cashTotal = cashRes.data?.total ?? 0;

  // If the server total shrinks below the current offset (e.g. deletions),
  // snap back to the first page instead of stranding an empty page with the
  // pagination controls hidden.
  if (cashRes.data && cashOffset > 0 && cashOffset >= cashTotal) {
    setCashOffset(0);
  }

  const transfers = useMemo(() => transfersRes.data?.items ?? [], [transfersRes.data]);
  const visibleTransfers = useMemo(
    () =>
      transfers.filter(
        (t) =>
          !cashAccountFilter ||
          t.from_account_public_id === cashAccountFilter ||
          t.to_account_public_id === cashAccountFilter,
      ),
    [transfers, cashAccountFilter],
  );
  // /finance/transfers has no server-side account filter, so this read-only
  // contextual list filters client-side and pages client-side over the
  // fetched window (filter first, then slice) — spec-009. Full history
  // lives in Spending. The offset is clamped so a shrinking list can never
  // strand the user on an empty page (PR review).
  const safeTransfersOffset = transfersOffset >= visibleTransfers.length ? 0 : transfersOffset;
  const pagedTransfers = useMemo(
    () => visibleTransfers.slice(safeTransfersOffset, safeTransfersOffset + CASH_PAGE_SIZE),
    [visibleTransfers, safeTransfersOffset],
  );

  const onCreateCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashForm.balance || !cashForm.as_of || !selectedCashAccount) return;

    const balance = Number(cashForm.balance);
    if (!Number.isFinite(balance)) return;
    const asOfDate = new Date(cashForm.as_of);
    if (Number.isNaN(asOfDate.getTime())) return;

    createCashMutation.mutate({
      account_id: selectedCashAccount,
      balance,
      currency: selectedCashCurrency.trim().toUpperCase() || 'USD',
      as_of: asOfDate.toISOString(),
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-6">
          {/* One account filter scopes reconciliation, balances and
              transfers below, so the tab reads as a single account story.
              Orders moved to its own tab with its own account filter. */}
          <CompactFilterBar title="Cash filters" onReset={() => onAccountFilterChange('')}>
            <CompactFilterField label="Account">
              <DropdownSelect
                testId="investing-cash-account-filter"
                value={cashAccountFilter}
                options={accountDropdownOptions}
                onChange={onAccountFilterChange}
                placeholder="All accounts"
                clearLabel="All accounts"
              />
            </CompactFilterField>
          </CompactFilterBar>

          {/* Reconciliation ties a snapshot to the flows that explain it:
              projected-from-flows vs the latest cash snapshot. */}
          {cashAccountFilter !== '' && (
            <div data-testid="investing-cash-reconciliation">
              {reconciliationRes.isLoading ? (
                <p className="text-sm text-slate-400">Loading reconciliation…</p>
              ) : reconciliationRes.data ? (
                <ReconciliationCard
                  reconciliation={reconciliationRes.data}
                  currencyDisplayPreference={currencyDisplayPreference}
                  testIdPrefix="investing-reconciliation"
                />
              ) : (
                <p className="text-sm text-slate-400">Reconciliation unavailable.</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div
            data-testid="investing-cash-heading"
            className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <h3 className="font-semibold text-white text-base">Cash Balances ({cashTotal})</h3>
            <div className="flex w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsAddCashModalOpen(true)}
                className="flex w-full items-center justify-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 sm:w-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Cash Balance
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Mobile / tablet card list */}
            <div className="space-y-3 lg:hidden">
              {cashRes.isLoading ? (
                <SkeletonList rows={3} />
              ) : cashBalances.length === 0 ? (
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 text-center text-sm text-slate-400">
                  No cash balances yet.
                </div>
              ) : (
                cashBalances.map((c) => (
                  <div
                    key={c.public_id}
                    className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{c.account_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(c.as_of)}</p>
                      </div>
                      <button
                        disabled={deleteCashMutation.isPending}
                        onClick={() => setPendingDeleteCash(c)}
                        className="shrink-0 rounded-lg border border-rose-500/40 p-2 text-rose-300 hover:bg-rose-500/10"
                        title="Delete cash balance"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-lg font-semibold text-slate-100">
                        {formatCurrency(c.balance, c.currency, currencyDisplayPreference)}
                      </span>
                      {c.trigger_type ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.trigger_type === 'transfer'
                              ? 'bg-blue-500/20 text-blue-300'
                              : c.trigger_type === 'order'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {c.trigger_type.charAt(0).toUpperCase() + c.trigger_type.slice(1)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 lg:block">
              <table className="w-full text-left text-sm text-slate-300 min-w-[600px]">
                <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">As Of</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {cashRes.isLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-400" colSpan={4}>
                        Loading cash balances…
                      </td>
                    </tr>
                  ) : cashBalances.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-400" colSpan={4}>
                        No cash balances yet.
                      </td>
                    </tr>
                  ) : (
                    cashBalances.map((c) => (
                      <tr key={c.public_id}>
                        <td className="px-4 py-3 text-white">{c.account_name}</td>
                        <td className="px-4 py-3">
                          {formatCurrency(c.balance, c.currency, currencyDisplayPreference)}
                        </td>
                        <td className="px-4 py-3">{formatDateTime(c.as_of)}</td>
                        <td className="px-4 py-3">
                          {c.trigger_type && (
                            <span
                              data-testid={`cash-balance-trigger-type-${c.public_id}`}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                c.trigger_type === 'transfer'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : c.trigger_type === 'order'
                                    ? 'bg-indigo-500/20 text-indigo-300'
                                    : 'bg-slate-700/50 text-slate-400'
                              }`}
                            >
                              {c.trigger_type.charAt(0).toUpperCase() + c.trigger_type.slice(1)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            aria-label="Delete cash balance"
                            disabled={deleteCashMutation.isPending}
                            onClick={() => setPendingDeleteCash(c)}
                            className="rounded-lg border border-rose-500/40 p-2 text-rose-300 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              total={cashTotal}
              limit={CASH_PAGE_SIZE}
              offset={cashOffset}
              onPageChange={setCashOffset}
            />
          </div>

          {/* Dividends / income before the read-only transfers context:
              actionable sections come first (spec-009 reachability order). */}
          <div className="rounded-lg border border-border p-4">
            <DividendsSection
              accounts={accounts}
              accountFilter={cashAccountFilter}
              currencyDisplayPreference={currencyDisplayPreference}
            />
          </div>

          {/* Transfers moving cash in/out of the selected account — this list
              stays read-only (full history lives in Spending's Account
              activity tab), but Transfer is a shared action so creating one
              no longer requires leaving Investing (UX-REVIEW Theme 3). */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-base">
                Transfers ({visibleTransfers.length})
              </h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  data-testid="investing-transfer-btn"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Transfer
                </button>
                <Link
                  to="/spending?tab=ledger"
                  data-testid="investing-transfers-manage-link"
                  className="text-xs font-medium text-slate-400 hover:text-slate-300"
                >
                  View full history →
                </Link>
              </div>
            </div>
            {/* Mobile / tablet card list */}
            <div className="space-y-3 lg:hidden">
              {transfersRes.isLoading ? (
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 text-center text-sm text-slate-400">
                  Loading…
                </div>
              ) : visibleTransfers.length === 0 ? (
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 text-center text-sm text-slate-400">
                  No transfers for this account yet.
                </div>
              ) : (
                pagedTransfers.map((t) => {
                  const isOut =
                    cashAccountFilter !== ''
                      ? t.from_account_public_id === cashAccountFilter
                      : t.from_module === 'investing' && t.to_module === 'spending';
                  const isIn =
                    cashAccountFilter !== ''
                      ? t.to_account_public_id === cashAccountFilter
                      : t.from_module === 'spending' && t.to_module === 'investing';
                  return (
                    <div
                      key={t.public_id}
                      className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">
                          {formatDate(t.occurred_at, { fallback: 'N/A' })}
                        </span>
                        {isOut ? (
                          <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300">
                            OUT
                          </span>
                        ) : isIn ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                            IN
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        {t.from_account_name ?? '—'} → {t.to_account_name ?? '—'}
                      </p>
                      <div className="mt-2 flex items-end justify-between gap-3 text-xs text-slate-400">
                        <span>
                          Gross{' '}
                          <span className="text-slate-200">
                            {formatCurrency(
                              toNumber(t.gross_amount),
                              t.from_currency_code,
                              currencyDisplayPreference,
                            )}
                          </span>
                        </span>
                        <span className="text-right">
                          Net{' '}
                          <span className="font-semibold text-white">
                            {formatCurrency(
                              toNumber(t.net_amount_received),
                              t.to_currency_code,
                              currencyDisplayPreference,
                            )}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 lg:block">
              <table className="w-full text-left text-sm text-slate-300 min-w-[600px]">
                <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Direction</th>
                    <th className="px-4 py-3">From → To</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">Net received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {transfersRes.isLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-400" colSpan={5}>
                        Loading…
                      </td>
                    </tr>
                  ) : visibleTransfers.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-400" colSpan={5}>
                        No transfers for this account yet.
                      </td>
                    </tr>
                  ) : (
                    pagedTransfers.map((t) => {
                      // With an account selected, direction is relative to that
                      // account; in the all-accounts view, fall back to direction
                      // relative to the investing module.
                      const isOut =
                        cashAccountFilter !== ''
                          ? t.from_account_public_id === cashAccountFilter
                          : t.from_module === 'investing' && t.to_module === 'spending';
                      const isIn =
                        cashAccountFilter !== ''
                          ? t.to_account_public_id === cashAccountFilter
                          : t.from_module === 'spending' && t.to_module === 'investing';
                      return (
                        <tr key={t.public_id} data-testid={`investing-transfer-row-${t.public_id}`}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatDate(t.occurred_at, { fallback: 'N/A' })}
                          </td>
                          <td className="px-4 py-3">
                            {isOut ? (
                              <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300">
                                OUT
                              </span>
                            ) : isIn ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                                IN
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {t.from_account_name ?? '—'} → {t.to_account_name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(
                              toNumber(t.gross_amount),
                              t.from_currency_code,
                              currencyDisplayPreference,
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-white">
                            {formatCurrency(
                              toNumber(t.net_amount_received),
                              t.to_currency_code,
                              currencyDisplayPreference,
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              total={visibleTransfers.length}
              limit={CASH_PAGE_SIZE}
              offset={safeTransfersOffset}
              onPageChange={setTransfersOffset}
            />
          </div>
        </div>
      </div>

      {/* Add Cash Modal */}
      <Dialog
        open={isAddCashModalOpen}
        onOpenChange={(open) => !open && setIsAddCashModalOpen(false)}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 mb-4 border-b border-slate-800">
            <DialogTitle>Add Cash Balance</DialogTitle>
          </DialogHeader>
          {isAddCashModalOpen && (
            <form onSubmit={onCreateCash} className="space-y-4">
              {accountOptions.length === 0 ? (
                <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-3 text-xs text-amber-200 animate-none">
                  Create an account below before adding cash balances.
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Account</label>
                  <Combobox
                    value={selectedCashAccount}
                    options={accountDropdownOptions}
                    onChange={(value) => setCashForm((s) => ({ ...s, account_id: value }))}
                    placeholder="Select account"
                    searchPlaceholder="Search accounts..."
                    clearLabel="Clear selection"
                    emptyText="No accounts found."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Balance</label>
                  <FormattedNumberInput
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="Balance"
                    step="0.01"
                    value={cashForm.balance}
                    onChange={(e) => setCashForm((s) => ({ ...s, balance: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Currency</label>
                  <DropdownSelect
                    value={selectedCashCurrency}
                    options={currencyDropdownOptions}
                    onChange={(value) => setCashForm((s) => ({ ...s, currency: value }))}
                    placeholder="Currency"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">As Of</label>
                  <DateTimePicker
                    value={cashForm.as_of}
                    onChange={(value) => setCashForm((s) => ({ ...s, as_of: value }))}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddCashModalOpen(false)}
                  className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={createCashMutation.isPending || accountOptions.length === 0}
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {createCashMutation.isPending ? 'Adding...' : 'Add Cash Balance'}
                </button>
              </div>

              <QuickCreateAccountForm
                name={newAccountName}
                onNameChange={setNewAccountName}
                type={newAccountType}
                onTypeChange={setNewAccountType}
                onSubmit={() => createAccountMutation.mutate()}
                isPending={createAccountMutation.isPending}
                isError={createAccountMutation.isError}
                testIdPrefix="investing-account"
              />
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingDeleteCash}
        onOpenChange={(open) =>
          !open && !deleteCashMutation.isPending && setPendingDeleteCash(null)
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete cash balance entry?</DialogTitle>
            <DialogDescription>
              {pendingDeleteCash
                ? `Delete this ${formatCurrency(
                    toNumber(pendingDeleteCash.balance),
                    pendingDeleteCash.currency,
                    currencyDisplayPreference,
                  )} cash balance entry for ${pendingDeleteCash.account_name}?`
                : 'This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingDeleteCash(null)}
              disabled={deleteCashMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-rose-300 hover:text-rose-200"
              onClick={confirmDeleteCash}
              disabled={deleteCashMutation.isPending}
            >
              {deleteCashMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
          {deleteCashMutation.isError && (
            <p className="mt-2 text-sm text-rose-400 text-right">
              {(deleteCashMutation.error as Error)?.message ??
                'Failed to delete cash balance entry'}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <TransferModal
        open={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        accounts={accounts}
        defaultFromAccountId={cashAccountFilter || undefined}
      />
    </>
  );
};
