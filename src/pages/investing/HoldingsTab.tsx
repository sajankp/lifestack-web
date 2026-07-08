import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowDownUp, ArrowUp, Check, Edit2, Info, RefreshCw, Trash2, X } from 'lucide-react';
import { financeService } from '../../services/finance';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { investingService } from '../../services/investing';
import type { InvestingOrder } from '../../services/investing';
import { formatCurrency, toNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { CompactFilterBar, CompactFilterField } from '../../components/filters/CompactFilterBar';
import { queryKeys } from '../../lib/queryKeys';
import { DropdownSelect } from '../../components/DropdownSelect';
import { CurrencyBadge } from '../../components/finance/Badges';
import { Button } from '../../components/ui/button';
import { ToggleSwitch } from '../../components/ui/toggle-switch';
import { SkeletonList } from '../../components/ui/FeedbackStates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import type { Holding, InstrumentType } from '../../types/investing';
import { SortableHeader } from './components';
import {
  deriveBookValue,
  formatLocalDateInput,
  instrumentTypeLabel,
  instrumentTypeOptions,
  type SortDir,
} from './format';

const refreshKeys = [queryKeys.investing.all, queryKeys.finance.all, queryKeys.dashboard.all];

// Mobile sort options. Values mirror the desktop SortableHeader `col` props
// (and the sortedHoldings switch), so the mobile dropdown and the desktop
// column-header clicks drive the exact same state — they never disagree.
const HOLDINGS_SORT_OPTIONS = [
  { value: 'symbol', label: 'Symbol' },
  { value: 'instrument_type', label: 'Asset Type' },
  { value: 'account_name', label: 'Account' },
  { value: 'currency', label: 'Currency' },
  { value: 'quantity', label: 'Qty' },
  { value: 'avg_cost', label: 'Avg Cost' },
  { value: 'book_value', label: 'Book Value' },
  { value: 'current_price', label: 'Unit Price' },
  { value: 'current_value', label: 'Current Value' },
  { value: 'gain_loss', label: 'Gain / Loss' },
];

interface HoldingsTabProps {
  currencyDisplayPreference: 'symbol' | 'code';
  onEditOrder: (order: InvestingOrder) => void;
  onDeleteOrder: (order: InvestingOrder) => void;
  deleteOrderPending: boolean;
  updateOrderPending: boolean;
}

export const HoldingsTab: React.FC<HoldingsTabProps> = ({
  currencyDisplayPreference,
  onEditOrder,
  onDeleteOrder,
  deleteOrderPending,
  updateOrderPending,
}) => {
  const [holdingsAccountFilter, setHoldingsAccountFilter] = useState('');
  const [holdingsCurrencyFilter, setHoldingsCurrencyFilter] = useState('');
  const [holdingsTypeFilter, setHoldingsTypeFilter] = useState('');
  const [holdingsSearch, setHoldingsSearch] = useState('');
  const [hideZeroBookValue, setHideZeroBookValue] = useState(false);
  const [holdingsSortCol, setHoldingsSortCol] = useState('symbol');
  const [holdingsSortDir, setHoldingsSortDir] = useState<SortDir>('asc');

  const [isEditHoldingModalOpen, setIsEditHoldingModalOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [editHoldingForm, setEditHoldingForm] = useState({
    symbol: '',
    quantity: '',
    avg_cost: '',
    currency: 'USD',
    instrument_type: 'stock' as InstrumentType,
  });
  const [pendingDeleteHolding, setPendingDeleteHolding] = useState<Holding | null>(null);
  const [editingPriceHoldingId, setEditingPriceHoldingId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [tradeHistoryHolding, setTradeHistoryHolding] = useState<Holding | null>(null);

  const holdingsRes = useQuery({
    queryKey: queryKeys.investing.holdings(),
    queryFn: () => investingService.getHoldings(200, 0),
  });

  const summary = useQuery({
    queryKey: queryKeys.investing.summary(),
    queryFn: () => investingService.getSummary(),
  });

  const instrumentsRes = useQuery({
    queryKey: queryKeys.investing.instruments(),
    queryFn: () => investingService.getInstruments(),
  });
  const instruments = useMemo(() => instrumentsRes.data ?? [], [instrumentsRes.data]);

  const currenciesRes = useQuery({
    queryKey: queryKeys.finance.currencies(),
    queryFn: () => financeService.getCurrencies(),
  });
  const currencies = useMemo(() => currenciesRes.data ?? [], [currenciesRes.data]);
  const currencyOptions = useMemo(() => currencies.map((currency) => currency.code), [currencies]);
  const currencyDropdownOptions = useMemo(
    () => currencyOptions.map((code) => ({ value: code, label: code })),
    [currencyOptions]
  );

  const accountsRes = useQuery({
    queryKey: queryKeys.finance.accounts(),
    queryFn: () => financeService.getAccounts(200, 0),
  });
  const accounts = useMemo(() => accountsRes.data?.items ?? [], [accountsRes.data]);
  const accountDropdownOptions = useMemo(
    () => accounts.map((acc) => ({ value: acc.public_id, label: acc.name })),
    [accounts]
  );

  const tradeHistoryRes = useQuery({
    queryKey: queryKeys.investing.ordersByHolding(tradeHistoryHolding?.symbol, tradeHistoryHolding?.account_id),
    queryFn: () => {
      if (!tradeHistoryHolding) return Promise.resolve([]);
      return investingService.getOrdersForHolding(
        tradeHistoryHolding.symbol,
        tradeHistoryHolding.account_id
      );
    },
    enabled: tradeHistoryHolding != null,
  });

  const sortedTradeHistory = useMemo(() => {
    const data = tradeHistoryRes.data ?? [];
    return [...data].sort((a, b) => {
      const timeA = new Date(a.occurred_at).getTime();
      const timeB = new Date(b.occurred_at).getTime();
      return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
    });
  }, [tradeHistoryRes.data]);

  const updateHoldingMutation = useInvalidatingMutation(
    async (payload: {
      holding: Holding;
      symbol: string;
      quantity?: number;
      avg_cost?: number;
      currency: string;
      instrument_type: InstrumentType;
    }) => {
      const updatedHolding = await investingService.updateHolding(payload.holding.public_id, {
        symbol: payload.symbol,
        ...(payload.quantity !== undefined ? { quantity: payload.quantity } : {}),
        ...(payload.avg_cost !== undefined ? { avg_cost: payload.avg_cost } : {}),
        currency: payload.currency,
        instrument_type: payload.instrument_type,
      });
      return updatedHolding;
    },
    refreshKeys,
    {
      successMessage: 'Holding updated',
      errorMessage: false,
      onSuccess: () => {
        setSelectedHolding(null);
        setIsEditHoldingModalOpen(false);
      },
    },
  );

  const deleteHoldingMutation = useInvalidatingMutation(
    (publicId: string) => investingService.deleteHolding(publicId),
    refreshKeys,
    { successMessage: 'Holding deleted', errorMessage: false, onSuccess: () => setPendingDeleteHolding(null) },
  );

  const refreshPricesMutation = useInvalidatingMutation(
    () => investingService.refreshPrices(),
    refreshKeys,
    { successMessage: 'Prices refreshed' },
  );

  const submitPricesMutation = useInvalidatingMutation(
    (payload: {
      price_date: string;
      prices: Array<{ holding_public_id: string; unit_price: number }>;
    }) => investingService.submitPrices(payload),
    refreshKeys,
    { successMessage: 'Prices submitted', onSuccess: () => setEditingPriceHoldingId(null) },
  );

  const handleStartEditPrice = (h: Holding) => {
    setEditingPriceHoldingId(h.public_id);
    setEditPriceValue(toNumber(h.current_price ?? h.avg_cost).toString());
  };

  const handleSavePrice = (h: Holding) => {
    const priceNum = Number(editPriceValue);
    if (!Number.isFinite(priceNum) || priceNum <= 0) return;
    const todayStr = formatLocalDateInput(new Date());
    submitPricesMutation.mutate({
      price_date: todayStr,
      prices: [
        {
          holding_public_id: h.public_id,
          unit_price: priceNum,
        },
      ],
    });
  };

  const handleStartEditHolding = (holding: Holding) => {
    setSelectedHolding(holding);
    setEditHoldingForm({
      symbol: holding.symbol || '',
      quantity: toNumber(holding.quantity).toString(),
      avg_cost: toNumber(holding.avg_cost).toString(),
      currency: holding.currency || 'USD',
      instrument_type: holding.instrument_type ?? 'stock',
    });
    setIsEditHoldingModalOpen(true);
  };

  const onUpdateHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHolding) return;

    const isOrderDerived = selectedHolding.source_type === 'order';
    const symbol = editHoldingForm.symbol.trim().toUpperCase();
    const currency = editHoldingForm.currency.trim().toUpperCase();
    if (!symbol || !currency) return;

    let qty: number | undefined;
    let cost: number | undefined;
    if (!isOrderDerived) {
      qty = Number(editHoldingForm.quantity);
      cost = Number(editHoldingForm.avg_cost);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0) return;
    }

    updateHoldingMutation.mutate({
      holding: selectedHolding,
      symbol,
      quantity: qty,
      avg_cost: cost,
      currency,
      instrument_type: editHoldingForm.instrument_type,
    });
  };

  const confirmDeleteHolding = () => {
    if (!pendingDeleteHolding) return;
    deleteHoldingMutation.mutate(pendingDeleteHolding.public_id);
  };

  const holdings = useMemo(() => holdingsRes.data?.items ?? [], [holdingsRes.data]);

  const instrumentBySymbol = useMemo(
    () => new Map(instruments.map((i) => [i.symbol, i])),
    [instruments]
  );

  const filteredHoldings = useMemo(() => {
    const q = holdingsSearch.trim().toLowerCase();
    return holdings.filter((holding) => {
      const accountMatch = !holdingsAccountFilter || holding.account_id === holdingsAccountFilter;
      const currencyMatch =
        !holdingsCurrencyFilter || (holding.currency ?? 'USD').toUpperCase() === holdingsCurrencyFilter.toUpperCase();
      const typeMatch = !holdingsTypeFilter || (holding.instrument_type ?? 'stock') === holdingsTypeFilter;
      const bookValueMatch = !hideZeroBookValue || deriveBookValue(holding) !== 0;
      // Substring match on symbol or the resolved instrument name (so a
      // mutual fund with a numeric folio symbol is searchable by name).
      const name = instrumentBySymbol.get(holding.symbol)?.name ?? '';
      const searchMatch =
        !q || holding.symbol.toLowerCase().includes(q) || name.toLowerCase().includes(q);
      return accountMatch && currencyMatch && typeMatch && bookValueMatch && searchMatch;
    });
  }, [
    holdings,
    holdingsAccountFilter,
    holdingsCurrencyFilter,
    holdingsTypeFilter,
    holdingsSearch,
    hideZeroBookValue,
    instrumentBySymbol,
  ]);

  const sortedHoldings = useMemo(() => {
    const dir = holdingsSortDir === 'asc' ? 1 : -1;
    return [...filteredHoldings].sort((a, b) => {
      switch (holdingsSortCol) {
        case 'symbol': return dir * a.symbol.localeCompare(b.symbol);
        case 'instrument_type': return dir * (a.instrument_type ?? 'stock').localeCompare(b.instrument_type ?? 'stock');
        case 'account_name': return dir * a.account_name.localeCompare(b.account_name);
        case 'currency': return dir * (a.currency ?? 'USD').localeCompare(b.currency ?? 'USD');
        case 'quantity': return dir * (toNumber(a.quantity) - toNumber(b.quantity));
        case 'avg_cost': return dir * (toNumber(a.avg_cost) - toNumber(b.avg_cost));
        case 'book_value': return dir * (deriveBookValue(a) - deriveBookValue(b));
        case 'current_price': return dir * (toNumber(a.current_price ?? a.avg_cost) - toNumber(b.current_price ?? b.avg_cost));
        case 'current_value': return dir * (toNumber(a.current_value ?? 0) - toNumber(b.current_value ?? 0));
        case 'gain_loss': return dir * (toNumber(a.gain_loss ?? 0) - toNumber(b.gain_loss ?? 0));
        default: return 0;
      }
    });
  }, [filteredHoldings, holdingsSortCol, holdingsSortDir]);

  const holdingsByCurrency = useMemo(() => {
    return filteredHoldings.reduce<Record<string, number>>((acc, item) => {
      const currency = item.currency?.toUpperCase() || 'USD';
      const value = deriveBookValue(item);
      acc[currency] = (acc[currency] ?? 0) + value;
      return acc;
    }, {});
  }, [filteredHoldings]);
  const holdingCurrencies = Object.keys(holdingsByCurrency);

  const totalBookCost = useMemo(() => {
    if (holdingCurrencies.length === 0) return null;
    if (holdingCurrencies.length === 1) {
      return {
        amount: holdingsByCurrency[holdingCurrencies[0]],
        currency: holdingCurrencies[0],
      };
    }
    const reportingCurrency = summary.data?.reporting_currency;
    if (!reportingCurrency) return null;
    const fxRates = summary.data?.fx_rates_used ?? {};
    let total = 0;
    for (const h of filteredHoldings) {
      const c = (h.currency ?? 'USD').toUpperCase();
      const value = deriveBookValue(h);
      if (c === reportingCurrency.toUpperCase()) {
        total += value;
      } else {
        const rate = fxRates[c];
        if (rate == null) return null; // Missing FX rate, cannot convert
        total += value * toNumber(rate);
      }
    }
    return {
      amount: total,
      currency: reportingCurrency,
    };
  }, [filteredHoldings, holdingCurrencies, holdingsByCurrency, summary.data]);

  const totalCurrentValue = useMemo(() => {
    if (holdingCurrencies.length === 0) return null;
    if (holdingCurrencies.length === 1) {
      const total = filteredHoldings.reduce((acc, item) => {
        const price = toNumber(item.current_price ?? item.avg_cost);
        return acc + toNumber(item.quantity) * price;
      }, 0);
      return {
        amount: total,
        currency: holdingCurrencies[0],
      };
    }
    const reportingCurrency = summary.data?.reporting_currency;
    if (!reportingCurrency) return null;
    const fxRates = summary.data?.fx_rates_used ?? {};
    let total = 0;
    for (const h of filteredHoldings) {
      const c = (h.currency ?? 'USD').toUpperCase();
      const price = toNumber(h.current_price ?? h.avg_cost);
      const value = toNumber(h.quantity) * price;
      if (c === reportingCurrency.toUpperCase()) {
        total += value;
      } else {
        const rate = fxRates[c];
        if (rate == null) return null; // Missing FX rate, cannot convert
        total += value * toNumber(rate);
      }
    }
    return {
      amount: total,
      currency: reportingCurrency,
    };
  }, [filteredHoldings, holdingCurrencies, summary.data]);

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-3">
          <div data-testid="investing-holdings-heading" className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-white text-base">Active Holdings</h3>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                data-testid="investing-refresh-prices-btn"
                type="button"
                disabled={refreshPricesMutation.isPending}
                onClick={() => refreshPricesMutation.mutate()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-700/80 px-3 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshPricesMutation.isPending ? 'animate-spin' : ''}`} />
                {refreshPricesMutation.isPending ? 'Syncing close...' : 'Sync Latest Close'}
              </button>
            </div>
          </div>

          <CompactFilterBar
            title="Holdings filters"
            onReset={() => {
              setHoldingsAccountFilter('');
              setHoldingsCurrencyFilter('');
              setHoldingsTypeFilter('');
              setHoldingsSearch('');
              setHideZeroBookValue(false);
            }}
          >
            <CompactFilterField label="Search">
              <input
                type="text"
                data-testid="investing-holdings-search"
                placeholder="Symbol or name…"
                value={holdingsSearch}
                onChange={(e) => setHoldingsSearch(e.target.value)}
                className="w-40 rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-1.5 text-sm text-white placeholder:text-slate-500"
              />
            </CompactFilterField>
            <CompactFilterField label="Account">
              <DropdownSelect
                testId="investing-holdings-account-filter"
                value={holdingsAccountFilter}
                options={accountDropdownOptions}
                onChange={setHoldingsAccountFilter}
                placeholder="All accounts"
                clearLabel="All accounts"
              />
            </CompactFilterField>
            <CompactFilterField label="Currency">
              <DropdownSelect
                value={holdingsCurrencyFilter}
                options={currencyDropdownOptions}
                onChange={setHoldingsCurrencyFilter}
                placeholder="All currencies"
                clearLabel="All currencies"
              />
            </CompactFilterField>
            <CompactFilterField label="Asset Type">
              <DropdownSelect
                testId="investing-holdings-type-filter"
                value={holdingsTypeFilter}
                options={[...instrumentTypeOptions]}
                onChange={setHoldingsTypeFilter}
                placeholder="All types"
                clearLabel="All types"
              />
            </CompactFilterField>
            <CompactFilterField label="Book Value">
              <ToggleSwitch
                testId="investing-holdings-hide-zero-book-value"
                checked={hideZeroBookValue}
                onChange={setHideZeroBookValue}
                label="Hide zero book value"
              />
            </CompactFilterField>
          </CompactFilterBar>

          {/* Mobile / tablet card list — the wide table is desktop-only.
              Inline price editing stays on the desktop table; use the edit
              holding action here. Action buttons use -m testids so the
              canonical desktop testids resolve to exactly one element. */}
          <div className="space-y-3 lg:hidden">
            {holdingsRes.isLoading ? (
              <SkeletonList rows={3} />
            ) : sortedHoldings.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 text-center text-sm text-slate-400">No holdings yet.</div>
            ) : (
              <>
              {/* Mobile sort control — the desktop equivalent is clicking a
                  column header, which the card layout has no room for. Drives
                  the same holdingsSortCol / holdingsSortDir state. */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="mb-1 text-xs text-slate-400">Sort by</p>
                  <DropdownSelect
                    testId="investing-holdings-sort-mobile"
                    value={holdingsSortCol}
                    options={HOLDINGS_SORT_OPTIONS}
                    onChange={setHoldingsSortCol}
                    placeholder="Sort by"
                  />
                </div>
                <button
                  type="button"
                  data-testid="investing-holdings-sort-dir-mobile"
                  onClick={() => setHoldingsSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 text-sm text-slate-200 hover:bg-slate-700/60"
                  title={holdingsSortDir === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {holdingsSortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  {holdingsSortDir === 'asc' ? 'Asc' : 'Desc'}
                </button>
              </div>
              {sortedHoldings.map((h) => {
                const gainLoss = toNumber(h.gain_loss ?? 0);
                const gainLossPct = toNumber(h.gain_loss_pct ?? 0);
                const isPositive = gainLoss > 0;
                const isNegative = gainLoss < 0;
                const colorClass = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-400';
                const sign = isPositive ? '+' : '';
                const isMF = h.instrument_type === 'mutual_fund';
                const matchedInstrument = isMF ? instrumentBySymbol.get(h.symbol) : undefined;
                const displayName = matchedInstrument?.name ?? h.symbol;
                return (
                  <div key={h.public_id} className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{displayName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex rounded border border-slate-600/70 px-2 py-0.5 text-[11px] text-slate-200">{instrumentTypeLabel(h.instrument_type)}</span>
                          <CurrencyBadge code={h.currency} />
                          <span className="text-[11px] text-slate-500">{h.account_name}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-white">{formatCurrency(h.current_value ?? deriveBookValue(h), h.currency, currencyDisplayPreference)}</p>
                        <p className={`text-xs font-medium ${colorClass}`}>{sign}{formatCurrency(gainLoss, h.currency, currencyDisplayPreference)} ({sign}{gainLossPct.toFixed(2)}%)</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700/40 pt-3 text-xs">
                      <div><span className="block text-slate-500">Qty</span><span className="text-slate-200">{toNumber(h.quantity).toFixed(2)}</span></div>
                      <div><span className="block text-slate-500">Avg cost</span><span className="text-slate-200">{formatCurrency(h.avg_cost, h.currency, currencyDisplayPreference)}</span></div>
                      <div><span className="block text-slate-500">Price</span><span className="text-slate-200">{formatCurrency(h.current_price ?? h.avg_cost, h.currency, currencyDisplayPreference)}</span></div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        data-testid={`investing-edit-holding-m-${h.public_id}`}
                        disabled={deleteHoldingMutation.isPending}
                        onClick={() => handleStartEditHolding(h)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/70 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/60 disabled:opacity-60"
                      >
                        <Edit2 className="h-4 w-4" /> Edit
                      </button>
                      <button
                        type="button"
                        data-testid={`investing-holding-trade-history-m-${h.public_id}`}
                        disabled={deleteHoldingMutation.isPending}
                        onClick={() => setTradeHistoryHolding(h)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/70 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700/60 disabled:opacity-60"
                      >
                        <ArrowDownUp className="h-4 w-4" /> History
                      </button>
                      <button
                        type="button"
                        disabled={deleteHoldingMutation.isPending}
                        onClick={() => setPendingDeleteHolding(h)}
                        className="inline-flex items-center rounded-lg border border-rose-500/40 p-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
                        title="Delete holding"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              </>
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 lg:block">
            <table className="w-full text-left text-sm text-slate-300 min-w-[1000px]">
              <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
                <tr>
                  <SortableHeader col="symbol" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Symbol</SortableHeader>
                  <SortableHeader col="instrument_type" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Asset Type</SortableHeader>
                  <SortableHeader col="account_name" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Account</SortableHeader>
                  <SortableHeader col="currency" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Currency</SortableHeader>
                  <SortableHeader col="quantity" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Qty</SortableHeader>
                  <SortableHeader col="avg_cost" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Avg Cost</SortableHeader>
                  <SortableHeader col="book_value" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Book Value</SortableHeader>
                  <SortableHeader col="current_price" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Unit Price</SortableHeader>
                  <SortableHeader col="current_value" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Current Value</SortableHeader>
                  <SortableHeader col="gain_loss" activeCol={holdingsSortCol} dir={holdingsSortDir} onSort={(c, d) => { setHoldingsSortCol(c); setHoldingsSortDir(d); }}>Gain / Loss</SortableHeader>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {holdingsRes.isLoading ? (
                  <tr><td className="px-4 py-6 text-slate-400" colSpan={11}>Loading holdings…</td></tr>
                ) : sortedHoldings.length === 0 ? (
                  <tr><td className="px-4 py-6 text-slate-400" colSpan={11}>No holdings yet.</td></tr>
                ) : (
                  sortedHoldings.map((h) => {
                    const gainLoss = toNumber(h.gain_loss ?? 0);
                    const gainLossPct = toNumber(h.gain_loss_pct ?? 0);
                    const isPositive = gainLoss > 0;
                    const isNegative = gainLoss < 0;
                    const colorClass = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-400';
                    const sign = isPositive ? '+' : '';
                    const isMF = h.instrument_type === 'mutual_fund';
                    const matchedInstrument = isMF ? instrumentBySymbol.get(h.symbol) : undefined;
                    const displayName = matchedInstrument?.name ?? h.symbol;
                    return (
                      <tr key={h.public_id} data-testid={`investing-holding-row-${h.public_id}`}>
                        <td data-testid={`investing-holding-symbol-${h.symbol}`} className="px-4 py-3 font-medium text-white">
                          {isMF ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span>{displayName}</span>
                              <span className="group relative inline-flex">
                                <Info className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300 cursor-default" />
                                <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-max max-w-[200px] -translate-x-1/2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-normal text-slate-300 shadow-xl group-hover:block">
                                  {h.symbol}
                                </span>
                              </span>
                            </span>
                          ) : h.symbol}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded border border-slate-600/70 px-2 py-0.5 text-xs text-slate-200">
                            {instrumentTypeLabel(h.instrument_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{h.account_name}</td>
                        <td className="px-4 py-3">
                          <CurrencyBadge code={h.currency} />
                        </td>
                        <td className="px-4 py-3">{toNumber(h.quantity).toFixed(8)}</td>
                        <td className="px-4 py-3">{formatCurrency(h.avg_cost, h.currency, currencyDisplayPreference)}</td>
                        <td className="px-4 py-3">{formatCurrency(deriveBookValue(h), h.currency, currencyDisplayPreference)}</td>
                        <td className="px-4 py-3">
                          {editingPriceHoldingId === h.public_id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                data-testid={`investing-price-input-${h.public_id}`}
                                type="number"
                                step="0.01"
                                className="w-20 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-xs text-white"
                                value={editPriceValue}
                                onChange={(e) => setEditPriceValue(e.target.value)}
                                autoFocus
                              />
                              <button
                                data-testid={`investing-save-price-${h.public_id}`}
                                onClick={() => handleSavePrice(h)}
                                disabled={submitPricesMutation.isPending}
                                className="text-green-400 hover:text-green-300 disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingPriceHoldingId(null)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              <span>{formatCurrency(h.current_price ?? h.avg_cost, h.currency, currencyDisplayPreference)}</span>
                              <button
                                data-testid={`investing-edit-price-${h.public_id}`}
                                onClick={() => handleStartEditPrice(h)}
                                className="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Override current price"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{formatCurrency(h.current_value ?? deriveBookValue(h), h.currency, currencyDisplayPreference)}</td>
                        <td className="px-4 py-3 font-medium">
                          <span className={colorClass}>
                            {sign}{formatCurrency(gainLoss, h.currency, currencyDisplayPreference)} ({sign}{gainLossPct.toFixed(2)}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              data-testid={`investing-edit-holding-${h.public_id}`}
                              onClick={() => handleStartEditHolding(h)}
                              className="rounded-lg border border-slate-600/70 p-2 text-slate-200 hover:bg-slate-700/60"
                              title="Edit holding"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              data-testid={`investing-holding-trade-history-${h.public_id}`}
                              onClick={() => setTradeHistoryHolding(h)}
                              className="rounded-lg border border-slate-600/70 p-2 text-slate-300 hover:bg-slate-700/60"
                              title="Trade History"
                            >
                              <ArrowDownUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={deleteHoldingMutation.isPending}
                              onClick={() => setPendingDeleteHolding(h)}
                              className="rounded-lg border border-rose-500/40 p-2 text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                              title="Delete holding"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {sortedHoldings.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-700/50 bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-400 font-semibold" colSpan={6}>Total Cost & Value</td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {totalBookCost != null
                        ? formatCurrency(totalBookCost.amount, totalBookCost.currency, currencyDisplayPreference)
                        : 'N/A (multi-currency)'}
                    </td>
                    <td />
                    <td className="px-4 py-3 font-semibold text-white">
                      {totalCurrentValue != null
                        ? formatCurrency(totalCurrentValue.amount, totalCurrentValue.currency, currencyDisplayPreference)
                        : 'N/A (multi-currency)'}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </div>

      {/* Trade History Modal */}
      {tradeHistoryHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Trade History — {tradeHistoryHolding.symbol} ({tradeHistoryHolding.account_name})
              </h2>
              <button
                type="button"
                onClick={() => setTradeHistoryHolding(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-xl border border-slate-700/50">
              <table data-testid="investing-trade-history-table" className="w-full text-sm">
                <thead className="border-b border-slate-700/50 bg-slate-800/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Net</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Realized G/L</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {tradeHistoryRes.isLoading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                  ) : sortedTradeHistory.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No trades found.</td></tr>
                  ) : (
                    sortedTradeHistory.map((o) => {
                        const isBuy = o.order_type === 'buy';
                        return (
                          <tr
                            key={o.public_id}
                            data-testid={`investing-trade-history-row-${o.public_id}`}
                            className="bg-slate-900/20 hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                              {formatDate(o.occurred_at, { fallback: 'N/A' })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${isBuy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                {isBuy ? 'BUY' : 'SELL'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300">{toNumber(o.quantity).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-slate-300">
                              {formatCurrency(toNumber(o.price_per_unit), o.currency, currencyDisplayPreference)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-white">
                              {formatCurrency(toNumber(o.net_amount), o.currency, currencyDisplayPreference)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {o.realized_gain_loss != null ? (
                                <span className={toNumber(o.realized_gain_loss) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                                  {formatCurrency(toNumber(o.realized_gain_loss), o.currency, currencyDisplayPreference)}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  data-testid={`investing-trade-history-edit-${o.public_id}`}
                                  disabled={deleteOrderPending || updateOrderPending}
                                  onClick={() => onEditOrder(o)}
                                  className="rounded-lg border border-slate-600/70 p-2 text-slate-200 hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Edit order"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  data-testid={`investing-trade-history-delete-${o.public_id}`}
                                  disabled={deleteOrderPending || updateOrderPending}
                                  onClick={() => onDeleteOrder(o)}
                                  className="rounded-lg border border-rose-500/40 p-2 text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Delete order"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Holding Modal */}
      {isEditHoldingModalOpen && selectedHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => {
              setIsEditHoldingModalOpen(false);
              setSelectedHolding(null);
            }}
          />
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-semibold text-white">Edit Holding</h2>
              <button
                type="button"
                onClick={() => {
                  setIsEditHoldingModalOpen(false);
                  setSelectedHolding(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                title="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              data-testid="investing-edit-holding-form"
              onSubmit={onUpdateHolding}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-300">Symbol</label>
                    <span className="group relative inline-flex">
                      <button
                        type="button"
                        aria-label="Symbol input help"
                        className="rounded-full text-slate-500 transition-colors hover:text-cyan-300 focus:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-72 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-normal leading-relaxed text-slate-300 shadow-xl group-hover:block group-focus-within:block"
                      >
                        Stocks/ETFs: use the exchange ticker, such as DRREDDY or PHARMABEES.
                        Indian mutual funds: use the numeric AMFI scheme code, such as 122639—not
                        the fund name or ISIN.
                      </span>
                    </span>
                  </div>
                  <input
                    data-testid="investing-edit-holding-symbol"
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    value={editHoldingForm.symbol}
                    onChange={(event) =>
                      setEditHoldingForm((state) => ({ ...state, symbol: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Asset Type</label>
                  <DropdownSelect
                    testId="investing-edit-holding-instrument-type"
                    value={editHoldingForm.instrument_type}
                    options={[...instrumentTypeOptions]}
                    onChange={(value) =>
                      setEditHoldingForm((s) => ({
                        ...s,
                        instrument_type: value as InstrumentType,
                      }))
                    }
                    placeholder="Asset type"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Account</label>
                  <input
                    data-testid="investing-edit-holding-account"
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300 focus:outline-none"
                    value={selectedHolding.account_name}
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Currency</label>
                  <DropdownSelect
                    testId="investing-edit-holding-currency"
                    value={editHoldingForm.currency}
                    options={currencyDropdownOptions}
                    onChange={(value) => setEditHoldingForm((s) => ({ ...s, currency: value }))}
                    placeholder="Currency"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Quantity</label>
                  <input
                    data-testid="investing-edit-holding-quantity"
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                    type="number"
                    step="0.00000001"
                    value={editHoldingForm.quantity}
                    onChange={(e) => setEditHoldingForm((s) => ({ ...s, quantity: e.target.value }))}
                    disabled={selectedHolding.source_type === 'order'}
                    required={selectedHolding.source_type !== 'order'}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Avg Cost</label>
                  <input
                    data-testid="investing-edit-holding-avg-cost"
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                    type="number"
                    step="0.01"
                    value={editHoldingForm.avg_cost}
                    onChange={(e) => setEditHoldingForm((s) => ({ ...s, avg_cost: e.target.value }))}
                    disabled={selectedHolding.source_type === 'order'}
                    required={selectedHolding.source_type !== 'order'}
                  />
                </div>
              </div>
              {selectedHolding.source_type === 'order' && (
                <p className="text-xs text-slate-500">
                  Quantity and average cost are computed from orders — edit the order history to
                  change these.
                </p>
              )}

              {updateHoldingMutation.isError && (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {(updateHoldingMutation.error as Error)?.message ?? 'Failed to update holding'}
                </p>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditHoldingModalOpen(false);
                    setSelectedHolding(null);
                  }}
                  className="h-10 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  data-testid="investing-edit-holding-submit"
                  disabled={updateHoldingMutation.isPending}
                  type="submit"
                  className="h-10 flex-1 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateHoldingMutation.isPending ? 'Saving...' : 'Save Holding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Dialog
        open={!!pendingDeleteHolding}
        onOpenChange={(open) => !open && !deleteHoldingMutation.isPending && setPendingDeleteHolding(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete holding?</DialogTitle>
            <DialogDescription>
              {pendingDeleteHolding
                ? `Delete the ${pendingDeleteHolding.symbol} holding in ${pendingDeleteHolding.account_name}? This does not delete any orders.`
                : 'This does not delete any orders.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingDeleteHolding(null)}
              disabled={deleteHoldingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-rose-300 hover:text-rose-200"
              onClick={confirmDeleteHolding}
              disabled={deleteHoldingMutation.isPending}
            >
              {deleteHoldingMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
          {deleteHoldingMutation.isError && (
            <p className="mt-2 text-sm text-rose-400 text-right">
              {(deleteHoldingMutation.error as Error)?.message ?? 'Failed to delete holding'}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
