import React from 'react';
import { Calendar, Edit2, Plus, Tag, Trash2, Wallet } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { AccountTypeBadge, CurrencyBadge } from '../../components/finance/Badges';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import type { Account } from '../../types/finance';
import type { PaginatedResponse } from '../../types/common';
import type { Transaction } from '../../types/spending';

interface TransactionsTabProps {
  transactions: Transaction[] | undefined;
  transactionsResponse: PaginatedResponse<Transaction> | undefined;
  monthLabel: string;
  accountById: Map<string, Account>;
  displayCurrency: string;
  currencyDisplayPreference: 'symbol' | 'code';
  getCategoryTheme: (catId: string) => { name: string; color: string; icon: string | null };
  onEdit: (tx: Transaction) => void;
  onDelete: (publicId: string) => void;
  onPageChange: (offset: number) => void;
  isDeletePending?: boolean;
  onAddFirst?: () => void;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  transactionsResponse,
  monthLabel,
  accountById,
  displayCurrency,
  currencyDisplayPreference,
  getCategoryTheme,
  onEdit,
  onDelete,
  onPageChange,
  isDeletePending,
  onAddFirst,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h3 className="text-xl font-semibold text-white">Transactions in {monthLabel}</h3>
      {transactions?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
          <div className="mb-4 rounded-full bg-slate-800 p-4">
            <Wallet className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">No transactions yet</h3>
          <p className="text-slate-400">Start tracking your spending by adding a new transaction.</p>
          {onAddFirst ? (
            <button
              onClick={onAddFirst}
              className="mt-6 flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-cyan-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add First Transaction
            </button>
          ) : null}
        </div>
      ) : (
        <>
        {/* Mobile / tablet card list — the wide table below is unusable on small screens */}
        <div className="space-y-3 lg:hidden">
          {transactions?.map((tx) => {
            const catTheme = getCategoryTheme(tx.category_id);
            const isIncome = tx.type === 'income';
            const dateObj = new Date(tx.occurred_at);
            const linkedAccount = tx.account_id ? accountById.get(tx.account_id) : undefined;
            const sourceName = tx.wallet_name || linkedAccount?.name || '-';
            const sourceCurrency = linkedAccount?.default_currency_code ?? displayCurrency;
            const labels = tx.labels
              ? tx.labels.split(',').map((l) => l.trim()).filter(Boolean).slice(0, 3)
              : [];

            return (
              <div
                key={tx.public_id}
                className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ backgroundColor: `${catTheme.color}20`, color: catTheme.color }}
                  >
                    {catTheme.icon ? <span>{catTheme.icon}</span> : <Tag className="h-3 w-3" />}
                    {catTheme.name}
                  </span>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className={`text-base font-semibold ${isIncome ? 'text-emerald-400' : 'text-slate-100'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(parseFloat(tx.amount.toString()), sourceCurrency, currencyDisplayPreference)}
                    </span>
                    {sourceCurrency !== displayCurrency ? (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                        Report {displayCurrency}
                      </span>
                    ) : null}
                  </div>
                </div>

                {tx.description ? (
                  <p data-testid="transaction-description-card" className="mt-2 text-sm text-slate-200">{tx.description}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    {formatDate(dateObj)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-slate-500" />
                    {sourceName}
                  </span>
                </div>

                {labels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {labels.map((label, index) => (
                      <span
                        key={`${tx.public_id}-${label}-${index}`}
                        className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex justify-end gap-2 border-t border-slate-700/40 pt-3">
                  <button
                    onClick={() => onEdit(tx)}
                    disabled={isDeletePending}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-all hover:bg-cyan-500/10 hover:text-cyan-400 disabled:opacity-50"
                  >
                    <Edit2 className="h-4 w-4" /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(tx.public_id)}
                    disabled={isDeletePending}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm lg:block">
          <table className="w-full text-left text-sm text-slate-300 min-w-[1000px]">
            <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Details</th>
                <th className="px-6 py-4 font-medium">Source</th>
                <th className="px-6 py-4 font-medium">Tags</th>
                <th className="px-6 py-4 text-right font-medium">Amount (Original)</th>
                <th className="px-6 py-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {transactions?.map((tx) => {
                const catTheme = getCategoryTheme(tx.category_id);
                const isIncome = tx.type === 'income';
                const dateObj = new Date(tx.occurred_at);
                const linkedAccount = tx.account_id ? accountById.get(tx.account_id) : undefined;
                const sourceName = tx.wallet_name || linkedAccount?.name || '-';
                const sourceType = linkedAccount?.account_type
                  ? linkedAccount.account_type.replace('_', ' ')
                  : tx.wallet_name
                    ? 'wallet'
                    : null;
                const sourceCurrency = linkedAccount?.default_currency_code ?? displayCurrency;
                const sourceMetadata = tx.source_metadata;

                return (
                  <tr key={tx.public_id} className="group transition-colors hover:bg-slate-700/30">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        {formatDate(dateObj)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ backgroundColor: `${catTheme.color}20`, color: catTheme.color }}
                      >
                        {catTheme.icon && <span>{catTheme.icon}</span>}
                        {!catTheme.icon && <Tag className="h-3 w-3" />}
                        {catTheme.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p data-testid="transaction-description-table" className="max-w-[240px] truncate text-slate-200">{tx.description || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        <span className="inline-flex max-w-[180px] truncate rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-200">
                          {sourceName}
                        </span>
                        {sourceType ? <AccountTypeBadge type={sourceType} /> : null}
                        <CurrencyBadge code={sourceCurrency} />
                        {sourceMetadata ? (
                          <span
                            data-testid={`transaction-source-metadata-${tx.public_id}`}
                            title={
                              sourceMetadata.rollback_supported && sourceMetadata.import_row_number
                                ? `${sourceMetadata.label}, row ${sourceMetadata.import_row_number}`
                                : sourceMetadata.label
                            }
                            className="rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-300"
                          >
                            {sourceMetadata.origin === 'bulk_import'
                              ? `Imported${sourceMetadata.import_row_number ? ` #${sourceMetadata.import_row_number}` : ''}`
                              : sourceMetadata.label}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {tx.labels ? (
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {tx.labels
                            .split(',')
                            .map((label) => label.trim())
                            .filter(Boolean)
                            .slice(0, 3)
                            .map((label, index) => (
                              <span
                                key={`${tx.public_id}-${label}-${index}`}
                                className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                              >
                                {label}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-semibold ${isIncome ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(parseFloat(tx.amount.toString()), sourceCurrency, currencyDisplayPreference)}
                        </span>
                        {sourceCurrency !== displayCurrency ? (
                          <span
                            title={`Reporting currency is ${displayCurrency}. This row keeps source currency ${sourceCurrency}.`}
                            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300"
                          >
                            Report {displayCurrency}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onEdit(tx)}
                        className="inline-flex rounded-lg p-2 text-slate-500 transition-all hover:bg-cyan-500/10 hover:text-cyan-400"
                        title="Edit transaction"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(tx.public_id)}
                        disabled={isDeletePending}
                        className="ml-2 inline-flex rounded-lg p-2 text-slate-500 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                        title="Delete transaction"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      {transactionsResponse && (
        <Pagination
          total={transactionsResponse.total}
          limit={transactionsResponse.limit}
          offset={transactionsResponse.offset}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};
