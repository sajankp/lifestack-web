import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Edit2, Landmark, Trash2, Wallet } from 'lucide-react';
import { SkeletonList } from '../../components/ui/FeedbackStates';
import { Pagination } from '../../components/Pagination';
import { spendingService } from '../../services/spending';
import { financeService } from '../../services/finance';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import type { LedgerEntry } from '../../types/spending';
import type { CapitalTransfer, ReconciliationSummary } from '../../types/finance';

interface LedgerTabProps {
  accounts: Array<{ public_id: string; name: string; account_type: string; default_currency_code: string }>;
  selectedAccountId: string;
  onAccountChange: (id: string) => void;
  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
  currencyDisplayPreference: 'symbol' | 'code';
  fromDate?: string;
  toDate?: string;
  /** Looked up by public_id to find the full transfer record behind a transfer_in/out ledger row. */
  transferByPublicId?: Map<string, CapitalTransfer>;
  onEditTransfer?: (transfer: CapitalTransfer) => void;
  onRequestDeleteTransfer?: (transfer: CapitalTransfer) => void;
  onAddTransfer?: () => void;
}

// Reconciliation card: compares projected ledger balance to cash snapshot
const ReconciliationCard: React.FC<{
  reconciliation: ReconciliationSummary;
  formatBal: (v: string | number | undefined) => string;
}> = ({ reconciliation, formatBal }) => {
  const disc = reconciliation.discrepancy !== null ? Number(reconciliation.discrepancy) : null;
  const discAbs = disc !== null ? Math.abs(disc) : null;
  const projected = Number(reconciliation.projected_balance);
  const threshold = projected !== 0 ? Math.abs(projected) * 0.05 : 100;
  const discColor =
    disc === null
      ? 'text-slate-400'
      : disc === 0
      ? 'text-emerald-400'
      : discAbs! >= threshold
      ? 'text-rose-400'
      : 'text-amber-400';

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reconciliation</span>
        {disc === 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Balanced</span>
        )}
        {disc !== null && disc !== 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            discAbs! >= threshold ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'
          }`}>Discrepancy</span>
        )}
        {disc === null && (
          <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">No Snapshot</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Projected</p>
          <p className={`text-base font-bold ${Number(reconciliation.projected_balance) >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
            {formatBal(reconciliation.projected_balance)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Snapshot</p>
          {reconciliation.snapshot_balance !== null ? (
            <p className={`text-base font-bold ${Number(reconciliation.snapshot_balance) >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
              {formatBal(reconciliation.snapshot_balance)}
            </p>
          ) : (
            <p className="text-base font-bold text-slate-500">—</p>
          )}
          {reconciliation.snapshot_as_of && !isNaN(new Date(reconciliation.snapshot_as_of).getTime()) && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              as of {formatDate(reconciliation.snapshot_as_of)}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Gap</p>
          <p className={`text-base font-bold ${discColor}`}>
            {disc !== null ? (disc > 0 ? '+' : '') + formatBal(reconciliation.discrepancy!) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

export const LedgerTab: React.FC<LedgerTabProps> = ({
  accounts,
  selectedAccountId,
  onAccountChange,
  offset,
  limit,
  onOffsetChange,
  currencyDisplayPreference,
  fromDate,
  toDate,
  transferByPublicId,
  onEditTransfer,
  onRequestDeleteTransfer,
  onAddTransfer,
}) => {
  const selectedAccount = accounts.find((a) => a.public_id === selectedAccountId) ?? null;

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['spending', 'ledger', selectedAccountId, offset, limit, fromDate, toDate],
    queryFn: () => spendingService.getAccountLedger(selectedAccountId, {
      limit,
      offset,
      from_date: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
      to_date: toDate ? `${toDate}T23:59:59.999Z` : undefined,
    }),
    enabled: !!selectedAccountId,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['finance', 'account-balance', selectedAccountId],
    queryFn: () => financeService.getAccountBalance(selectedAccountId),
    enabled: !!selectedAccountId,
  });

  const { data: reconciliation } = useQuery({
    queryKey: ['finance', 'reconciliation', selectedAccountId],
    queryFn: () => financeService.getAccountReconciliation(selectedAccountId),
    enabled: !!selectedAccountId,
  });

  const currency = selectedAccount?.default_currency_code ?? 'USD';

  const formatBal = (val: string | number | undefined) =>
    val !== undefined
      ? formatCurrency(Number(val), currency, currencyDisplayPreference)
      : '—';


  return (
    <div className="animate-in fade-in duration-300 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Account activity</h3>
          <p className="text-sm text-slate-400 mt-0.5">Transaction and transfer history with a running balance for a spending account</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {onAddTransfer ? (
            <button
              onClick={onAddTransfer}
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transfer
            </button>
          ) : null}

          {/* Account selector */}
          <div className="flex min-w-[220px] flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Select Account</label>
            <select
              data-testid="ledger-account-select"
              value={selectedAccountId}
              onChange={(e) => onAccountChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">— Pick an account —</option>
              {accounts.map((a) => (
                <option key={a.public_id} value={a.public_id}>
                  {a.name} ({a.account_type.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedAccountId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
          <div className="mb-4 rounded-full bg-slate-800 p-4">
            <Landmark className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">Select an account</h3>
          <p className="text-slate-400 text-sm">Choose a spending account above to view its transaction ledger and running balance.</p>
        </div>
      ) : isLoading ? (
        <SkeletonList rows={5} />
      ) : (
        <>
          {/* Balance summary cards */}
          {balanceData && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Projected Balance</p>
                <p className={`text-xl font-bold ${
                  Number(balanceData.spending_balance) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {formatBal(balanceData.spending_balance)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Transactions</p>
                <p className="text-xl font-bold text-white">{balanceData.transaction_count}</p>
                {balanceData.transfer_count > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">{balanceData.transfer_count} transfer{balanceData.transfer_count > 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Page Opening</p>
                <p className={`text-xl font-bold ${
                  Number(ledger?.opening_balance ?? 0) >= 0 ? 'text-slate-200' : 'text-rose-400'
                }`}>
                  {formatBal(ledger?.opening_balance)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Page Closing</p>
                <p className={`text-xl font-bold ${
                  Number(ledger?.closing_balance ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {formatBal(ledger?.closing_balance)}
                </p>
              </div>
            </div>
          )}

          {/* Reconciliation card */}
          {reconciliation && (
            <ReconciliationCard reconciliation={reconciliation} formatBal={formatBal} />
          )}


          {/* Ledger table */}
          {ledger && ledger.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
              <Wallet className="h-8 w-8 text-slate-500 mb-3" />
              <p className="text-slate-400">No transactions for this account yet.</p>
            </div>
          ) : (
            <>
            {/* Mobile / tablet card list */}
            <div className="space-y-3 lg:hidden">
              {(ledger?.items ?? []).map((entry: LedgerEntry) => {
                const isTransfer = entry.entry_kind === 'transfer_out' || entry.entry_kind === 'transfer_in';
                const isCredit = entry.entry_kind === 'transfer_in' || entry.type === 'income';
                const amount = Number(entry.amount);
                const balance = Number(entry.running_balance);
                const date = formatDate(entry.occurred_at, { fallback: '—' });
                const descLabel = isTransfer
                  ? (entry.description
                      ? (entry.entry_kind === 'transfer_out' ? `Transfer → ${entry.description}` : `Transfer ← ${entry.description}`)
                      : (entry.entry_kind === 'transfer_out' ? 'Transfer out' : 'Transfer in'))
                  : entry.description ?? '—';
                return (
                  <div
                    key={entry.public_id}
                    className={`rounded-2xl border border-slate-800 p-4 ${isTransfer ? 'bg-slate-800/40' : 'bg-slate-900/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-200">{descLabel}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{date}{!isTransfer && entry.wallet_name ? ` · ${entry.wallet_name}` : ''}</p>
                      </div>
                      <span className={`shrink-0 font-mono text-sm font-semibold ${isCredit ? (isTransfer ? 'text-cyan-400' : 'text-emerald-400') : (isTransfer ? 'text-indigo-400' : 'text-rose-400')}`}>
                        {isCredit ? '+' : '-'}{formatCurrency(amount, currency, currencyDisplayPreference)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 text-xs">
                      {isTransfer ? (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${entry.entry_kind === 'transfer_out' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
                          {entry.entry_kind === 'transfer_out' ? 'Transfer out' : 'Transfer in'}
                        </span>
                      ) : <span className="text-slate-500">Balance</span>}
                      <span className={`font-mono ${balance >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
                        {formatCurrency(balance, currency, currencyDisplayPreference)}
                      </span>
                    </div>
                    {isTransfer && transferByPublicId?.has(entry.public_id) ? (
                      <div className="mt-2 flex items-center justify-end gap-1 border-t border-slate-800 pt-2">
                        <button
                          onClick={() => onEditTransfer?.(transferByPublicId.get(entry.public_id)!)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                          title="Edit transfer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onRequestDeleteTransfer?.(transferByPublicId.get(entry.public_id)!)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-900/40 hover:text-red-400"
                          title="Delete transfer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-slate-800 lg:block">
              <table className="w-full text-left text-sm text-slate-300 min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Debit</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Credit</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Balance</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(ledger?.items ?? []).map((entry: LedgerEntry) => {
                    const isTransfer = entry.entry_kind === 'transfer_out' || entry.entry_kind === 'transfer_in';
                    const relatedTransfer = isTransfer ? transferByPublicId?.get(entry.public_id) : undefined;
                    const isCredit = entry.entry_kind === 'transfer_in' || entry.type === 'income';
                    const amount = Number(entry.amount);
                    const balance = Number(entry.running_balance);
                    const date = formatDate(entry.occurred_at, { fallback: '—' });

                    // Derive description label for transfer rows
                    const descLabel = isTransfer
                      ? (entry.description
                          ? (entry.entry_kind === 'transfer_out' ? `Transfer → ${entry.description}` : `Transfer ← ${entry.description}`)
                          : (entry.entry_kind === 'transfer_out' ? 'Transfer out' : 'Transfer in'))
                      : entry.description ?? '—';

                    // Row background tint for transfers
                    const rowClass = isTransfer
                      ? 'hover:bg-slate-800/50 transition-colors bg-slate-800/20'
                      : 'hover:bg-slate-800/30 transition-colors';

                    return (
                      <tr
                        key={entry.public_id}
                        className={rowClass}
                      >
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{date}</td>
                        <td className="px-4 py-3">
                          <span className={isTransfer ? 'text-slate-300 text-xs font-medium' : 'text-slate-200'}>
                            {descLabel}
                          </span>
                          {!isTransfer && entry.wallet_name && (
                            <span className="ml-2 text-xs text-slate-500">{entry.wallet_name}</span>
                          )}
                          {isTransfer && (
                            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              entry.entry_kind === 'transfer_out'
                                ? 'bg-indigo-500/15 text-indigo-400'
                                : 'bg-cyan-500/15 text-cyan-400'
                            }`}>
                              {entry.entry_kind === 'transfer_out' ? 'Out' : 'In'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {!isCredit && (
                            <span className={isTransfer ? 'text-indigo-400' : 'text-rose-400'}>
                              {formatCurrency(amount, currency, currencyDisplayPreference)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {isCredit && (
                            <span className={isTransfer ? 'text-cyan-400' : 'text-emerald-400'}>
                              {formatCurrency(amount, currency, currencyDisplayPreference)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={balance >= 0 ? 'text-slate-200' : 'text-rose-400'}>
                            {formatCurrency(balance, currency, currencyDisplayPreference)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {relatedTransfer ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onEditTransfer?.(relatedTransfer)}
                                className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                                title="Edit transfer"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => onRequestDeleteTransfer?.(relatedTransfer)}
                                className="rounded p-1.5 text-slate-400 hover:bg-red-900/40 hover:text-red-400 transition-colors"
                                title="Delete transfer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}

                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Pagination */}
          {ledger && ledger.total_entries > limit && (
            <Pagination
              total={ledger.total_entries}
              limit={limit}
              offset={offset}
              onPageChange={onOffsetChange}
            />
          )}

        </>
      )}
    </div>
  );
};
