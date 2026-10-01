import React, { useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CreditCard,
  Edit2,
  LineChart,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '../ui/button';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { useDisplayProfile } from '../../hooks/useDisplayProfile';
import type { Account, ActivityFeedItem } from '../../types/finance';

interface AccountDetailViewProps {
  account: Account;
  currentBalance: number;
  activityItems: ActivityFeedItem[];
  onBack: () => void;
  onOpenTransfer: (fromAccountId?: string) => void;
  onOpenAddTransaction?: () => void;
  onOpenDividend?: (brokerageAccountId?: string) => void;
  onOpenOrder?: (brokerageAccountId?: string) => void;
  onEditItem?: (item: ActivityFeedItem) => void;
  onDeleteItem?: (item: ActivityFeedItem) => void;
  isDeletePending?: boolean;
}

const ACCOUNT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bank: Building2,
  brokerage: LineChart,
  card: CreditCard,
  cash: Wallet,
};

export const AccountDetailView: React.FC<AccountDetailViewProps> = ({
  account,
  currentBalance,
  activityItems,
  onBack,
  onOpenTransfer,
  onOpenAddTransaction,
  onOpenDividend,
  onOpenOrder,
  onEditItem,
  onDeleteItem,
  isDeletePending = false,
}) => {
  const displayProfile = useDisplayProfile();

  const isBrokerage = account.account_type === 'brokerage';

  // Compute period metrics & running balances
  const { itemsWithRunningBalance, totalInflow, totalOutflow } = useMemo(() => {
    let inflowSum = 0;
    let outflowSum = 0;

    // Filter items belonging to this account
    const accountEvents = activityItems.filter(
      (item) => item.account_id === account.public_id,
    );

    // Calculate total net delta of all events in the list
    // and compute running balances from currentBalance backwards
    let running = currentBalance;
    const withBalances: Array<ActivityFeedItem & { numAmount: number; isPositive: boolean; runningBalance: number }> = [];

    for (const item of accountEvents) {
      const isPositive = item.amount.startsWith('+');
      const numAmt = Math.abs(parseFloat(item.amount.replace('+', '')));

      if (isPositive) {
        inflowSum += numAmt;
      } else {
        outflowSum += numAmt;
      }

      const rowBalance = running;
      // Step backwards for previous row
      if (isPositive) {
        running -= numAmt;
      } else {
        running += numAmt;
      }

      withBalances.push({
        ...item,
        numAmount: numAmt,
        isPositive,
        runningBalance: rowBalance,
      });
    }

    return {
      itemsWithRunningBalance: withBalances,
      totalInflow: inflowSum,
      totalOutflow: outflowSum,
    };
  }, [activityItems, account.public_id, currentBalance]);

  const Icon = ACCOUNT_ICONS[account.account_type] ?? Wallet;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Account Header Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={onBack}
              className="h-9 w-9 p-0 border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="rounded-xl bg-slate-800 p-2.5 text-cyan-400 border border-slate-700">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{account.name}</h2>
                <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-mono font-medium text-slate-300 uppercase">
                  {account.default_currency_code}
                </span>
                <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {account.account_type}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isBrokerage
                  ? 'Snapshot-reconciled brokerage cash account'
                  : 'Ledger-tracked spending and liquid account'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenTransfer(account.public_id)}
              className="h-9 gap-1.5 border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-cyan-400" />
              Transfer Money
            </Button>

            {isBrokerage ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenDividend?.(account.public_id)}
                  className="h-9 gap-1.5 border border-slate-700 bg-slate-800/80 text-xs font-medium text-emerald-300 hover:bg-slate-700"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  + Dividend
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenOrder?.(account.public_id)}
                  className="h-9 gap-1.5 border border-slate-700 bg-slate-800/80 text-xs font-medium text-violet-300 hover:bg-slate-700"
                >
                  <LineChart className="h-3.5 w-3.5" />
                  + Trade
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenAddTransaction}
                className="h-9 gap-1.5 border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                Add Transaction
              </Button>
            )}
          </div>
        </div>

        {/* 3 Metric Summary Badges */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5">
            <span className="text-xs font-medium text-slate-400">Current Balance</span>
            <span className="mt-1 block font-mono text-xl font-bold text-slate-100">
              {formatCurrency(
                currentBalance,
                account.default_currency_code,
                displayProfile.currencyDisplay,
                displayProfile.locale,
                displayProfile.decimalPlaces,
              )}
            </span>
          </div>

          <div className="rounded-xl border border-emerald-950/40 bg-emerald-950/20 p-3.5 border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-300">Total Inflows</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="mt-1 block font-mono text-xl font-bold text-emerald-400">
              +{formatCurrency(
                totalInflow,
                account.default_currency_code,
                displayProfile.currencyDisplay,
                displayProfile.locale,
                displayProfile.decimalPlaces,
              )}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Outflows</span>
              <TrendingDown className="h-4 w-4 text-rose-400" />
            </div>
            <span className="mt-1 block font-mono text-xl font-bold text-slate-300">
              -{formatCurrency(
                totalOutflow,
                account.default_currency_code,
                displayProfile.currencyDisplay,
                displayProfile.locale,
                displayProfile.decimalPlaces,
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Account Activity Table with Running Balance */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-sm backdrop-blur overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Account Ledger & History</h3>
            <p className="text-xs text-slate-400">Chronological activity with running balance verification</p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {itemsWithRunningBalance.length} {itemsWithRunningBalance.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {itemsWithRunningBalance.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No activity found for this account yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Running Balance</th>
                  {(onEditItem || onDeleteItem) && (
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {itemsWithRunningBalance.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                        {item.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      <div className="font-medium">{item.description}</div>
                      {item.counterpart_account_name && (
                        <div className="text-[11px] text-slate-400">
                          Counterpart: {item.counterpart_account_name}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${
                        item.isPositive ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {item.isPositive ? '+' : '-'}
                      {formatCurrency(
                        item.numAmount,
                        item.currency,
                        displayProfile.currencyDisplay,
                        displayProfile.locale,
                        displayProfile.decimalPlaces,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-100 whitespace-nowrap bg-slate-800/10">
                      {formatCurrency(
                        item.runningBalance,
                        account.default_currency_code,
                        displayProfile.currencyDisplay,
                        displayProfile.locale,
                        displayProfile.decimalPlaces,
                      )}
                    </td>
                    {(onEditItem || onDeleteItem) && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {item.event_type === 'spend' && onEditItem && (
                            <button
                              type="button"
                              onClick={() => onEditItem(item)}
                              disabled={isDeletePending}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors disabled:opacity-50"
                              title="Edit transaction"
                              aria-label="Edit transaction"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {(item.event_type === 'spend' || item.event_type === 'transfer') &&
                            onDeleteItem && (
                              <button
                                type="button"
                                onClick={() => onDeleteItem(item)}
                                disabled={isDeletePending}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-50"
                                title={
                                  item.event_type === 'transfer'
                                    ? 'Delete transfer'
                                    : 'Delete transaction'
                                }
                                aria-label={
                                  item.event_type === 'transfer'
                                    ? 'Delete transfer'
                                    : 'Delete transaction'
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
