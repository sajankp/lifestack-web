import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  PieChart,
  Plus,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { PageHero } from '../components/layout/PageHero';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { DropdownSelect } from '../components/DropdownSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { SkeletonCard } from '../components/ui/FeedbackStates';
import { AccountMap } from '../components/finance/AccountMap';
import { ActivityFeedTimeline } from '../components/finance/ActivityFeedTimeline';
import { AccountDetailView } from '../components/finance/AccountDetailView';
import { TransactionModal } from '../components/finance/TransactionModal';
import { TransferModal } from '../components/finance/TransferModal';
import { DividendModal } from '../components/finance/DividendModal';
import { HistoricalDataPanel } from '../components/finance/HistoricalDataPanel';
import { NetWorthHistoryChart, StatusBanner } from '../components/finance/NetWorthHistoryChart';
import { financeService } from '../services/finance';
import { spendingService } from '../services/spending';
import { investingService } from '../services/investing';
import { useInvalidatingMutation } from '../hooks/useInvalidatingMutation';
import { mutationInvalidations, queryKeys } from '../lib/queryKeys';
import { formatCurrency, normalizeToReportingCurrency } from '../utils/numberFormat';
import { useDisplayProfile } from '../hooks/useDisplayProfile';
import type { Account, AccountType, ActivityFeedItem } from '../types/finance';

