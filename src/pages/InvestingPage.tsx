import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Landmark, Plus, WalletCards } from 'lucide-react';
import { financeService } from '../services/finance';
import { useInvalidatingMutation } from '../hooks/useInvalidatingMutation';
import { investingService } from '../services/investing';
import type { InvestingOrder, InvestingOrderCreate, InvestingOrderUpdate, OrderType } from '../services/investing';
import { formatCurrency, toNumber } from '../utils/numberFormat';
import { CurrencyBadge } from '../components/finance/Badges';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { DropdownSelect } from '../components/DropdownSelect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { HoldingsTab } from './investing/HoldingsTab';
import { OrdersTab } from './investing/OrdersTab';
import { CashTab } from './investing/CashTab';
import { AnalyticsTab } from './investing/AnalyticsTab';
import { SummaryCard } from './investing/components';
import { formatDateTimeLocalInput, formatPerformanceMetric, statusLabel } from './investing/format';
import { queryKeys } from '../lib/queryKeys';

const refreshKeys = [queryKeys.investing.all, queryKeys.finance.all, queryKeys.dashboard.all];

const VALID_TABS = ['holdings', 'orders', 'cash', 'analytics'] as const;

export const InvestingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<'holdings' | 'orders' | 'cash' | 'analytics'>(
    (VALID_TABS as readonly string[]).includes(requestedTab ?? '') ? (requestedTab as typeof VALID_TABS[number]) : 'holdings',
  );

  // The Holdings empty state deep-links here as ?tab=orders&order=1 to open
  // the Place Order flow directly; consume the params once, then strip them.
  // Place Order itself is hoisted to this page (reachable from every tab —
  // UX-REVIEW P2 item 13), so this just opens the page-level modal state.
  const shouldAutoOpenOrder = searchParams.get('order') === '1';
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  React.useEffect(() => {
    if (requestedTab || shouldAutoOpenOrder) {
      if (requestedTab && (VALID_TABS as readonly string[]).includes(requestedTab)) {
        setTab(requestedTab as typeof VALID_TABS[number]);
      }
      if (shouldAutoOpenOrder) {
        setIsPlaceOrderModalOpen(true);
      }
      setSearchParams((params) => {
        params.delete('tab');
        params.delete('order');
        return params;
      }, { replace: true });
    }
  }, [requestedTab, shouldAutoOpenOrder, setSearchParams]);

  const summary = useQuery({
    queryKey: queryKeys.investing.summary(),
    queryFn: () => investingService.getSummary(),
  });
  const performanceSummary = useQuery({
    queryKey: queryKeys.investing.performance.summary(),
    queryFn: () => investingService.getPerformanceSummary(),
  });

  const currenciesRes = useQuery({
    queryKey: queryKeys.finance.currencies(),
    queryFn: () => financeService.getCurrencies(),
  });
  const currencyOptions = (currenciesRes.data ?? []).map((currency) => currency.code);

  const userFinanceSettingsRes = useQuery({
    queryKey: queryKeys.finance.settings('user'),
    queryFn: () => financeService.getUserSettings(),
  });
  const userFinanceSettings = userFinanceSettingsRes.data;
  const currencyDisplayPreference =
    userFinanceSettings?.effective_currency_display_preference ?? 'symbol';
  const preferredWorkspaceCurrency =
    (userFinanceSettings?.effective_reporting_currency_code &&
    currencyOptions.includes(userFinanceSettings.effective_reporting_currency_code)
      ? userFinanceSettings.effective_reporting_currency_code
      : null) ?? currencyOptions[0] ?? 'USD';
  const currencyDropdownOptions = currencyOptions.map((code) => ({ value: code, label: code }));

  const accountsRes = useQuery({
    queryKey: queryKeys.finance.accounts(),
    queryFn: () => financeService.getAccounts(200, 0),
  });
  const brokerageAccounts = useMemo(
    () => (accountsRes.data?.items ?? []).filter((a) => a.account_type === 'brokerage'),
    [accountsRes.data],
  );
  const brokerageAccountOptions = useMemo(
    () => brokerageAccounts.map((a) => ({ value: a.public_id, label: a.name })),
    [brokerageAccounts],
  );

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

  // Default-select the first brokerage account once both the modal is open
  // and the accounts query has resolved — a plain click-time check would miss
  // accounts that are still loading when "Place Order" is clicked (the hero
  // button is reachable immediately from any tab, with no tab-switch delay to
  // mask the race), leaving the form stuck on the empty placeholder forever.
  React.useEffect(() => {
    if (isPlaceOrderModalOpen && !orderForm.account_id && brokerageAccounts.length > 0) {
      const defaultAccount = brokerageAccounts[0];
      setOrderForm((prev) => ({
        ...prev,
        account_id: defaultAccount.public_id,
        currency: defaultAccount.default_currency_code || prev.currency,
      }));
    }
  }, [isPlaceOrderModalOpen, brokerageAccounts, orderForm.account_id]);

  const openPlaceOrderModal = () => {
    setIsPlaceOrderModalOpen(true);
  };

  const placeOrderMutation = useInvalidatingMutation(
    (payload: InvestingOrderCreate) => investingService.placeOrder(payload),
    refreshKeys,
    {
      successMessage: 'Order placed',
      errorMessage: false,
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

  // Order editing/deletion is shared between the Holdings tab's Trade History
  // modal and the Cash tab's Orders table, and this modal must stay mounted
  // outside TabsContent — Radix unmounts inactive tabs, so nesting it under
  // either tab made it a no-op when triggered from the other.
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InvestingOrder | null>(null);
  const [editOrderFormError, setEditOrderFormError] = useState('');
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<InvestingOrder | null>(null);
  const [editOrderForm, setEditOrderForm] = useState<{
    order_type: OrderType;
    quantity: string;
    price_per_unit: string;
    brokerage_fee: string;
    tax_amount: string;
    other_fees: string;
    exchange_name: string;
    occurred_at: string;
    notes: string;
  }>({
    order_type: 'buy',
    quantity: '',
    price_per_unit: '',
    brokerage_fee: '0',
    tax_amount: '0',
    other_fees: '0',
    exchange_name: '',
    occurred_at: '',
    notes: '',
  });

  const updateOrderMutation = useInvalidatingMutation(
    ({ publicId, payload }: { publicId: string; payload: InvestingOrderUpdate }) =>
      investingService.updateOrder(publicId, payload),
    refreshKeys,
    {
      successMessage: 'Order updated',
      errorMessage: false,
      onSuccess: () => {
        setIsEditOrderModalOpen(false);
        setSelectedOrder(null);
      },
    },
  );

  const deleteOrderMutation = useInvalidatingMutation(
    (publicId: string) => investingService.deleteOrder(publicId),
    refreshKeys,
    { successMessage: 'Order deleted', errorMessage: false, onSuccess: () => setPendingDeleteOrder(null) },
  );

  const handleStartEditOrder = (order: InvestingOrder) => {
    setSelectedOrder(order);
    const parsedDate = new Date(order.occurred_at);
    const isValidDate = !Number.isNaN(parsedDate.getTime());
    setEditOrderForm({
      order_type: order.order_type as OrderType,
      quantity: toNumber(order.quantity).toString(),
      price_per_unit: toNumber(order.price_per_unit).toString(),
      brokerage_fee: toNumber(order.brokerage_fee).toString(),
      tax_amount: toNumber(order.tax_amount).toString(),
      other_fees: toNumber(order.other_fees).toString(),
      exchange_name: order.exchange_name ?? '',
      occurred_at: isValidDate ? formatDateTimeLocalInput(parsedDate) : '',
      notes: order.notes ?? '',
    });
    setEditOrderFormError('');
    setIsEditOrderModalOpen(true);
  };

  const onUpdateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setEditOrderFormError('');
    const qty = Number(editOrderForm.quantity);
    const price = Number(editOrderForm.price_per_unit);
    const brokerageFee = editOrderForm.brokerage_fee ? Number(editOrderForm.brokerage_fee) : 0;
    const taxAmount = editOrderForm.tax_amount ? Number(editOrderForm.tax_amount) : 0;
    const otherFees = editOrderForm.other_fees ? Number(editOrderForm.other_fees) : 0;
    const occurredAt = new Date(editOrderForm.occurred_at);
    if (!Number.isFinite(qty) || qty <= 0) {
      setEditOrderFormError('Quantity must be a positive number.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setEditOrderFormError('Price per unit must be a positive number.');
      return;
    }
    if (!Number.isFinite(brokerageFee) || brokerageFee < 0) {
      setEditOrderFormError('Brokerage fee must be a non-negative number.');
      return;
    }
    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      setEditOrderFormError('Tax / STT must be a non-negative number.');
      return;
    }
    if (!Number.isFinite(otherFees) || otherFees < 0) {
      setEditOrderFormError('Other fees must be a non-negative number.');
      return;
    }
    if (Number.isNaN(occurredAt.getTime())) {
      setEditOrderFormError('Trade date & time is invalid.');
      return;
    }
    updateOrderMutation.mutate({
      publicId: selectedOrder.public_id,
      payload: {
        order_type: editOrderForm.order_type,
        quantity: qty,
        price_per_unit: price,
        brokerage_fee: brokerageFee,
        tax_amount: taxAmount,
        other_fees: otherFees,
        exchange_name: editOrderForm.exchange_name || undefined,
        occurred_at: occurredAt.toISOString(),
        notes: editOrderForm.notes || undefined,
      },
    });
  };

  const confirmDeleteOrder = () => {
    if (!pendingDeleteOrder) return;
    deleteOrderMutation.mutate(pendingDeleteOrder.public_id);
  };

  const performancePctRaw =
    performanceSummary.data?.total_gain_loss_pct != null
      ? Number(performanceSummary.data.total_gain_loss_pct)
      : Number.NaN;
  const performancePctLabel = Number.isNaN(performancePctRaw)
    ? 'N/A'
    : `${performancePctRaw.toFixed(2)}%`;

  return (
    <PageShell>
      <PageHero
        title="Investing"
        subtitle="Manage holdings and cash balances for your workspace."
        actions={(
          <Button
            type="button"
            data-testid="investing-hero-place-order"
            onClick={openPlaceOrderModal}
            className="h-12 rounded-xl px-5 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Place Order
          </Button>
        )}
      />

      <div className="mb-6 grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label={`Portfolio value${performanceSummary.data?.snapshot_date ? ` (as of ${performanceSummary.data.snapshot_date})` : ''}`}
          value={summary.data?.valuation_status === 'multi_currency_unconverted'
            ? 'N/A'
            : performanceSummary.data
              ? formatCurrency(performanceSummary.data.portfolio_value ?? performanceSummary.data.total_value, performanceSummary.data.currency, currencyDisplayPreference)
              : (summary.data?.portfolio_value != null
                ? formatCurrency(summary.data.portfolio_value, summary.data.reporting_currency ?? preferredWorkspaceCurrency, currencyDisplayPreference)
                : 'N/A')}
          icon={<Landmark className="h-5 w-5" />}
          testId="investing-portfolio-value"
        />
        <SummaryCard
          label="Invested"
          value={performanceSummary.data
            ? formatCurrency(performanceSummary.data.invested_value ?? performanceSummary.data.total_cost, performanceSummary.data.currency, currencyDisplayPreference)
            : 'N/A'}
          icon={<Landmark className="h-5 w-5" />}
          testId="investing-invested-value"
        />
        <SummaryCard
          label="Total gain/loss"
          value={performanceSummary.data
            ? formatPerformanceMetric(performanceSummary.data.total_gain_loss, performanceSummary.data.total_gain_loss_pct, performanceSummary.data.currency, currencyDisplayPreference)
            : 'N/A'}
          icon={<Landmark className="h-5 w-5" />}
          testId="investing-total-gain-loss"
        />
        <SummaryCard
          label="Daily change"
          value={performanceSummary.data?.daily_change != null
            ? formatPerformanceMetric(performanceSummary.data.daily_change, performanceSummary.data.daily_change_pct, performanceSummary.data.currency, currencyDisplayPreference)
            : 'N/A'}
          icon={<Landmark className="h-5 w-5" />}
          testId="investing-daily-change"
        />
        <SummaryCard
          label="Cash total"
          value={performanceSummary.data?.cash_total != null
            ? formatCurrency(performanceSummary.data.cash_total, performanceSummary.data.currency, currencyDisplayPreference)
            : 'N/A'}
          icon={<WalletCards className="h-5 w-5" />}
          testId="investing-cash-total"
        />
      </div>

      <div className="mb-6 rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
        <p data-testid="investing-reporting-currency">
          <span className="font-semibold text-slate-100">Reporting currency:</span>{' '}
          {summary.data?.reporting_currency ?? 'Not configured'}
        </p>
        {summary.data?.currency_breakdown && Object.keys(summary.data.currency_breakdown).length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Original currency mix:</span>
            {Object.entries(summary.data.currency_breakdown).map(([code, value]) => (
              <span key={code} className="inline-flex items-center gap-1.5">
                <CurrencyBadge code={code} title={`Book total in ${code}`} />
                <span className="text-xs text-slate-300">{formatCurrency(value, code, currencyDisplayPreference)}</span>
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-1">
          <span className="font-semibold text-slate-100">Valuation status:</span>{' '}
          {statusLabel(summary.data?.valuation_status)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {performanceSummary.data?.snapshot_date
            ? `Valuation as of ${performanceSummary.data.snapshot_date} · ${performanceSummary.data.valuation_status}`
            : 'Valuation date unavailable'}
        </p>
        {summary.data?.valuation_status === 'converted_available' && summary.data?.fx_rates_used && Object.keys(summary.data.fx_rates_used).length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="investing-fx-rates-used">
            <span className="text-xs text-slate-400">FX conversion rates used:</span>
            {Object.entries(summary.data.fx_rates_used).map(([base, rate]) => (
              <span key={base} className="inline-flex items-center gap-1 text-xs text-slate-300">
                <span className="font-medium text-slate-100">1 {base}</span>
                <span>=</span>
                <span className="font-medium text-slate-100">{toNumber(rate).toFixed(4)}</span>
                <span>{summary.data.reporting_currency}</span>
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-1">
          <span className="font-semibold text-slate-100">Performance (gain/loss):</span>{' '}
          {performanceSummary.isLoading
            ? 'Loading...'
            : performanceSummary.data
              ? `${formatCurrency(performanceSummary.data.total_gain_loss, performanceSummary.data.currency, currencyDisplayPreference)} (${performancePctLabel})`
              : 'N/A'}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'holdings' | 'orders' | 'cash' | 'analytics')}>
        <div className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-holdings" value="holdings">Holdings</TabsTrigger>
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-orders" value="orders">Orders</TabsTrigger>
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-cash" value="cash">Cash</TabsTrigger>
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-analytics" value="analytics">Analytics</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="holdings">
          <HoldingsTab
            currencyDisplayPreference={currencyDisplayPreference}
            onEditOrder={handleStartEditOrder}
            onDeleteOrder={setPendingDeleteOrder}
            deleteOrderPending={deleteOrderMutation.isPending}
            updateOrderPending={updateOrderMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <OrdersTab
            currencyDisplayPreference={currencyDisplayPreference}
            onEditOrder={handleStartEditOrder}
            onDeleteOrder={setPendingDeleteOrder}
            deleteOrderPending={deleteOrderMutation.isPending}
            updateOrderPending={updateOrderMutation.isPending}
            onOpenPlaceOrder={openPlaceOrderModal}
          />
        </TabsContent>

        <TabsContent value="cash" className="space-y-6">
          <CashTab currencyDisplayPreference={currencyDisplayPreference} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab currencyDisplayPreference={currencyDisplayPreference} />
        </TabsContent>
      </Tabs>

      {/* Place Order Modal — hoisted to the page (not the Cash tab) so it's
          reachable via the hero button from every tab, not just Cash
          (UX-REVIEW P2 item 13: "Investing's core action is buried"). */}
      <Dialog open={isPlaceOrderModalOpen} onOpenChange={(open) => !open && setIsPlaceOrderModalOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-5">
            <DialogTitle>Place Order</DialogTitle>
          </DialogHeader>
          {isPlaceOrderModalOpen && (
            <form onSubmit={onPlaceOrder} className="space-y-4">
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
                    onChange={(v) => {
                      const selectedAccount = brokerageAccounts.find((a) => a.public_id === v);
                      setOrderForm((prev) => ({
                        ...prev,
                        account_id: v,
                        currency: selectedAccount?.default_currency_code || prev.currency,
                      }));
                    }}
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
                <Button
                  data-testid="order-submit"
                  type="submit"
                  disabled={!orderForm.account_id || !orderForm.symbol || !orderQty || !orderPrice}
                  loading={placeOrderMutation.isPending}
                  className="flex-1 rounded-lg py-2"
                >
                  {placeOrderMutation.isPending ? 'Placing' : `Place ${orderForm.order_type === 'buy' ? 'Buy' : 'Sell'} Order`}
                </Button>
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
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Modal — kept outside TabsContent so it stays mounted when
          triggered from the Trade History modal (which lives on the Holdings
          tab); Radix unmounts inactive TabsContent, so nesting it under the
          Orders tab made it a no-op when opened from elsewhere. */}
      <Dialog
        open={isEditOrderModalOpen && !!selectedOrder}
        onOpenChange={(open) => {
          if (open) return;
          setIsEditOrderModalOpen(false);
          setSelectedOrder(null);
          setEditOrderFormError('');
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {isEditOrderModalOpen && selectedOrder && (
            <>
            <DialogHeader className="mb-5">
              <DialogTitle>Edit Order — {selectedOrder.symbol}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onUpdateOrder} className="space-y-4">
              {/* Buy / Sell toggle */}
              <div className="flex rounded-lg border border-slate-700/60 overflow-hidden">
                {(['buy', 'sell'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditOrderForm((prev) => ({ ...prev, order_type: t }))}
                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                      editOrderForm.order_type === t
                        ? t === 'buy' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Quantity</label>
                  <input
                    type="number"
                    required
                    min="0.00000001"
                    step="any"
                    value={editOrderForm.quantity}
                    onChange={(e) => setEditOrderForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Price per unit</label>
                  <input
                    type="number"
                    required
                    min="0.000001"
                    step="any"
                    value={editOrderForm.price_per_unit}
                    onChange={(e) => setEditOrderForm((prev) => ({ ...prev, price_per_unit: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Brokerage fee</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editOrderForm.brokerage_fee}
                    onChange={(e) => setEditOrderForm((prev) => ({ ...prev, brokerage_fee: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Tax / STT</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editOrderForm.tax_amount}
                    onChange={(e) => setEditOrderForm((prev) => ({ ...prev, tax_amount: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Other fees</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editOrderForm.other_fees}
                    onChange={(e) => setEditOrderForm((prev) => ({ ...prev, other_fees: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Exchange (optional)</label>
                  <input
                    type="text"
                    value={editOrderForm.exchange_name}
                    onChange={(e) => setEditOrderForm((prev) => ({ ...prev, exchange_name: e.target.value }))}
                    placeholder="NSE / NASDAQ"
                    className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">Trade date & time</label>
                  <input
                    type="datetime-local"
                    value={editOrderForm.occurred_at}
                    onChange={(e) => setEditOrderForm((prev) => ({ ...prev, occurred_at: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">Notes (optional)</label>
                  <input
                    type="text"
                    value={editOrderForm.notes}
                    onChange={(e) => setEditOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {editOrderFormError ? <p className="text-xs text-rose-300">{editOrderFormError}</p> : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsEditOrderModalOpen(false); setSelectedOrder(null); setEditOrderFormError(''); }}
                  className="flex-1 rounded-lg border border-slate-600/70 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  loading={updateOrderMutation.isPending}
                  className="flex-1 rounded-lg py-2"
                >
                  {updateOrderMutation.isPending ? 'Saving' : 'Save Changes'}
                </Button>
              </div>

              {updateOrderMutation.isError && (
                <p className="text-sm text-rose-400">
                  {(updateOrderMutation.error as Error)?.message ?? 'Failed to update order'}
                </p>
              )}
            </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingDeleteOrder}
        onOpenChange={(open) => !open && !deleteOrderMutation.isPending && setPendingDeleteOrder(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete order?</DialogTitle>
            <DialogDescription>
              {pendingDeleteOrder
                ? `Delete this ${pendingDeleteOrder.order_type} order for ${toNumber(pendingDeleteOrder.quantity).toLocaleString()} ${pendingDeleteOrder.symbol}? The holding will be recomputed from the remaining orders.`
                : 'The holding will be recomputed from the remaining orders.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingDeleteOrder(null)}
              disabled={deleteOrderMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-rose-300 hover:text-rose-200"
              onClick={confirmDeleteOrder}
              disabled={deleteOrderMutation.isPending}
            >
              {deleteOrderMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
          {deleteOrderMutation.isError && (
            <p className="mt-2 text-sm text-rose-400 text-right">
              {(deleteOrderMutation.error as Error)?.message ?? 'Failed to delete order'}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};
