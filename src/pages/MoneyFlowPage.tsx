import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  Banknote,
  Building2,
  Coins,
  PieChart,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { DropdownSelect } from '../components/DropdownSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AccountMap } from '../components/finance/AccountMap';
import { ActivityFeedTimeline } from '../components/finance/ActivityFeedTimeline';
import { AccountDetailView } from '../components/finance/AccountDetailView';
import { TransferModal } from '../components/finance/TransferModal';
import { DividendModal } from '../components/finance/DividendModal';
import { financeService } from '../services/finance';
import { investingService } from '../services/investing';
import { useInvalidatingMutation } from '../hooks/useInvalidatingMutation';
import { queryKeys } from '../lib/queryKeys';
import { formatCurrency } from '../utils/numberFormat';
import { useDisplayProfile } from '../hooks/useDisplayProfile';
import type { Account, AccountType } from '../types/finance';

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

  // Fetch Investing Summary
  const investingSummaryRes = useQuery({
    queryKey: queryKeys.investing.summary(),
    queryFn: () => investingService.getSummary(),
  });

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

  // Calculate balances per account
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

  // Portfolio allocation by brokerage account
  const portfolioByAccountId = useMemo(() => {
    const map: Record<string, { totalInvested: number; holdingsCount: number }> = {};
    const summary = investingSummaryRes.data;
    const brokerageAccounts = accounts.filter((a) => a.account_type === 'brokerage');
    if (summary) {
      const invTotal = Number(summary.portfolio_value || 0);
      const holdingsCount = summary.holdings_count || 0;
      brokerageAccounts.forEach((a) => {
        map[a.public_id] = {
          totalInvested: invTotal / (brokerageAccounts.length || 1),
          holdingsCount,
        };
      });
    }
    return map;
  }, [investingSummaryRes.data, accounts]);

  // Compute Total Hero Metrics
  const { totalSpendingCash, totalInvestingCash, totalNetWorth } = useMemo(() => {
    const spendingCash = Number(netWorthRes.data?.spending_total || 0);
    const investingCash = Number(netWorthRes.data?.investing_cash_total || 0);
    const netWorth = Number(netWorthRes.data?.total_net_worth || 0);

    return {
      totalSpendingCash: spendingCash,
      totalInvestingCash: investingCash,
      totalNetWorth: netWorth || spendingCash + investingCash,
    };
  }, [netWorthRes.data]);

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
    setFeedOffset(0);
    setSearchParams((prev) => {
      if (eventType) {
        prev.set('type', eventType);
      } else {
        prev.delete('type');
      }
      return prev;
    });
  };

  const handleOpenTransfer = (fromId?: string) => {
    setTransferDefaultFromId(fromId);
    setIsTransferModalOpen(true);
  };

  const handleOpenDividend = (brokerageId?: string) => {
    setDividendDefaultBrokerageId(brokerageId);
    setIsDividendModalOpen(true);
  };

  const createAccountMutation = useInvalidatingMutation(
    async () => {
      if (!newAccName.trim()) throw new Error('Account name is required');
      await financeService.createAccount({
        name: newAccName.trim(),
        account_type: newAccType,
        default_currency_code: newAccCurrency.trim().toUpperCase(),
      });
    },
    [queryKeys.finance.all, queryKeys.dashboard.all],
    {
      successMessage: 'Account created successfully',
      onSuccess: () => {
        setIsCreateAccountModalOpen(false);
        setNewAccName('');
      },
    },
  );

  const primaryCurrency = accounts[0]?.default_currency_code ?? 'INR';

  return (
    <PageShell>
      <PageHero
        title="Money & Accounts"
        subtitle="Unified ledger across banks, brokerage cash, capital transfers, trades, and dividends."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => handleOpenTransfer()}
              className="gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-900/20"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transfer Money
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleOpenDividend()}
              className="gap-1.5 border border-slate-700 bg-slate-800/80 text-emerald-300 hover:bg-slate-700"
            >
              <Coins className="h-4 w-4" />
              + Dividend
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsCreateAccountModalOpen(true)}
              className="gap-1.5 border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
          </div>
        }
      />

      {/* Hero Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Spending Cash */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Spending & Bank Cash</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-white">
              {formatCurrency(
                totalSpendingCash,
                primaryCurrency,
                displayProfile.currencyDisplay,
                displayProfile.locale,
                displayProfile.decimalPlaces,
              )}
            </span>
            <p className="mt-0.5 text-xs text-slate-500">Available across liquid & bank accounts</p>
          </div>
        </div>

        {/* Investing Cash */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Brokerage Uninvested Cash</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-emerald-400">
              {formatCurrency(
                totalInvestingCash,
                primaryCurrency,
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
                primaryCurrency,
                displayProfile.currencyDisplay,
                displayProfile.locale,
                displayProfile.decimalPlaces,
              )}
            </span>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-xs text-slate-500">Cash + Portfolio value</span>
              <a href="/net-worth" className="text-xs text-cyan-400 hover:underline">
                Net worth view →
              </a>
            </div>
          </div>
        </div>
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
          onOpenDividend={handleOpenDividend}
          onOpenOrder={() => navigate('/portfolio')}
        />
      ) : (
        /* Account Map + Unified Activity Feed */
        <div className="space-y-6">
          {/* Visual 3-Lane Account Map */}
          <AccountMap
            accounts={accounts}
            balancesByAccountId={balancesByAccountId}
            portfolioByAccountId={portfolioByAccountId}
            onSelectAccount={handleSelectAccount}
            onOpenTransfer={handleOpenTransfer}
            onOpenDividend={handleOpenDividend}
            onOpenOrder={() => navigate('/portfolio')}
            onOpenCreateAccount={() => setIsCreateAccountModalOpen(true)}
            selectedAccountId={selectedAccountId}
          />

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
            />
          </div>
        </div>
      )}

      {/* Modals */}
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
