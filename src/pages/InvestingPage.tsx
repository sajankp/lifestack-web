import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Landmark, WalletCards, X } from 'lucide-react';
import { financeService } from '../services/finance';
import { useInvalidatingMutation } from '../hooks/useInvalidatingMutation';
import { investingService } from '../services/investing';
import type { InvestingOrder, InvestingOrderUpdate, OrderType } from '../services/investing';
import { formatCurrency, toNumber } from '../utils/numberFormat';
import { CurrencyBadge } from '../components/finance/Badges';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { HoldingsTab } from './investing/HoldingsTab';
import { CashTab } from './investing/CashTab';
import { AnalyticsTab } from './investing/AnalyticsTab';
import { SummaryCard } from './investing/components';
import { formatDateTimeLocalInput, formatPerformanceMetric, statusLabel } from './investing/format';
import { queryKeys } from '../lib/queryKeys';

const refreshKeys = [queryKeys.investing.all, queryKeys.finance.all, queryKeys.dashboard.all];

export const InvestingPage: React.FC = () => {
  const [tab, setTab] = useState<'holdings' | 'cash' | 'analytics'>('holdings');

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
      onSuccess: () => {
        setIsEditOrderModalOpen(false);
        setSelectedOrder(null);
      },
    },
  );

  const deleteOrderMutation = useInvalidatingMutation(
    (publicId: string) => investingService.deleteOrder(publicId),
    refreshKeys,
    { onSuccess: () => setPendingDeleteOrder(null) },
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

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'holdings' | 'cash' | 'analytics')}>
        <div className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-holdings" value="holdings">Holdings</TabsTrigger>
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-cash" value="cash">Cash</TabsTrigger>
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-analytics" value="analytics">Look-through Analytics</TabsTrigger>
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

        <TabsContent value="cash" className="space-y-6">
          <CashTab
            currencyDisplayPreference={currencyDisplayPreference}
            onEditOrder={handleStartEditOrder}
            onDeleteOrder={setPendingDeleteOrder}
            deleteOrderPending={deleteOrderMutation.isPending}
            updateOrderPending={updateOrderMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab currencyDisplayPreference={currencyDisplayPreference} />
        </TabsContent>
      </Tabs>

      {/* Edit Order Modal — kept outside TabsContent so it stays mounted when
          triggered from the Trade History modal (which lives on the Holdings
          tab); Radix unmounts inactive TabsContent, so nesting it under the
          Orders tab made it a no-op when opened from elsewhere. */}
      {isEditOrderModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsEditOrderModalOpen(false);
              setSelectedOrder(null);
              setEditOrderFormError('');
            }}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Edit Order — {selectedOrder.symbol}</h2>
              <button
                type="button"
                onClick={() => { setIsEditOrderModalOpen(false); setSelectedOrder(null); setEditOrderFormError(''); }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
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
                <button
                  type="submit"
                  disabled={updateOrderMutation.isPending}
                  className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateOrderMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

              {updateOrderMutation.isError && (
                <p className="text-sm text-rose-400">
                  {(updateOrderMutation.error as Error)?.message ?? 'Failed to update order'}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

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