export const MoneyFlowPage: React.FC = () => {
  const displayProfile = useDisplayProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedAccountId = searchParams.get('account');
  const selectedEventType = searchParams.get('type');

  const [feedOffset, setFeedOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionDefaultAccountId, setTransactionDefaultAccountId] = useState<string | undefined>();
  const [editingFeedItem, setEditingFeedItem] = useState<ActivityFeedItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ActivityFeedItem | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [transferDefaultFromId, setTransferDefaultFromId] = useState<string | undefined>();
  const [dividendDefaultBrokerageId, setDividendDefaultBrokerageId] = useState<string | undefined>();

  // Form state for creating account
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<AccountType>('bank');
  const [newAccCurrency, setNewAccCurrency] = useState('INR');

  // Fetch Accounts
  const accountsRes = useQuery({
    queryKey: queryKeys.finance.accounts(),
    queryFn: () => financeService.getAccounts(),
  });
  const accounts: Account[] = useMemo(() => accountsRes.data?.items ?? [], [accountsRes.data]);

  // Fetch Net Worth / Balances
  const netWorthRes = useQuery({
    queryKey: queryKeys.netWorth.summary(),
    queryFn: () => financeService.getNetWorth(),
  });

  // Fetch Net Worth History
  const historyRes = useQuery({
    queryKey: queryKeys.netWorth.history(),
    queryFn: () => financeService.getNetWorthHistory(),
    staleTime: 60_000,
  });

  // Fetch Holdings to compute exact per-brokerage account holdings and valuation (limit=200 max)
  const holdingsRes = useQuery({
    queryKey: queryKeys.investing.holdings(),
    queryFn: () => investingService.getHoldings(200, 0),
  });

  // Fetch Investing Summary as secondary source and FX rates
  const investingSummaryRes = useQuery({
    queryKey: queryKeys.investing.summary(),
    queryFn: () => investingService.getSummary(),
  });

  const reportingCurrency =
    netWorthRes.data?.reporting_currency ||
    investingSummaryRes.data?.reporting_currency ||
    accounts[0]?.default_currency_code ||
    'INR';

  const fxRates =
    investingSummaryRes.data?.fx_rates_used ||
    (netWorthRes.data as unknown as { fx_rates_used?: Record<string, number | string> })?.fx_rates_used ||
    {};

  // Fetch Unified Activity Feed
  const activityFeedRes = useQuery({
    queryKey: queryKeys.finance.activityFeed(
      selectedAccountId || 'all',
      selectedEventType || 'all',
      feedOffset,
    ),
    queryFn: () =>
      financeService.getActivityFeed({
        account_id: selectedAccountId || undefined,
        event_types: selectedEventType ? selectedEventType : undefined,
        limit: 50,
        offset: feedOffset,
      }),
  });

  // Calculate balances per account in native currency
  const balancesByAccountId = useMemo(() => {
    const map: Record<string, number> = {};
    const nw = netWorthRes.data;
    if (nw) {
      if (nw.spending_accounts) {
        nw.spending_accounts.forEach((acc) => {
          map[acc.account_public_id] = Number(acc.balance || 0);
        });
      }
      if (nw.investing_accounts) {
        nw.investing_accounts.forEach((acc) => {
          map[acc.account_public_id] = Number(acc.balance || 0);
        });
      }
    } else {
      accounts.forEach((acc) => {
        map[acc.public_id] = 0;
      });
    }
    return map;
  }, [netWorthRes.data, accounts]);

  // Calculate balances per account converted to reporting currency
  const balancesReportingByAccountId = useMemo(() => {
    const map: Record<string, number> = {};
    const nw = netWorthRes.data;
    if (nw) {
      if (nw.spending_accounts) {
        nw.spending_accounts.forEach((acc) => {
          const valInRc = acc.balance_in_reporting_currency != null
            ? Number(acc.balance_in_reporting_currency)
            : normalizeToReportingCurrency(acc.balance, acc.currency_code, reportingCurrency, fxRates);
          map[acc.account_public_id] = valInRc;
        });
      }
      if (nw.investing_accounts) {
        nw.investing_accounts.forEach((acc) => {
          const valInRc = acc.balance_in_reporting_currency != null
            ? Number(acc.balance_in_reporting_currency)
            : normalizeToReportingCurrency(acc.balance, acc.currency_code, reportingCurrency, fxRates);
          map[acc.account_public_id] = valInRc;
        });
      }
    } else {
      accounts.forEach((acc) => {
        map[acc.public_id] = 0;
      });
    }
    return map;
  }, [netWorthRes.data, accounts, reportingCurrency, fxRates]);

  // Accurate Portfolio allocation by brokerage account with multi-currency conversion
  const portfolioByAccountId = useMemo(() => {
    const map: Record<string, { totalInvested: number; totalInvestedReporting: number; holdingsCount: number }> = {};
    const brokerageAccounts = accounts.filter((a) => a.account_type === 'brokerage');

    // Initialize all brokerage accounts to 0
    brokerageAccounts.forEach((a) => {
      map[a.public_id] = { totalInvested: 0, totalInvestedReporting: 0, holdingsCount: 0 };
    });

    const holdings = holdingsRes.data?.items ?? [];
    if (holdings.length > 0) {
      holdings.forEach((h) => {
        const matchedAcc = brokerageAccounts.find(
          (a) => a.public_id === h.account_id || (h.account_name && a.name === h.account_name),
        );
        const targetId = matchedAcc ? matchedAcc.public_id : h.account_id;

        if (targetId) {
          if (!map[targetId]) {
            map[targetId] = { totalInvested: 0, totalInvestedReporting: 0, holdingsCount: 0 };
          }
          const price = Number(h.current_price ?? h.avg_cost ?? 0);
          const val = Number(h.current_value ?? (Number(h.quantity || 0) * price));
          const valReporting = normalizeToReportingCurrency(val, h.currency, reportingCurrency, fxRates);

          map[targetId].totalInvested += val;
          map[targetId].totalInvestedReporting += valReporting;
          map[targetId].holdingsCount += 1;
        }
      });
    } else if (investingSummaryRes.data?.portfolio_value != null && brokerageAccounts.length === 1) {
      const singleAcc = brokerageAccounts[0];
      const val = Number(investingSummaryRes.data.portfolio_value);
      map[singleAcc.public_id] = {
        totalInvested: val,
        totalInvestedReporting: val,
        holdingsCount: investingSummaryRes.data.holdings_count || 0,
      };
    }

    return map;
  }, [accounts, holdingsRes.data, investingSummaryRes.data, reportingCurrency, fxRates]);

  // High-level sums in reporting currency
  const { totalSpendingCash, totalInvestingCash, totalInvestedPortfolio, totalNetWorth } = useMemo(() => {
    let spendingCash = 0;
    if (netWorthRes.data?.spending_total != null) {
      spendingCash = Number(netWorthRes.data.spending_total);
    } else {
      accounts
        .filter((a) => a.account_type !== 'brokerage')
        .forEach((a) => {
          spendingCash += balancesReportingByAccountId[a.public_id] || 0;
        });
    }

    let investingCash = 0;
    if (netWorthRes.data?.investing_cash_total != null) {
      investingCash = Number(netWorthRes.data.investing_cash_total);
    } else {
      accounts
        .filter((a) => a.account_type === 'brokerage')
        .forEach((a) => {
          investingCash += balancesReportingByAccountId[a.public_id] || 0;
        });
    }

    let portfolioVal = 0;
    if (netWorthRes.data?.holdings_value != null) {
      portfolioVal = Number(netWorthRes.data.holdings_value);
    } else if (investingSummaryRes.data?.portfolio_value != null) {
      portfolioVal = Number(investingSummaryRes.data.portfolio_value);
    } else {
      Object.values(portfolioByAccountId).forEach((p) => {
        portfolioVal += p.totalInvestedReporting;
      });
    }

    const netWorth =
      netWorthRes.data?.total_net_worth != null
        ? Number(netWorthRes.data.total_net_worth)
        : spendingCash + investingCash + portfolioVal;

    return {
      totalSpendingCash: spendingCash,
      totalInvestingCash: investingCash,
      totalInvestedPortfolio: portfolioVal,
      totalNetWorth: netWorth,
    };
  }, [netWorthRes.data, investingSummaryRes.data, portfolioByAccountId, accounts, balancesReportingByAccountId]);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    return accounts.find((a) => a.public_id === selectedAccountId) ?? null;
  }, [accounts, selectedAccountId]);

  const handleSelectAccount = (accountId: string | null) => {
    setSearchParams((prev) => {
      if (accountId) {
        prev.set('account', accountId);
      } else {
        prev.delete('account');
      }
      return prev;
    });
  };

  const handleSelectEventType = (eventType: string | null) => {
    setSearchParams((prev) => {
      if (eventType) {
        prev.set('type', eventType);
      } else {
        prev.delete('type');
      }
      return prev;
    });
    setFeedOffset(0);
  };

  const handleOpenTransfer = (fromAccountId?: string) => {
    setTransferDefaultFromId(fromAccountId);
    setIsTransferModalOpen(true);
  };

  const handleOpenDividend = (brokerageAccountId?: string) => {
    setDividendDefaultBrokerageId(brokerageAccountId);
    setIsDividendModalOpen(true);
  };

  const handleOpenAddTransaction = (accountId?: string) => {
    setEditingFeedItem(null);
    setTransactionDefaultAccountId(accountId || selectedAccountId || undefined);
    setIsTransactionModalOpen(true);
  };

  const handleEditItem = (item: ActivityFeedItem) => {
    if (item.event_type === 'spend') {
      setEditingFeedItem(item);
      setTransactionDefaultAccountId(item.account_id);
      setIsTransactionModalOpen(true);
    }
  };

  const handleDeleteItem = (item: ActivityFeedItem) => {
    setDeletingItem(item);
    setIsDeleteConfirmOpen(true);
  };

  // Delete Transaction Mutation with cascading invalidations
  const deleteTransactionMutation = useInvalidatingMutation(
    (id: string) => spendingService.deleteTransaction(id),
    mutationInvalidations.transaction,
    {
      successMessage: 'Transaction deleted',
      onSuccess: () => {
        setIsDeleteConfirmOpen(false);
        setDeletingItem(null);
      },
    },
  );

  // Delete Transfer Mutation with cascading invalidations
  const deleteTransferMutation = useInvalidatingMutation(
    (id: string) => financeService.deleteTransfer(id),
    mutationInvalidations.transfer,
    {
      successMessage: 'Transfer deleted',
      onSuccess: () => {
        setIsDeleteConfirmOpen(false);
        setDeletingItem(null);
      },
    },
  );

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    if (deletingItem.event_type === 'transfer') {
      deleteTransferMutation.mutate(deletingItem.id);
    } else {
      deleteTransactionMutation.mutate(deletingItem.id);
    }
  };

  // Create Account Mutation with cascading invalidations
  const createAccountMutation = useInvalidatingMutation(
    async () => {
      if (!newAccName.trim()) throw new Error('Account name is required');
      await financeService.createAccount({
        name: newAccName.trim(),
        account_type: newAccType,
        default_currency_code: newAccCurrency.trim().toUpperCase() || 'INR',
      });
    },
    mutationInvalidations.account,
    {
      onSuccess: () => {
        setIsCreateAccountModalOpen(false);
        setNewAccName('');
      },
    },
  );

  const isMetricsLoading = netWorthRes.isLoading || accountsRes.isLoading;
  const isArchitectureLoading = accountsRes.isLoading || netWorthRes.isLoading || holdingsRes.isLoading;
  const isDeletePending = deleteTransactionMutation.isPending || deleteTransferMutation.isPending;

  return (
    <PageShell>
      <PageHero
        title="Money Flow & Architecture"
        subtitle="Unified financial ecosystem mapping your capital across cash accounts, trading balances, and invested portfolio."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenAddTransaction()}
              className="h-9 gap-1.5 border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              + Transaction
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenTransfer()}
              className="h-9 gap-1.5 border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-cyan-400" />
              Transfer
            </Button>
            <HistoricalDataPanel />
          </div>
        }
      />

      <StatusBanner
        status={netWorthRes.data?.valuation_status ?? ''}
        reportingCurrency={reportingCurrency}
        excludedCurrencies={netWorthRes.data?.excluded_currencies ?? []}
      />

      {/* Top 3 High-Level Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isMetricsLoading ? (
          <>
            <SkeletonCard className="h-24" />
            <SkeletonCard className="h-24" />
            <SkeletonCard className="h-24 sm:col-span-2 lg:col-span-1" />
          </>
        ) : (
          <>
            {/* Total Liquid Cash */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Total Liquid Cash</span>
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <span className="font-mono text-2xl font-bold text-emerald-400">
                  {formatCurrency(
                    totalSpendingCash,
                    reportingCurrency,
                    displayProfile.currencyDisplay,
                    displayProfile.locale,
                    displayProfile.decimalPlaces,
                  )}
                </span>
                <p className="mt-0.5 text-xs text-slate-500">Cash across checking, savings & wallets</p>
              </div>
            </div>

            {/* Brokerage Cash Balance */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Brokerage Cash Balance</span>
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <span className="font-mono text-2xl font-bold text-emerald-400">
                  {formatCurrency(
                    totalInvestingCash,
                    reportingCurrency,
                    displayProfile.currencyDisplay,
                    displayProfile.locale,
                    displayProfile.decimalPlaces,
                  )}
                </span>
                <p className="mt-0.5 text-xs text-slate-500">Unallocated cash in trading accounts</p>
              </div>
            </div>

            {/* Total Estimated Net Worth */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-sm sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Total Liquid & Invested</span>
                <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
                  <PieChart className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <span className="font-mono text-2xl font-bold text-cyan-300">
                  {formatCurrency(
                    totalNetWorth,
                    reportingCurrency,
                    displayProfile.currencyDisplay,
                    displayProfile.locale,
                    displayProfile.decimalPlaces,
                  )}
                </span>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Invested: {formatCurrency(totalInvestedPortfolio, reportingCurrency, displayProfile.currencyDisplay, displayProfile.locale, displayProfile.decimalPlaces)}
                  </span>
                  <span className="text-xs text-slate-400">
                    Unified Net Worth
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content Area */}
      {selectedAccount ? (
        /* Drill-Down Account Detail View */
        <AccountDetailView
          account={selectedAccount}
          currentBalance={balancesByAccountId[selectedAccount.public_id] || 0}
          activityItems={activityFeedRes.data?.items ?? []}
          onBack={() => handleSelectAccount(null)}
          onOpenTransfer={handleOpenTransfer}
          onOpenAddTransaction={() => handleOpenAddTransaction(selectedAccount.public_id)}
          onOpenDividend={handleOpenDividend}
          onOpenOrder={() => navigate('/portfolio')}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          isDeletePending={isDeletePending}
        />
      ) : (
        /* Account Map + Historical Net Worth Chart + Unified Activity Feed */
        <div className="space-y-6">
          {/* Visual 3-Lane Account Map */}
          <AccountMap
            accounts={accounts}
            balancesByAccountId={balancesByAccountId}
            balancesReportingByAccountId={balancesReportingByAccountId}
            portfolioByAccountId={portfolioByAccountId}
            reportingCurrency={reportingCurrency}
            fxRates={fxRates}
            totalSpendingCash={totalSpendingCash}
            totalInvestingCash={totalInvestingCash}
            totalInvestedPortfolio={totalInvestedPortfolio}
            onSelectAccount={handleSelectAccount}
            onOpenTransfer={handleOpenTransfer}
            onOpenDividend={handleOpenDividend}
            onOpenOrder={() => navigate('/portfolio')}
            onOpenCreateAccount={() => setIsCreateAccountModalOpen(true)}
            selectedAccountId={selectedAccountId}
            isLoading={isArchitectureLoading}
          />

          {/* Historical Net Worth Trend Chart */}
          {reportingCurrency && (
            <div className="pt-2">
              <NetWorthHistoryChart
                history={historyRes.data}
                currency={reportingCurrency}
                displayProfile={displayProfile}
              />
            </div>
          )}

          {/* Unified Activity Feed Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Unified Activity Stream</h3>
                <p className="text-xs text-slate-400">
                  Real-time timeline of spending transactions, capital transfers, trades, and dividends
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => activityFeedRes.refetch()}
                className="h-8 gap-1 text-xs text-slate-400 hover:text-white"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${activityFeedRes.isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <ActivityFeedTimeline
              items={activityFeedRes.data?.items ?? []}
              total={activityFeedRes.data?.total ?? 0}
              limit={activityFeedRes.data?.limit ?? 50}
              offset={activityFeedRes.data?.offset ?? 0}
              onPageChange={setFeedOffset}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onSelectAccount={handleSelectAccount}
              selectedEventType={selectedEventType}
              onSelectEventType={handleSelectEventType}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isLoading={activityFeedRes.isLoading}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              isDeletePending={isDeletePending}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <TransactionModal
        open={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditingFeedItem(null);
        }}
        accounts={accounts}
        defaultAccountId={transactionDefaultAccountId}
        initialFeedItem={editingFeedItem}
        onCreateAccount={() => {
          setIsTransactionModalOpen(false);
          setIsCreateAccountModalOpen(true);
        }}
      />

      <TransferModal
        open={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        accounts={accounts}
        defaultFromAccountId={transferDefaultFromId}
        onCreateAccount={() => {
          setIsTransferModalOpen(false);
          setIsCreateAccountModalOpen(true);
        }}
      />

      <DividendModal
        open={isDividendModalOpen}
        onClose={() => setIsDividendModalOpen(false)}
        accounts={accounts}
        defaultAccountId={dividendDefaultBrokerageId}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title={deletingItem?.event_type === 'transfer' ? 'Delete Transfer' : 'Delete Transaction'}
        description={
          <span>
            Are you sure you want to delete this{' '}
            <strong className="text-white">
              {deletingItem?.event_type === 'transfer' ? 'transfer' : 'transaction'}
            </strong>
            {deletingItem?.description ? ` (${deletingItem.description})` : ''}? This action cannot be undone.
          </span>
        }
        isPending={isDeletePending}
        onConfirm={handleConfirmDelete}
      />

      {/* Create Account Modal */}
      <Dialog open={isCreateAccountModalOpen} onOpenChange={setIsCreateAccountModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Create New Account</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createAccountMutation.mutate();
            }}
            className="space-y-4 pt-2"
          >
            <div>
              <Label className="text-xs text-slate-300">Account Name</Label>
              <Input
                placeholder="e.g. HDFC Salary, Zerodha Trading"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                required
                className="mt-1 bg-slate-800 border-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-300">Account Type</Label>
                <div className="mt-1">
                  <DropdownSelect
                    options={[
                      { value: 'bank', label: 'Bank Account' },
                      { value: 'brokerage', label: 'Brokerage / Demat' },
                      { value: 'wallet', label: 'Wallet / Cash' },
                      { value: 'card', label: 'Credit Card' },
                    ]}
                    value={newAccType}
                    onChange={(v) => setNewAccType(v as AccountType)}
                    placeholder="Select account type"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-300">Currency</Label>
                <Input
                  placeholder="INR, USD, EUR"
                  value={newAccCurrency}
                  onChange={(e) => setNewAccCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  required
                  className="mt-1 font-mono uppercase bg-slate-800 border-slate-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateAccountModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createAccountMutation.isPending || !newAccName.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};
