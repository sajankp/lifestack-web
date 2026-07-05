import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { financeService } from '../../services/finance';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { investingService } from '../../services/investing';
import type { CashBalance, InvestingOrder, InvestingOrderCreate, OrderType } from '../../services/investing';
import { formatCurrency, toNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { DateTimePicker } from '../../components/DateTimePicker';
import { CompactFilterBar, CompactFilterField } from '../../components/filters/CompactFilterBar';
import { queryKeys } from '../../lib/queryKeys';
import { DropdownSelect } from '../../components/DropdownSelect';
import { Combobox } from '../../components/Combobox';
import { Pagination } from '../../components/Pagination';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import type { CashBalanceCreate } from '../../types/investing';
import { SortableHeader } from './components';
import { accountTypeOptions, formatDateTimeLocalInput, type SortDir } from './format';

const refreshKeys = [queryKeys.investing.all, queryKeys.finance.all, queryKeys.dashboard.all];

interface CashTabProps {
  currencyDisplayPreference: 'symbol' | 'code';
  onEditOrder: (order: InvestingOrder) => void;
  onDeleteOrder: (order: InvestingOrder) => void;
  deleteOrderPending: boolean;
  updateOrderPending: boolean;
}

const ORDERS_PAGE_SIZE = 50;

export const CashTab: React.FC<CashTabProps> = ({
  currencyDisplayPreference,
  onEditOrder,
  onDeleteOrder,
  deleteOrderPending,
  updateOrderPending,
}) => {
  const [cashAccountFilter, setCashAccountFilter] = useState('');
  const [cashCurrencyFilter, setCashCurrencyFilter] = useState('');
  const [cashSortCol, setCashSortCol] = useState('account_name');
  const [cashSortDir, setCashSortDir] = useState<SortDir>('asc');

  const [isAddCashModalOpen, setIsAddCashModalOpen] = useState(false);
  const [cashForm, setCashForm] = useState({
    account_id: '',
    balance: '',
    currency: 'USD',
    as_of: formatDateTimeLocalInput(new Date()),
  });
  const [pendingDeleteCash, setPendingDeleteCash] = useState<CashBalance | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card'>('brokerage');

  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<{
    order_type: OrderType;
    account_id: string;
    symbol: string;
    quantity: string;
    price_per_unit: string;
    currency: string;
    brokerage_fee: string;
    tax_amount: string;
    other_fees: string;
    exchange_name: string;
    occurred_at: string;
    notes: string;
  }>({
    order_type: 'buy',
    account_id: '',
    symbol: '',
    quantity: '',
    price_per_unit: '',
    currency: 'USD',
    brokerage_fee: '0',
    tax_amount: '0',
    other_fees: '0',
    exchange_name: '',
    occurred_at: formatDateTimeLocalInput(new Date()),
    notes: '',
  });
  const [orderSymbolFilter, setOrderSymbolFilter] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'' | 'buy' | 'sell'>('');
  const [ordersSortCol, setOrdersSortCol] = useState('occurred_at');
  const [ordersSortDir, setOrdersSortDir] = useState<SortDir>('desc');
  const [ordersOffset, setOrdersOffset] = useState(0);

  const cashRes = useQuery({
    // account_id is a server-side filter (not just client-side), so switching
    // accounts fetches that account's full history instead of relying on
    // whatever happens to be in the first 200 rows ordered by as_of desc --
    // an old backfilled snapshot can otherwise be invisible past that window.
    queryKey: queryKeys.investing.cashBalances(cashAccountFilter),
    queryFn: () => investingService.getCashBalances(200, 0, cashAccountFilter || undefined),
  });

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
  const accountOptions = useMemo(() => accounts.map((account) => account.name), [accounts]);
  const accountDropdownOptions = useMemo(
    () => accounts.map((acc) => ({ value: acc.public_id, label: acc.name })),
    [accounts]
  );
  const brokerageAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'brokerage'),
    [accounts]
  );
  const brokerageAccountOptions = useMemo(
    () => brokerageAccounts.map((a) => ({ value: a.public_id, label: a.name })),
    [brokerageAccounts]
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
      : null) ?? currencyOptions[0] ?? 'USD';

  const selectedCashAccount = cashForm.account_id;
  const selectedCashCurrency =
    currencyOptions.includes(cashForm.currency) ? cashForm.currency : preferredWorkspaceCurrency;

  const ordersRes = useQuery({
    queryKey: queryKeys.investing.orders(ordersOffset, orderSymbolFilter, orderTypeFilter),
    queryFn: () =>
      investingService.getOrders(ORDERS_PAGE_SIZE, ordersOffset, {
        search: orderSymbolFilter || undefined,
        order_type: orderTypeFilter || undefined,
      }),
  });

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
    { onSuccess: () => setPendingDeleteCash(null) },
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
      onSuccess: (created) => {
        setNewAccountName('');
        setCashForm((prev) => ({ ...prev, account_id: created.public_id }));
      },
    },
  );

  const placeOrderMutation = useInvalidatingMutation(
    (payload: InvestingOrderCreate) => investingService.placeOrder(payload),
    refreshKeys,
    {
      onSuccess: () => {
        setOrderForm((prev) => ({
          ...prev,
          symbol: '',
          quantity: '',
          price_per_unit: '',
          brokerage_fee: '0',
          tax_amount: '0',
          other_fees: '0',
          exchange_name: '',
          notes: '',
          occurred_at: formatDateTimeLocalInput(new Date()),
        }));
        setIsPlaceOrderModalOpen(false);
      },
    },
  );

  const confirmDeleteCash = () => {
    if (!pendingDeleteCash) return;
    deleteCashMutation.mutate(pendingDeleteCash.public_id);
  };

  const cashBalances = useMemo(() => cashRes.data?.items ?? [], [cashRes.data]);

  const filteredCashBalances = useMemo(
    () =>
      cashBalances.filter((balance) => {
        const accountMatch = !cashAccountFilter || balance.account_id === cashAccountFilter;
        const currencyMatch =
          !cashCurrencyFilter || (balance.currency ?? 'USD').toUpperCase() === cashCurrencyFilter.toUpperCase();
        return accountMatch && currencyMatch;
      }),
    [cashBalances, cashAccountFilter, cashCurrencyFilter]
  );

  const sortedCashBalances = useMemo(() => {
    const dir = cashSortDir === 'asc' ? 1 : -1;
    return [...filteredCashBalances].sort((a, b) => {
      switch (cashSortCol) {
        case 'account_name': return dir * a.account_name.localeCompare(b.account_name);
        case 'balance': return dir * (toNumber(a.balance) - toNumber(b.balance));
        case 'as_of': {
          const timeA = new Date(a.as_of).getTime();
          const timeB = new Date(b.as_of).getTime();
          return dir * ((Number.isFinite(timeA) ? timeA : 0) - (Number.isFinite(timeB) ? timeB : 0));
        }
        default: return 0;
      }
    });
  }, [filteredCashBalances, cashSortCol, cashSortDir]);

  const orders = useMemo(() => ordersRes.data?.items ?? [], [ordersRes.data]);

  const sortedOrders = useMemo(() => {
    const dir = ordersSortDir === 'asc' ? 1 : -1;
    return [...orders].sort((a, b) => {
      switch (ordersSortCol) {
        case 'occurred_at': {
          const timeA = new Date(a.occurred_at).getTime();
          const timeB = new Date(b.occurred_at).getTime();
          return dir * ((Number.isFinite(timeA) ? timeA : 0) - (Number.isFinite(timeB) ? timeB : 0));
        }
        case 'order_type': return dir * a.order_type.localeCompare(b.order_type);
        case 'symbol': return dir * a.symbol.localeCompare(b.symbol);
        case 'account_name': return dir * a.account_name.localeCompare(b.account_name);
        case 'quantity': return dir * (toNumber(a.quantity) - toNumber(b.quantity));
        case 'price_per_unit': return dir * (toNumber(a.price_per_unit) - toNumber(b.price_per_unit));
        case 'gross_amount': return dir * (toNumber(a.gross_amount) - toNumber(b.gross_amount));
        case 'fees': return dir * ((toNumber(a.brokerage_fee) + toNumber(a.tax_amount) + toNumber(a.other_fees)) - (toNumber(b.brokerage_fee) + toNumber(b.tax_amount) + toNumber(b.other_fees)));
        case 'net_amount': return dir * (toNumber(a.net_amount) - toNumber(b.net_amount));
        case 'realized_gain_loss': return dir * (toNumber(a.realized_gain_loss ?? 0) - toNumber(b.realized_gain_loss ?? 0));
        default: return 0;
      }
    });
  }, [orders, ordersSortCol, ordersSortDir]);

  // The unified account filter on the Cash tab scopes orders too, so
  // balances, reconciliation, orders and transfers all read as one account.
  const visibleOrders = useMemo(
    () => sortedOrders.filter((o) => !cashAccountFilter || o.account_id === cashAccountFilter),
    [sortedOrders, cashAccountFilter]
  );

  const transfers = useMemo(() => transfersRes.data?.items ?? [], [transfersRes.data]);
  const visibleTransfers = useMemo(
    () =>
      transfers.filter(
        (t) =>
          !cashAccountFilter ||
          t.from_account_public_id === cashAccountFilter ||
          t.to_account_public_id === cashAccountFilter
      ),
    [transfers, cashAccountFilter]
  );

  const orderQty = Number(orderForm.quantity);
  const orderPrice = Number(orderForm.price_per_unit);
  const orderGross = Number.isFinite(orderQty) && Number.isFinite(orderPrice) ? orderQty * orderPrice : 0;
  const orderFees =
    Number(orderForm.brokerage_fee || 0) +
    Number(orderForm.tax_amount || 0) +
    Number(orderForm.other_fees || 0);
  const orderNet = orderForm.order_type === 'buy' ? orderGross + orderFees : orderGross - orderFees;

  const onPlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const brokerageFee = orderForm.brokerage_fee ? Number(orderForm.brokerage_fee) : 0;
    const taxAmount = orderForm.tax_amount ? Number(orderForm.tax_amount) : 0;
    const otherFees = orderForm.other_fees ? Number(orderForm.other_fees) : 0;
    const occurredAtDate = new Date(orderForm.occurred_at);
    if (
      !orderForm.account_id ||
      !orderForm.symbol ||
      !Number.isFinite(orderQty) || orderQty <= 0 ||
      !Number.isFinite(orderPrice) || orderPrice <= 0 ||
      (orderForm.brokerage_fee && !Number.isFinite(brokerageFee)) || brokerageFee < 0 ||
      (orderForm.tax_amount && !Number.isFinite(taxAmount)) || taxAmount < 0 ||
      (orderForm.other_fees && !Number.isFinite(otherFees)) || otherFees < 0 ||
      Number.isNaN(occurredAtDate.getTime())
    ) return;
    placeOrderMutation.mutate({
      account_id: orderForm.account_id,
      order_type: orderForm.order_type,
      symbol: orderForm.symbol.trim().toUpperCase(),
      quantity: orderQty,
      price_per_unit: orderPrice,
      currency: orderForm.currency,
      brokerage_fee: brokerageFee,
      tax_amount: taxAmount,
      other_fees: otherFees,
      exchange_name: orderForm.exchange_name || undefined,
      occurred_at: occurredAtDate.toISOString(),
      notes: orderForm.notes || undefined,
    });
  };

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
          {/* One account filter scopes reconciliation, balances, orders and
              transfers below, so the tab reads as a single account story. */}
          <CompactFilterBar
            title="Cash filters"
            onReset={() => {
              setCashAccountFilter('');
              setCashCurrencyFilter('');
            }}
          >
            <CompactFilterField label="Account">
              <DropdownSelect
                testId="investing-cash-account-filter"
                value={cashAccountFilter}
                options={accountDropdownOptions}
                onChange={setCashAccountFilter}
                placeholder="All accounts"
                clearLabel="All accounts"
              />
            </CompactFilterField>
            <CompactFilterField label="Currency">
              <DropdownSelect
                value={cashCurrencyFilter}
                options={currencyDropdownOptions}
                onChange={setCashCurrencyFilter}
                placeholder="All currencies"
                clearLabel="All currencies"
              />
            </CompactFilterField>
          </CompactFilterBar>

          {/* Reconciliation ties a snapshot to the flows that explain it:
              projected-from-flows vs the latest cash snapshot. */}
          {cashAccountFilter !== '' && (
            <div
              data-testid="investing-cash-reconciliation"
              className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4"
            >
              {reconciliationRes.isLoading ? (
                <p className="text-sm text-slate-400">Loading reconciliation…</p>
              ) : reconciliationRes.data ? (
                (() => {
                  const r = reconciliationRes.data;
                  const projected = Number(r.projected_balance);
                  const snapshot = r.snapshot_balance !== null ? Number(r.snapshot_balance) : null;
                  const disc = r.discrepancy !== null ? Number(r.discrepancy) : null;
                  const threshold = projected !== 0 ? Math.abs(projected) * 0.05 : 100;
                  const discColor =
                    disc === null
                      ? 'text-slate-400'
                      : Math.abs(disc) < 1
                      ? 'text-emerald-300'
                      : Math.abs(disc) >= threshold
                      ? 'text-rose-300'
                      : 'text-amber-300';
                  return (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Reconciliation — {r.account_name}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {r.transaction_count} txns · {r.transfer_count} transfers · {r.order_count} trades
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Projected</p>
                          <p
                            data-testid="investing-reconciliation-projected"
                            className="text-sm font-semibold text-white"
                          >
                            {formatCurrency(projected, r.currency_code, currencyDisplayPreference)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Latest snapshot</p>
                          <p className="text-sm font-semibold text-white">
                            {snapshot !== null
                              ? formatCurrency(snapshot, r.currency_code, currencyDisplayPreference)
                              : '—'}
                            {r.snapshot_as_of && (
                              <span className="ml-1 text-[10px] text-slate-500">
                                ({formatDate(r.snapshot_as_of, { fallback: 'N/A' })})
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Discrepancy</p>
                          <p
                            data-testid="investing-reconciliation-discrepancy"
                            className={`text-sm font-semibold ${discColor}`}
                          >
                            {disc !== null
                              ? formatCurrency(disc, r.currency_code, currencyDisplayPreference)
                              : 'No snapshot yet'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p className="text-sm text-slate-400">Reconciliation unavailable.</p>
              )}
            </div>
          )}

          <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-white text-base">Orders</h3>
            <button
              type="button"
              data-testid="investing-place-order-btn"
              onClick={() => {
                setIsPlaceOrderModalOpen(true);
                if (!orderForm.account_id && brokerageAccounts.length > 0) {
                  setOrderForm((prev) => ({ ...prev, account_id: brokerageAccounts[0].public_id }));
                }
              }}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Place Order
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              data-testid="investing-orders-symbol-filter"
              placeholder="Filter by symbol or name…"
              value={orderSymbolFilter}
              onChange={(e) => {
                setOrderSymbolFilter(e.target.value);
                setOrdersOffset(0);
              }}
              className="rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-1.5 text-sm text-white placeholder:text-slate-500"
            />
            <select
              data-testid="investing-orders-type-filter"
              value={orderTypeFilter}
              onChange={(e) => {
                setOrderTypeFilter(e.target.value as '' | 'buy' | 'sell');
                setOrdersOffset(0);
              }}
              className="rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-1.5 text-sm text-white"
            >
              <option value="">All types</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          {/* Orders table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table data-testid="investing-orders-table" className="w-full text-sm">
              <thead className="border-b border-slate-700/50 bg-slate-800/40">
                <tr>
                  <SortableHeader col="occurred_at" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }}>Date</SortableHeader>
                  <SortableHeader col="order_type" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }}>Type</SortableHeader>
                  <SortableHeader col="symbol" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }}>Symbol</SortableHeader>
                  <SortableHeader col="account_name" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }}>Account</SortableHeader>
                  <SortableHeader col="quantity" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }} className="text-right">Qty</SortableHeader>
                  <SortableHeader col="price_per_unit" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }} className="text-right">Price</SortableHeader>
                  <SortableHeader col="gross_amount" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }} className="text-right">Gross</SortableHeader>
                  <SortableHeader col="fees" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }} className="text-right">Fees</SortableHeader>
                  <SortableHeader col="net_amount" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }} className="text-right">Net</SortableHeader>
                  <SortableHeader col="realized_gain_loss" activeCol={ordersSortCol} dir={ordersSortDir} onSort={(c, d) => { setOrdersSortCol(c); setOrdersSortDir(d); }} className="text-right">Realized G/L</SortableHeader>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {ordersRes.isLoading ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                ) : visibleOrders.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">No orders for this account yet.</td></tr>
                ) : (
                  visibleOrders.map((o) => {
                    const fees = toNumber(o.brokerage_fee) + toNumber(o.tax_amount) + toNumber(o.other_fees);
                    const isBuy = o.order_type === 'buy';
                    return (
                      <tr
                        key={o.public_id}
                        data-testid={`investing-order-row-${o.public_id}`}
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
                        <td
                          data-testid={`investing-order-symbol-${o.symbol}`}
                          className="px-4 py-3 font-semibold text-white"
                        >
                          {o.symbol}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{o.account_name}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{toNumber(o.quantity).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {formatCurrency(toNumber(o.price_per_unit), o.currency, currencyDisplayPreference)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {formatCurrency(toNumber(o.gross_amount), o.currency, currencyDisplayPreference)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {formatCurrency(fees, o.currency, currencyDisplayPreference)}
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
                              disabled={deleteOrderPending || updateOrderPending}
                              onClick={() => onEditOrder(o)}
                              className="rounded-lg border border-slate-600/70 p-2 text-slate-200 hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-60"
                              title="Edit order"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
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
          <Pagination
            total={ordersRes.data?.total ?? 0}
            limit={ORDERS_PAGE_SIZE}
            offset={ordersOffset}
            onPageChange={setOrdersOffset}
          />
        </div>

        {/* Place Order Modal */}
        {isPlaceOrderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Place Order</h2>
                <button
                  type="button"
                  onClick={() => setIsPlaceOrderModalOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={onPlaceOrder} className="space-y-4">
                {/* Buy / Sell toggle */}
                <div data-testid="order-type-toggle" className="flex rounded-lg border border-slate-700/60 overflow-hidden">
                  {(['buy', 'sell'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOrderForm((prev) => ({ ...prev, order_type: t }))}
                      className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                        orderForm.order_type === t
                          ? t === 'buy'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-slate-400">Brokerage Account</label>
                    <DropdownSelect
                      testId="order-account-select"
                      options={brokerageAccountOptions}
                      value={orderForm.account_id}
                      onChange={(v) => setOrderForm((prev) => ({ ...prev, account_id: v }))}
                      placeholder="Select brokerage account"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Symbol</label>
                    <input
                      data-testid="order-symbol"
                      type="text"
                      required
                      value={orderForm.symbol}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                      placeholder="AAPL"
                      className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Currency</label>
                    <DropdownSelect
                      data-testid="order-currency"
                      options={currencyDropdownOptions}
                      value={orderForm.currency}
                      onChange={(v) => setOrderForm((prev) => ({ ...prev, currency: v }))}
                      placeholder="USD"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Quantity</label>
                    <input
                      data-testid="order-quantity"
                      type="number"
                      required
                      min="0.00000001"
                      step="any"
                      value={orderForm.quantity}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, quantity: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Price per unit</label>
                    <input
                      data-testid="order-price"
                      type="number"
                      required
                      min="0.000001"
                      step="any"
                      value={orderForm.price_per_unit}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, price_per_unit: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Brokerage fee</label>
                    <input
                      data-testid="order-brokerage-fee"
                      type="number"
                      min="0"
                      step="any"
                      value={orderForm.brokerage_fee}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, brokerage_fee: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Tax / STT</label>
                    <input
                      data-testid="order-tax"
                      type="number"
                      min="0"
                      step="any"
                      value={orderForm.tax_amount}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, tax_amount: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Other fees</label>
                    <input
                      data-testid="order-other-fees"
                      type="number"
                      min="0"
                      step="any"
                      value={orderForm.other_fees}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, other_fees: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Exchange (optional)</label>
                    <input
                      data-testid="order-exchange"
                      type="text"
                      value={orderForm.exchange_name}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, exchange_name: e.target.value }))}
                      placeholder="NSE / NASDAQ"
                      className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-slate-400">Trade date & time</label>
                    <input
                      data-testid="order-date"
                      type="datetime-local"
                      value={orderForm.occurred_at}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, occurred_at: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-slate-400">Notes (optional)</label>
                    <input
                      data-testid="order-notes"
                      type="text"
                      value={orderForm.notes}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                {/* Computed summary */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gross amount</span>
                    <span data-testid="order-gross-amount" className="text-white font-medium">
                      {formatCurrency(orderGross, orderForm.currency, currencyDisplayPreference)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total fees</span>
                    <span data-testid="order-total-fees" className="text-white">
                      {formatCurrency(orderFees, orderForm.currency, currencyDisplayPreference)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-700/50 pt-2">
                    <span className="font-semibold text-white">Net {orderForm.order_type === 'buy' ? 'cost' : 'proceeds'}</span>
                    <span data-testid="order-net-amount" className="font-semibold text-white">
                      {formatCurrency(orderNet, orderForm.currency, currencyDisplayPreference)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaceOrderModalOpen(false)}
                    className="flex-1 rounded-lg border border-slate-600/70 py-2 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    data-testid="order-submit"
                    type="submit"
                    disabled={placeOrderMutation.isPending || !orderForm.account_id || !orderForm.symbol || !orderQty || !orderPrice}
                    className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {placeOrderMutation.isPending ? 'Placing…' : `Place ${orderForm.order_type === 'buy' ? 'Buy' : 'Sell'} Order`}
                  </button>
                </div>

                {placeOrderMutation.isError && (
                  <p className="text-sm text-rose-400">
                    {(placeOrderMutation.error as { response?: { data?: { detail?: string } } })
                      ?.response?.data?.detail ??
                      (placeOrderMutation.error as Error)?.message ??
                      'Failed to place order'}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div data-testid="investing-cash-heading" className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-white text-base">Cash Balances</h3>
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
            <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30">
              <table className="w-full text-left text-sm text-slate-300 min-w-[600px]">
                <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
                  <tr>
                    <SortableHeader col="account_name" activeCol={cashSortCol} dir={cashSortDir} onSort={(c, d) => { setCashSortCol(c); setCashSortDir(d); }}>Account</SortableHeader>
                    <SortableHeader col="balance" activeCol={cashSortCol} dir={cashSortDir} onSort={(c, d) => { setCashSortCol(c); setCashSortDir(d); }}>Balance</SortableHeader>
                    <SortableHeader col="as_of" activeCol={cashSortCol} dir={cashSortDir} onSort={(c, d) => { setCashSortCol(c); setCashSortDir(d); }}>As Of</SortableHeader>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sortedCashBalances.length === 0 ? (
                    <tr><td className="px-4 py-6 text-slate-400" colSpan={4}>No cash balances yet.</td></tr>
                  ) : (
                    sortedCashBalances.map((c) => (
                      <tr key={c.public_id}>
                        <td className="px-4 py-3 text-white">{c.account_name}</td>
                        <td className="px-4 py-3">{formatCurrency(c.balance, c.currency, currencyDisplayPreference)}</td>
                        <td className="px-4 py-3">{Number.isNaN(new Date(c.as_of).getTime()) ? "N/A" : new Date(c.as_of).toLocaleString()}</td>
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
                          <button disabled={deleteCashMutation.isPending} onClick={() => setPendingDeleteCash(c)} className="rounded-lg border border-rose-500/40 p-2 text-rose-300 hover:bg-rose-500/10">
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

          {/* Transfers moving cash in/out of the selected account — read-only
              context for reconciliation; full transfer CRUD lives in Spending. */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-base">Transfers</h3>
              <Link
                to="/spending"
                data-testid="investing-transfers-manage-link"
                className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
              >
                Manage in Spending →
              </Link>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30">
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
                    <tr><td className="px-4 py-6 text-slate-400" colSpan={5}>Loading…</td></tr>
                  ) : visibleTransfers.length === 0 ? (
                    <tr><td className="px-4 py-6 text-slate-400" colSpan={5}>No transfers for this account yet.</td></tr>
                  ) : (
                    visibleTransfers.map((t) => {
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
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.occurred_at, { fallback: 'N/A' })}</td>
                          <td className="px-4 py-3">
                            {isOut ? (
                              <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-300">OUT</span>
                            ) : isIn ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">IN</span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {(t.from_account_name ?? '—')} → {(t.to_account_name ?? '—')}
                          </td>
                          <td className="px-4 py-3 text-right">{formatCurrency(toNumber(t.gross_amount), t.from_currency_code, currencyDisplayPreference)}</td>
                          <td className="px-4 py-3 text-right text-white">{formatCurrency(toNumber(t.net_amount_received), t.to_currency_code, currencyDisplayPreference)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add Cash Modal */}
      {isAddCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsAddCashModalOpen(false)}
          />
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-semibold text-white">Add Cash Balance</h2>
              <button
                type="button"
                onClick={() => setIsAddCashModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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
                  <input
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="Balance"
                    type="number"
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

              {/* Quick create account sub-form */}
              <div className="mt-4 border-t border-slate-800 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick Create Account</p>
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-300">Account Name</label>
                    <input
                      data-testid="investing-account-name"
                      className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      placeholder="Account name"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-300">Account Type</label>
                    <DropdownSelect
                      testId="investing-account-type"
                      value={newAccountType}
                      options={[...accountTypeOptions]}
                      onChange={(value) => setNewAccountType(value as 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card')}
                      placeholder="Account type"
                    />
                  </div>
                </div>
                <button
                  data-testid="investing-account-create"
                  type="button"
                  disabled={!newAccountName.trim() || createAccountMutation.isPending}
                  onClick={() => createAccountMutation.mutate()}
                  className="mt-3 w-full h-10 rounded-lg border border-slate-700 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  Create account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Dialog
        open={!!pendingDeleteCash}
        onOpenChange={(open) => !open && !deleteCashMutation.isPending && setPendingDeleteCash(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete cash balance entry?</DialogTitle>
            <DialogDescription>
              {pendingDeleteCash
                ? `Delete this ${formatCurrency(toNumber(pendingDeleteCash.balance), pendingDeleteCash.currency, currencyDisplayPreference)} cash balance entry for ${pendingDeleteCash.account_name}?`
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
              {(deleteCashMutation.error as Error)?.message ?? 'Failed to delete cash balance entry'}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
