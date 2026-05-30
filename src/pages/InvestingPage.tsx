import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Landmark, Layers, Plus, Trash2, WalletCards } from 'lucide-react';
import { financeService } from '../services/finance';
import { investingService } from '../services/investing';
import { formatCurrency, toNumber } from '../utils/numberFormat';
import { DatePicker } from '../components/DatePicker';
import { DropdownSelect } from '../components/DropdownSelect';
import { Combobox } from '../components/Combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import type {
  CashBalanceCreate,
  HoldingCreate,
  InstrumentConstituentUpsert,
  InstrumentCreate,
} from '../types/investing';

const formatDateInput = (d: Date): string => {
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
};

const formatDateTimeLocalInput = (d: Date): string => {
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

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
  const [tab, setTab] = useState<'holdings' | 'cash' | 'analytics'>('holdings');
  const [analyticsAsOf, setAnalyticsAsOf] = useState(formatDateInput(new Date()));

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
    as_of: formatDateTimeLocalInput(new Date()),
  });

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card'>('brokerage');
  const [instrumentForm, setInstrumentForm] = useState<InstrumentCreate>({
    symbol: '',
    name: '',
    instrument_type: 'etf',
  });
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [constituentRowsText, setConstituentRowsText] = useState('AAPL,0.60\nMSFT,0.40');
  const [constituentError, setConstituentError] = useState('');

  const { data: holdingsRes } = useQuery({
    queryKey: ['investing', 'holdings'],
    queryFn: () => investingService.getHoldings(200, 0),
  });

  const { data: cashRes } = useQuery({
    queryKey: ['investing', 'cash-balances'],
    queryFn: () => investingService.getCashBalances(200, 0),
  });

  const { data: summary } = useQuery({
    queryKey: ['investing', 'summary'],
    queryFn: () => investingService.getSummary(),
  });
  const { data: performanceSummary, isLoading: performanceLoading } = useQuery({
    queryKey: ['investing', 'performance', 'summary'],
    queryFn: () => investingService.getPerformanceSummary(),
  });
  const { data: instruments = [], isLoading: instrumentsLoading } = useQuery({
    queryKey: ['investing', 'instruments'],
    queryFn: () => investingService.getInstruments(),
  });
  const { data: exposure, isLoading: exposureLoading } = useQuery({
    queryKey: ['investing', 'analytics', 'exposure', analyticsAsOf],
    queryFn: () => investingService.getExposureAnalytics(analyticsAsOf),
    enabled: tab === 'analytics',
  });
  const { data: overlap, isLoading: overlapLoading } = useQuery({
    queryKey: ['investing', 'analytics', 'overlap', analyticsAsOf],
    queryFn: () => investingService.getOverlapAnalytics(analyticsAsOf),
    enabled: tab === 'analytics',
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ['finance', 'currencies'],
    queryFn: () => financeService.getCurrencies(),
  });

  const { data: accountsRes } = useQuery({
    queryKey: ['finance', 'accounts'],
    queryFn: () => financeService.getAccounts(200, 0),
  });
  const { data: financeSettings } = useQuery({
    queryKey: ['finance', 'settings'],
    queryFn: () => financeService.getSettings(),
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
  const createInstrumentMutation = useMutation({
    mutationFn: (payload: InstrumentCreate) => investingService.createInstrument(payload),
    onSuccess: (created) => {
      setInstrumentForm({
        symbol: '',
        name: '',
        instrument_type: created.instrument_type,
      });
      setSelectedInstrumentId(created.public_id);
      refresh();
    },
  });
  const upsertConstituentsMutation = useMutation({
    mutationFn: async (payload: InstrumentConstituentUpsert) => {
      if (!selectedInstrumentId) return [];
      return investingService.upsertInstrumentConstituents(selectedInstrumentId, payload);
    },
    onSuccess: refresh,
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
        as_of: formatDateTimeLocalInput(new Date()),
      });
      refresh();
    },
  });

  const deleteCashMutation = useMutation({
    mutationFn: (publicId: string) => investingService.deleteCashBalance(publicId),
    onSuccess: refresh,
  });

  const performancePctRaw =
    performanceSummary?.total_gain_loss_pct != null
      ? Number(performanceSummary.total_gain_loss_pct)
      : Number.NaN;
  const performancePctLabel = Number.isNaN(performancePctRaw)
    ? 'N/A'
    : `${performancePctRaw.toFixed(2)}%`;
  const holdings = useMemo(() => holdingsRes?.items ?? [], [holdingsRes]);
  const cashBalances = useMemo(() => cashRes?.items ?? [], [cashRes]);
  const accounts = accountsRes?.items ?? [];
  const accountOptions = accounts.map((account) => account.name);
  const currencyOptions = currencies.map((currency) => currency.code);
  const accountDropdownOptions = useMemo(
    () => accountOptions.map((name) => ({ value: name, label: name })),
    [accountOptions]
  );
  const currencyDropdownOptions = useMemo(
    () => currencyOptions.map((code) => ({ value: code, label: code })),
    [currencyOptions]
  );
  const accountTypeOptions = [
    { value: 'brokerage', label: 'Brokerage' },
    { value: 'bank', label: 'Bank' },
    { value: 'wallet', label: 'Wallet' },
    { value: 'card', label: 'Card' },
    { value: 'gift_card', label: 'Gift Card' },
  ] as const;
  const instrumentTypeOptions = [
    { value: 'stock', label: 'Stock' },
    { value: 'etf', label: 'ETF' },
    { value: 'mutual_fund', label: 'Mutual Fund' },
  ] as const;
  const pooledInstrumentOptions = useMemo(
    () =>
      (instruments ?? [])
        .filter((item) => item.instrument_type !== 'stock')
        .map((item) => ({
          value: item.public_id,
          label: `${item.symbol} (${item.instrument_type})`,
        })),
    [instruments]
  );
  const selectedHoldingAccount = holdingForm.account_name;
  const selectedCashAccount = cashForm.account_name;
  const preferredWorkspaceCurrency =
    (financeSettings?.reporting_currency_code &&
    currencyOptions.includes(financeSettings.reporting_currency_code)
      ? financeSettings.reporting_currency_code
      : null) ?? currencyOptions[0] ?? 'USD';
  const selectedHoldingCurrency =
    currencyOptions.includes(holdingForm.currency) ? holdingForm.currency : preferredWorkspaceCurrency;
  const selectedCashCurrency =
    currencyOptions.includes(cashForm.currency) ? cashForm.currency : preferredWorkspaceCurrency;

  const createAccountMutation = useMutation({
    mutationFn: () =>
      financeService.createAccount({
        name: newAccountName.trim(),
        account_type: newAccountType,
        default_currency_code: selectedHoldingCurrency,
      }),
    onSuccess: (created) => {
      setNewAccountName('');
      setHoldingForm((prev) => ({ ...prev, account_name: created.name }));
      setCashForm((prev) => ({ ...prev, account_name: created.name }));
      refresh();
    },
  });

  const holdingsByCurrency = useMemo(() => {
    return holdings.reduce<Record<string, number>>((acc, item) => {
      const currency = item.currency?.toUpperCase() || 'USD';
      const value = toNumber(item.quantity) * toNumber(item.avg_cost);
      acc[currency] = (acc[currency] ?? 0) + value;
      return acc;
    }, {});
  }, [holdings]);
  const holdingCurrencies = Object.keys(holdingsByCurrency);
  const totalBookCost = holdingCurrencies.length === 1 ? holdingsByCurrency[holdingCurrencies[0]] : null;

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
  const onCreateInstrument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instrumentForm.symbol.trim() || !instrumentForm.name.trim()) return;
    createInstrumentMutation.mutate({
      symbol: instrumentForm.symbol.trim().toUpperCase(),
      name: instrumentForm.name.trim(),
      instrument_type: instrumentForm.instrument_type,
    });
  };

  const onUpsertConstituents = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstrumentId) return;
    setConstituentError('');
    const parsed: Array<{ company_name: string; company_ticker: string; weight: string }> = [];
    const lines = constituentRowsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      setConstituentError('Add at least one constituent row in format: TICKER,0.25');
      return;
    }
    for (const line of lines) {
      const [tickerRaw, weightRaw] = line.split(',').map((v) => v.trim());
      const ticker = (tickerRaw || '').toUpperCase();
      const weightNumber = Number(weightRaw);
      const tickerOk = /^[A-Z0-9.-]{1,20}$/.test(ticker);
      const weightOk = Number.isFinite(weightNumber) && weightNumber > 0 && weightNumber <= 1;
      if (!tickerOk || !weightOk) {
        setConstituentError(
          `Invalid row "${line}". Use TICKER,WEIGHT with weight between 0 and 1.`,
        );
        return;
      }
      parsed.push({
        company_name: ticker,
        company_ticker: ticker,
        weight: weightNumber.toFixed(8),
      });
    }

    upsertConstituentsMutation.mutate({
      as_of_date: analyticsAsOf,
      fetched_at: new Date().toISOString(),
      source: 'manual-ui',
      constituents: parsed,
    });
  };

  return (
    <div className="w-full px-8 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Investing</h1>
          <p className="mt-2 text-slate-400">Manage holdings and cash balances for your workspace.</p>
        </div>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Portfolio value"
          value={summary?.portfolio_value != null ? formatCurrency(summary.portfolio_value, summary.reporting_currency ?? preferredWorkspaceCurrency) : 'N/A'}
          icon={<Landmark className="h-5 w-5" />}
        />
        <SummaryCard
          label="Cash total"
          value={summary?.cash_total != null ? formatCurrency(summary.cash_total, summary.reporting_currency ?? preferredWorkspaceCurrency) : 'N/A'}
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
        <p className="mt-1">
          <span className="font-semibold text-slate-100">Performance (gain/loss):</span>{' '}
          {performanceLoading
            ? 'Loading...'
            : performanceSummary
              ? `${formatCurrency(performanceSummary.total_gain_loss, performanceSummary.currency)} (${performancePctLabel})`
              : 'N/A'}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'holdings' | 'cash' | 'analytics')}>
          <TabsList className="mb-6">
            <TabsTrigger value="holdings">Holdings</TabsTrigger>
            <TabsTrigger value="cash">Cash Balances</TabsTrigger>
            <TabsTrigger value="analytics">Look-through Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="holdings">
            <div className="grid gap-6 lg:grid-cols-5">
          <form onSubmit={onCreateHolding} className="space-y-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 lg:col-span-2">
            <h3 className="font-semibold text-white">Add Holding</h3>
            {accountOptions.length === 0 ? (
              <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                Create an account below before adding holdings.
              </div>
            ) : null}
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Symbol (e.g. AAPL)" value={holdingForm.symbol} onChange={(e) => setHoldingForm((s) => ({ ...s, symbol: e.target.value }))} />
            <Combobox
              value={selectedHoldingAccount}
              options={accountDropdownOptions}
              onChange={(value) => setHoldingForm((s) => ({ ...s, account_name: value }))}
              placeholder="Select account"
              searchPlaceholder="Search accounts..."
              clearLabel="Clear selection"
              emptyText="No accounts found."
            />
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Quantity" type="number" step="0.00000001" value={holdingForm.quantity} onChange={(e) => setHoldingForm((s) => ({ ...s, quantity: e.target.value }))} />
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Avg cost" type="number" step="0.01" value={holdingForm.avg_cost} onChange={(e) => setHoldingForm((s) => ({ ...s, avg_cost: e.target.value }))} />
            <DropdownSelect
              value={selectedHoldingCurrency}
              options={currencyDropdownOptions}
              onChange={(value) => setHoldingForm((s) => ({ ...s, currency: value }))}
              placeholder="Currency"
            />
            <button disabled={createHoldingMutation.isPending || accountOptions.length === 0} type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-blue-500">Add holding</button>

            <div className="mt-3 border-t border-slate-700/60 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">Quick Create Account</p>
              <input className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Account name" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} />
              <DropdownSelect
                value={newAccountType}
                options={[...accountTypeOptions]}
                onChange={(value) => setNewAccountType(value as 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card')}
                placeholder="Account type"
              />
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
                    <td className="px-4 py-3 font-semibold text-white">
                      {totalBookCost != null
                        ? formatCurrency(totalBookCost, holdingCurrencies[0] ?? 'USD')
                        : 'N/A (multi-currency)'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
            </div>
          </TabsContent>

          <TabsContent value="cash">
            <div className="grid gap-6 lg:grid-cols-5">
          <form onSubmit={onCreateCash} className="space-y-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 lg:col-span-2">
            <h3 className="font-semibold text-white">Add Cash Balance</h3>
            <Combobox
              value={selectedCashAccount}
              options={accountDropdownOptions}
              onChange={(value) => setCashForm((s) => ({ ...s, account_name: value }))}
              placeholder="Select account"
              searchPlaceholder="Search accounts..."
              clearLabel="Clear selection"
              emptyText="No accounts found."
            />
            <input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="Balance" type="number" step="0.01" value={cashForm.balance} onChange={(e) => setCashForm((s) => ({ ...s, balance: e.target.value }))} />
            <DropdownSelect
              value={selectedCashCurrency}
              options={currencyDropdownOptions}
              onChange={(value) => setCashForm((s) => ({ ...s, currency: value }))}
              placeholder="Currency"
            />
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
                      <td className="px-4 py-3">{Number.isNaN(new Date(c.as_of).getTime()) ? "N/A" : new Date(c.as_of).toLocaleString()}</td>
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
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
            <h3 className="font-semibold text-white">Analytics Controls</h3>
            <label className="block text-xs text-slate-300">
              As of date
              <DatePicker
                value={analyticsAsOf}
                onChange={setAnalyticsAsOf}
                placeholder="Select date"
                className="mt-1"
              />
            </label>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 text-xs text-slate-300">
              <p>Coverage: {exposure?.snapshot_coverage ?? 'N/A'}</p>
              <p>Status: {exposure?.analysis_status ?? 'N/A'}</p>
              {!!exposure?.warnings?.length && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-300">
                  {exposure.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <form onSubmit={onCreateInstrument} className="space-y-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
            <h3 className="font-semibold text-white">Create Instrument</h3>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              placeholder="Symbol (e.g. VTI)"
              value={instrumentForm.symbol}
              onChange={(e) => setInstrumentForm((s) => ({ ...s, symbol: e.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              placeholder="Name"
              value={instrumentForm.name}
              onChange={(e) => setInstrumentForm((s) => ({ ...s, name: e.target.value }))}
            />
            <DropdownSelect
              value={instrumentForm.instrument_type}
              options={[...instrumentTypeOptions]}
              onChange={(value) =>
                setInstrumentForm((s) => ({
                  ...s,
                  instrument_type: value as InstrumentCreate['instrument_type'],
                }))
              }
              placeholder="Instrument type"
            />
            <button disabled={createInstrumentMutation.isPending} className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
              Create instrument
            </button>
            <p className="text-xs text-slate-400">
              Instruments: {instrumentsLoading ? 'Loading...' : instruments.length}
            </p>
          </form>

          <form onSubmit={onUpsertConstituents} className="space-y-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
            <h3 className="font-semibold text-white">Seed Constituents</h3>
            <Combobox
              value={selectedInstrumentId}
              options={pooledInstrumentOptions}
              onChange={setSelectedInstrumentId}
              placeholder="Select pooled instrument"
              searchPlaceholder="Search instruments..."
              clearLabel="Clear selection"
              emptyText="No pooled instruments found."
            />
            <textarea
              className="h-28 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              value={constituentRowsText}
              onChange={(e) => setConstituentRowsText(e.target.value)}
            />
            {constituentError ? <p className="text-xs text-rose-300">{constituentError}</p> : null}
            <button disabled={upsertConstituentsMutation.isPending} className="w-full rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-100 hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-60">
              Upsert constituents
            </button>
          </form>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2 text-slate-100">
              <Layers className="h-4 w-4" />
              <h3 className="font-semibold">Exposure (Look-through)</h3>
            </div>
            {exposureLoading ? (
              <p className="text-sm text-slate-400">Loading exposure…</p>
            ) : (
              <div className="space-y-2 text-sm text-slate-300">
                <p>Total direct: {formatCurrency(exposure?.total_direct_exposure ?? '0', preferredWorkspaceCurrency)}</p>
                <p>Total look-through: {formatCurrency(exposure?.total_lookthrough_exposure ?? '0', preferredWorkspaceCurrency)}</p>
                <div className="max-h-56 overflow-auto rounded-lg border border-slate-700/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/60 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Company</th>
                        <th className="px-3 py-2">Direct</th>
                        <th className="px-3 py-2">Look-through</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(exposure?.exposure ?? []).map((row) => (
                        <tr key={row.company_id} className="border-t border-slate-700/40">
                          <td className="px-3 py-2">{row.company_ticker ?? row.company_name}</td>
                          <td className="px-3 py-2">{formatCurrency(row.direct_exposure, preferredWorkspaceCurrency)}</td>
                          <td className="px-3 py-2">{formatCurrency(row.lookthrough_exposure, preferredWorkspaceCurrency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-100">
              <BarChart3 className="h-4 w-4" />
              <h3 className="font-semibold">Overlap</h3>
            </div>
            {overlapLoading ? (
              <p className="text-sm text-slate-400">Loading overlap…</p>
            ) : (
              <div className="space-y-2 text-sm text-slate-300">
                <p>Top 5 concentration: {(toNumber(overlap?.top_5_concentration_pct ?? 0) * 100).toFixed(2)}%</p>
                <p>Duplicate exposure index: {(toNumber(overlap?.duplicate_exposure_index ?? 0) * 100).toFixed(2)}%</p>
                <ol className="space-y-1 text-xs">
                  {(overlap?.overlaps ?? []).slice(0, 8).map((row) => (
                    <li key={row.company_id} className="flex items-center justify-between rounded border border-slate-700/50 px-2 py-1">
                      <span>{row.company_ticker ?? row.company_name}</span>
                      <span>{(toNumber(row.portfolio_share) * 100).toFixed(2)}%</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
            </div>
          </TabsContent>
        </Tabs>
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
