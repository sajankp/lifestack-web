import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus, Trash2, WalletCards } from 'lucide-react';
import { financeService } from '../services/finance';
import { investingService } from '../services/investing';
import type { CashBalanceCreate, HoldingCreate } from '../types/investing';

const toNumber = (value: string | number | null | undefined): number => {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value: string | number, currency: string = 'USD') =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(toNumber(value));

const statusLabel = (status: string | undefined): string => {
  switch (status) {
    case 'empty':
      return 'No investing data yet.';
    case 'single_currency_native':
      return 'Native valuation available (single currency).';
    case 'multi_currency_unconverted':
      return 'Multiple currencies detected. Configure reporting currency + FX conversion.';
    case 'conversion_required':
      return 'Reporting currency set. Conversion data required for totals.';
    case 'converted_available':
      return 'Converted totals available in reporting currency.';
    default:
      return 'Valuation status unavailable.';
  }
};

export const InvestingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'holdings' | 'cash'>('holdings');

  const [holdingForm, setHoldingForm] = useState({
    symbol: '',
    account_name: '',
    quantity: '',
    avg_cost: '',
    currency: 'USD',
  });

  const [cashForm, setCashForm] = useState({
    account_name: '',
    balance: '',
    currency: 'USD',
    as_of: new Date().toISOString().slice(0, 16),
  });

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'bank' | 'brokerage' | 'wallet'>('brokerage');

  const { data: holdingsRes, isLoading: holdingsLoading } = useQuery({
    queryKey: ['investing', 'holdings'],
    queryFn: () => investingService.getHoldings(200, 0),
  });

  const { data: cashRes, isLoading: cashLoading } = useQuery({
    queryKey: ['investing', 'cash-balances'],
    queryFn: () => investingService.getCashBalances(200, 0),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['investing', 'summary'],
    queryFn: () => investingService.getSummary(),
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ['finance', 'currencies'],
    queryFn: () => financeService.getCurrencies(),
  });

  const { data: accountsRes } = useQuery({
    queryKey: ['finance', 'accounts'],
    queryFn: () => financeService.getAccounts(200, 0),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['investing'] });
    void queryClient.invalidateQueries({ queryKey: ['finance'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createHoldingMutation = useMutation({
    mutationFn: (payload: HoldingCreate) => investingService.createHolding(payload),
    onSuccess: () => {
      setHoldingForm((prev) => ({ ...prev, symbol: '', quantity: '', avg_cost: '' }));
      refresh();
    },
  });

  const deleteHoldingMutation = useMutation({
    mutationFn: (publicId: string) => investingService.deleteHolding(publicId),
    onSuccess: refresh,
  });

  const createCashMutation = useMutation({
    mutationFn: (payload: CashBalanceCreate) => investingService.createCashBalance(payload),
    onSuccess: () => {
      setCashForm({
        account_name: cashForm.account_name,
        balance: '',
        currency: cashForm.currency,
        as_of: new Date().toISOString().slice(0, 16),
      });
      refresh();
    },
  });

  const deleteCashMutation = useMutation({
    mutationFn: (publicId: string) => investingService.deleteCashBalance(publicId),
    onSuccess: refresh,
  });

  const isLoading = holdingsLoading || cashLoading || summaryLoading;
  const holdings = useMemo(() => holdingsRes?.items ?? [], [holdingsRes]);
  const cashBalances = useMemo(() => cashRes?.items ?? [], [cashRes]);
  const accounts = accountsRes?.items ?? [];
  const accountOptions = accounts.map((account) => account.name);
  const currencyOptions = currencies.map((currency) => currency.code);
  const selectedHoldingAccount = holdingForm.account_name || accountOptions[0] || '';
  const selectedCashAccount = cashForm.account_name || accountOptions[0] || '';
  const selectedHoldingCurrency =
    currencyOptions.includes(holdingForm.currency) ? holdingForm.currency : (currencyOptions[0] ?? 'USD');
  const selectedCashCurrency =
    currencyOptions.includes(cashForm.currency) ? cashForm.currency : (currencyOptions[0] ?? 'USD');

  const createAccountMutation = useMutation({
    mutationFn: () =>
      financeService.createAccount({
        name: newAccountName.trim(),
        account_type: newAccountType,
        default_currency_code: holdingForm.currency,
      }),
    onSuccess: (created) => {
      setNewAccountName('');
      setHoldingForm((prev) => ({ ...prev, account_name: created.name }));
      setCashForm((prev) => ({ ...prev, account_name: created.name }));
      refresh();
    },
  });

  const totalBookCost = useMemo(
    () => holdings.reduce((acc, item) => acc + toNumber(item.quantity) * toNumber(item.avg_cost), 0),
    [holdings],
  );

  const onCreateHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdingForm.symbol || !holdingForm.quantity || !holdingForm.avg_cost || !selectedHoldingAccount) return;

    createHoldingMutation.mutate({
      symbol: holdingForm.symbol.trim().toUpperCase(),
      account_name: selectedHoldingAccount.trim(),
      quantity: Number(holdingForm.quantity),
      avg_cost: Number(holdingForm.avg_cost),
      currency: selectedHoldingCurrency.trim().toUpperCase() || 'USD',
    });
  };

  const onCreateCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashForm.balance || !cashForm.as_of || !selectedCashAccount) return;

    createCashMutation.mutate({
      account_name: selectedCashAccount.trim(),
      balance: Number(cashForm.balance),
      currency: selectedCashCurrency.trim().toUpperCase() || 'USD',
      as_of: new Date(cashForm.as_of).toISOString(),
    });
  };

  return (
    <div className="mx-auto max-w-6xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Investing</h1>
          <p className="mt-2 text-slate-400">Manage holdings and cash balances for your workspace.</p>
        </div>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Portfolio value"
          value={summary?.portfolio_value != null ? formatCurrency(summary.portfolio_value, summary.reporting_currency ?? 'USD') : 'N/A'}
          icon={<Landmark className="h-5 w-5" />}
        />
        <SummaryCard
          label="Cash total"
          value={summary?.cash_total != null ? formatCurrency(summary.cash_total, summary.reporting_currency ?? 'USD') : 'N/A'}
          icon={<WalletCards className="h-5 w-5" />}
        />
        <SummaryCard label="Holdings" value={summary ? summary.holdings_count.toString() : '0'} icon={<Plus className="h-5 w-5" />} />
      </div>

      <div className="mb-6 rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
        <p>
          <span className="font-semibold text-slate-100">Reporting currency:</span>{' '}
          {summary?.reporting_currency ?? 'Not configured'}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-slate-100">Valuation status:</span>{' '}
          {statusLabel(summary?.valuation_status)}
        </p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-700/50 pb-px">
        <button onClick={() => setTab('holdings')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'holdings' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          Holdings
        </button>
        <button onClick={() => setTab('cash')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'cash' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          Cash Balances
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-blue-500" />
        </div>
      ) : tab === 'holdings' ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <form onSubmit={onCreateHolding} className="space-y-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 lg:col-span-2">
            <h3 className="font-semibold text-white">Add Holding</h3>
            {accountOptions.length === 0 ? (
              <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                Create an account below before adding holdings.
              </div>
            ) : null}
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Symbol (e.g. AAPL)" value={holdingForm.symbol} onChange={(e) => setHoldingForm((s) => ({ ...s, symbol: e.target.value }))} />
            <select className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={selectedHoldingAccount} onChange={(e) => setHoldingForm((s) => ({ ...s, account_name: e.target.value }))}>
              <option value="">Select account</option>
              {accountOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Quantity" type="number" step="0.00000001" value={holdingForm.quantity} onChange={(e) => setHoldingForm((s) => ({ ...s, quantity: e.target.value }))} />
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Avg cost" type="number" step="0.01" value={holdingForm.avg_cost} onChange={(e) => setHoldingForm((s) => ({ ...s, avg_cost: e.target.value }))} />
            <select className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={selectedHoldingCurrency} onChange={(e) => setHoldingForm((s) => ({ ...s, currency: e.target.value }))}>
              {currencyOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <button disabled={createHoldingMutation.isPending || accountOptions.length === 0} type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-blue-500">Add holding</button>

            <div className="mt-3 border-t border-slate-700/60 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">Quick Create Account</p>
              <input className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Account name" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} />
              <select className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={newAccountType} onChange={(e) => setNewAccountType(e.target.value as 'bank' | 'brokerage' | 'wallet')}>
                <option value="brokerage">Brokerage</option>
                <option value="bank">Bank</option>
                <option value="wallet">Wallet</option>
              </select>
              <button
                type="button"
                disabled={!newAccountName.trim() || createAccountMutation.isPending}
                onClick={() => createAccountMutation.mutate()}
                className="w-full rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create account
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 lg:col-span-3">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Avg Cost</th>
                  <th className="px-4 py-3">Book Value</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {holdings.length === 0 ? (
                  <tr><td className="px-4 py-6 text-slate-400" colSpan={5}>No holdings yet.</td></tr>
                ) : (
                  holdings.map((h) => (
                    <tr key={h.public_id}>
                      <td className="px-4 py-3 font-medium text-white">{h.symbol}</td>
                      <td className="px-4 py-3">{toNumber(h.quantity).toFixed(8)}</td>
                      <td className="px-4 py-3">{formatCurrency(h.avg_cost, h.currency)}</td>
                      <td className="px-4 py-3">{formatCurrency(toNumber(h.quantity) * toNumber(h.avg_cost), h.currency)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteHoldingMutation.mutate(h.public_id)} className="rounded-lg border border-rose-500/40 p-2 text-rose-300 hover:bg-rose-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {holdings.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-700/50 bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-400" colSpan={3}>Total book cost</td>
                    <td className="px-4 py-3 font-semibold text-white">{formatCurrency(totalBookCost)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <form onSubmit={onCreateCash} className="space-y-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 lg:col-span-2">
            <h3 className="font-semibold text-white">Add Cash Balance</h3>
            <select className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={selectedCashAccount} onChange={(e) => setCashForm((s) => ({ ...s, account_name: e.target.value }))}>
              <option value="">Select account</option>
              {accountOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Balance" type="number" step="0.01" value={cashForm.balance} onChange={(e) => setCashForm((s) => ({ ...s, balance: e.target.value }))} />
            <select className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" value={selectedCashCurrency} onChange={(e) => setCashForm((s) => ({ ...s, currency: e.target.value }))}>
              {currencyOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" type="datetime-local" value={cashForm.as_of} onChange={(e) => setCashForm((s) => ({ ...s, as_of: e.target.value }))} />
            <button disabled={createCashMutation.isPending || accountOptions.length === 0} type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-blue-500">Add cash balance</button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 lg:col-span-3">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">As Of</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {cashBalances.length === 0 ? (
                  <tr><td className="px-4 py-6 text-slate-400" colSpan={4}>No cash balances yet.</td></tr>
                ) : (
                  cashBalances.map((c) => (
                    <tr key={c.public_id}>
                      <td className="px-4 py-3 text-white">{c.account_name}</td>
                      <td className="px-4 py-3">{formatCurrency(c.balance, c.currency)}</td>
                      <td className="px-4 py-3">{new Date(c.as_of).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteCashMutation.mutate(c.public_id)} className="rounded-lg border border-rose-500/40 p-2 text-rose-300 hover:bg-rose-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
    <div className="mb-2 inline-flex rounded-xl bg-slate-700/60 p-2 text-slate-100">{icon}</div>
    <p className="text-sm text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-bold text-white">{value}</p>
  </div>
);
