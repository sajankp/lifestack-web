import React from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  ChevronRight,
  CreditCard,
  LineChart,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '../../utils/numberFormat';
import { useDisplayProfile } from '../../hooks/useDisplayProfile';
import { Button } from '../ui/button';
import { SkeletonCard, SkeletonLine } from '../ui/FeedbackStates';
import type { Account } from '../../types/finance';

interface AccountMapProps {
  accounts: Account[];
  balancesByAccountId: Record<string, number>;
  portfolioByAccountId?: Record<string, { totalInvested: number; holdingsCount: number }>;
  onSelectAccount: (accountId: string) => void;
  onOpenTransfer: (fromAccountId?: string) => void;
  onOpenDividend: (brokerageAccountId?: string) => void;
  onOpenOrder: (brokerageAccountId?: string) => void;
  onOpenCreateAccount: () => void;
  selectedAccountId?: string | null;
  isLoading?: boolean;
}

export const AccountMap: React.FC<AccountMapProps> = ({
  accounts,
  balancesByAccountId,
  portfolioByAccountId = {},
  onSelectAccount,
  onOpenTransfer,
  onOpenDividend,
  onOpenOrder,
  onOpenCreateAccount,
  selectedAccountId,
  isLoading = false,
}) => {
  const displayProfile = useDisplayProfile();

  const cashAccounts = accounts.filter(
    (a) => a.account_type === 'bank' || a.account_type === 'wallet' || a.account_type === 'card',
  );
  const brokerageAccounts = accounts.filter((a) => a.account_type === 'brokerage');

  const totalCashBank = cashAccounts.reduce(
    (acc, a) => acc + (balancesByAccountId[a.public_id] ?? 0),
    0,
  );
  const totalBrokerageCash = brokerageAccounts.reduce(
    (acc, a) => acc + (balancesByAccountId[a.public_id] ?? 0),
    0,
  );
  const totalInvestedPortfolio = Object.values(portfolioByAccountId).reduce(
    (acc, p) => acc + p.totalInvested,
    0,
  );

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return Building2;
      case 'card':
        return CreditCard;
      case 'brokerage':
        return LineChart;
      default:
        return Wallet;
    }
  };

  const baseCurrency = accounts[0]?.default_currency_code ?? 'INR';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Account Architecture</h2>
          <p className="text-xs text-slate-400">
            Interactive map of your liquid cash, brokerage balances, and investment holdings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenCreateAccount}
            className="gap-1.5 text-xs border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
          >
            <Plus className="h-3.5 w-3.5 text-cyan-400" />
            Add Account
          </Button>
          <Button
            size="sm"
            onClick={() => onOpenTransfer()}
            disabled={accounts.length < 2}
            className="gap-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Transfer Funds
          </Button>
        </div>
      </div>

      {/* 3-Lane Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {isLoading ? (
          <>
            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm backdrop-blur space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <SkeletonLine className="h-4 w-32" />
                <SkeletonLine className="h-4 w-16" />
              </div>
              <SkeletonCard className="h-20" />
              <SkeletonCard className="h-20" />
            </div>

            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm backdrop-blur space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <SkeletonLine className="h-4 w-32" />
                <SkeletonLine className="h-4 w-16" />
              </div>
              <SkeletonCard className="h-20" />
              <SkeletonCard className="h-20" />
            </div>

            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm backdrop-blur space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <SkeletonLine className="h-4 w-32" />
                <SkeletonLine className="h-4 w-16" />
              </div>
              <SkeletonCard className="h-20" />
              <SkeletonCard className="h-20" />
            </div>
          </>
        ) : (
          <>
            {/* Lane 1: Bank & Spending Accounts */}
            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Bank & Cash Accounts</h3>
                    <p className="text-xs text-slate-400">Ledger-tracked spending cash</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total:</span>{' '}
                  <span className="font-mono text-xs font-bold text-blue-300">
                    {formatCurrency(
                      totalCashBank,
                      baseCurrency,
                      displayProfile.currencyDisplay,
                      displayProfile.locale,
                      displayProfile.decimalPlaces,
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex-1 space-y-2">
                {cashAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-500">
                    <Wallet className="h-8 w-8 mb-2 opacity-40" />
                    <span>No bank or cash accounts yet</span>
                    <button
                      type="button"
                      onClick={onOpenCreateAccount}
                      className="text-cyan-400 hover:underline mt-1 text-xs"
                    >
                      + Add account
                    </button>
                  </div>
                ) : (
                  cashAccounts.map((acc) => {
                    const Icon = getAccountIcon(acc.account_type);
                    const bal = balancesByAccountId[acc.public_id] ?? 0;
                    const isSelected = selectedAccountId === acc.public_id;
                    return (
                      <div
                        key={acc.public_id}
                        onClick={() => onSelectAccount(acc.public_id)}
                        className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-950/30 ring-1 ring-cyan-500'
                            : 'border-slate-800/80 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-lg bg-slate-800 p-2 text-slate-300 group-hover:text-cyan-400">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-xs font-semibold text-white">
                                {acc.name}
                              </span>
                              <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                                {acc.default_currency_code}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 capitalize">
                              {acc.account_type} account
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="block font-mono text-xs font-bold text-slate-100">
                              {formatCurrency(
                                bal,
                                acc.default_currency_code,
                                displayProfile.currencyDisplay,
                                displayProfile.locale,
                                displayProfile.decimalPlaces,
                              )}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-400" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-xs text-slate-400">{cashAccounts.length} Connected</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenCreateAccount}
                  className="text-xs h-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 px-2"
                >
                  + New Account
                </Button>
              </div>
            </div>

            {/* Lane 2: Brokerage Cash Balances */}
            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
                    <LineChart className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Brokerage Cash</h3>
                    <p className="text-xs text-slate-400">Trading balances & unallocated cash</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total:</span>{' '}
                  <span className="font-mono text-xs font-bold text-emerald-300">
                    {formatCurrency(
                      totalBrokerageCash,
                      baseCurrency,
                      displayProfile.currencyDisplay,
                      displayProfile.locale,
                      displayProfile.decimalPlaces,
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex-1 space-y-2">
                {brokerageAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-500">
                    <LineChart className="h-8 w-8 mb-2 opacity-40" />
                    <span>No brokerage accounts connected</span>
                    <button
                      type="button"
                      onClick={onOpenCreateAccount}
                      className="text-cyan-400 hover:underline mt-1 text-xs"
                    >
                      + Add Brokerage
                    </button>
                  </div>
                ) : (
                  brokerageAccounts.map((acc) => {
                    const bal = balancesByAccountId[acc.public_id] ?? 0;
                    const isSelected = selectedAccountId === acc.public_id;
                    return (
                      <div
                        key={acc.public_id}
                        onClick={() => onSelectAccount(acc.public_id)}
                        className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500'
                            : 'border-slate-800/80 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-lg bg-slate-800 p-2 text-slate-300 group-hover:text-emerald-400">
                            <LineChart className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-xs font-semibold text-white">
                                {acc.name}
                              </span>
                              <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                                {acc.default_currency_code}
                              </span>
                            </div>
                            <span className="text-[11px] text-emerald-400 font-medium">
                              Available Cash
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="block font-mono text-xs font-bold text-emerald-300">
                              {formatCurrency(
                                bal,
                                acc.default_currency_code,
                                displayProfile.currencyDisplay,
                                displayProfile.locale,
                                displayProfile.decimalPlaces,
                              )}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenDividend()}
                  className="text-xs h-8 gap-1 border border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  + Dividend
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenOrder()}
                  className="text-xs h-8 gap-1 border border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  <LineChart className="h-3 w-3 text-violet-400" />
                  + Trade
                </Button>
              </div>
            </div>

            {/* Lane 3: Portfolio Assets */}
            <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-violet-500/20 p-2 text-violet-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Invested Portfolio</h3>
                    <p className="text-xs text-slate-400">Equities, Mutual Funds, ETFs</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total:</span>{' '}
                  <span className="font-mono text-xs font-bold text-violet-300">
                    {formatCurrency(
                      totalInvestedPortfolio,
                      baseCurrency,
                      displayProfile.currencyDisplay,
                      displayProfile.locale,
                      displayProfile.decimalPlaces,
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex-1 space-y-2">
                {brokerageAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-500">
                    <TrendingUp className="h-8 w-8 mb-2 opacity-40" />
                    <span>No portfolio holdings tracked</span>
                  </div>
                ) : (
                  brokerageAccounts.map((acc) => {
                    const port = portfolioByAccountId[acc.public_id] ?? {
                      totalInvested: 0,
                      holdingsCount: 0,
                    };
                    return (
                      <div
                        key={`port-${acc.public_id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-800/30 p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-lg bg-violet-950/40 p-2 text-violet-400 border border-violet-800/30">
                            <TrendingUp className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="truncate text-xs font-semibold text-white block">
                              {acc.name} Holdings
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {port.holdingsCount} {port.holdingsCount === 1 ? 'position' : 'positions'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="block font-mono text-xs font-bold text-violet-300">
                            {formatCurrency(
                              port.totalInvested,
                              acc.default_currency_code,
                              displayProfile.currencyDisplay,
                              displayProfile.locale,
                              displayProfile.decimalPlaces,
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-end">
                <a
                  href="/portfolio"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  View Full Portfolio & Analytics
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
