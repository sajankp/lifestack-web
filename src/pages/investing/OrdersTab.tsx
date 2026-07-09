import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { financeService } from '../../services/finance';
import { investingService } from '../../services/investing';
import type { InvestingOrder } from '../../services/investing';
import { formatCurrency, toNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { CompactFilterBar, CompactFilterField } from '../../components/filters/CompactFilterBar';
import { queryKeys } from '../../lib/queryKeys';
import { DropdownSelect } from '../../components/DropdownSelect';
import { Pagination } from '../../components/Pagination';
import { SortableHeader } from './components';
import type { SortDir } from './format';

interface OrdersTabProps {
  currencyDisplayPreference: 'symbol' | 'code';
  onEditOrder: (order: InvestingOrder) => void;
  onDeleteOrder: (order: InvestingOrder) => void;
  deleteOrderPending: boolean;
  updateOrderPending: boolean;
  /** Place Order is hoisted to the Investing page hero so it's reachable
      from every tab (UX-REVIEW P2 item 13) — this section still lists
      orders, but opens the page-level modal instead of owning its own. */
  onOpenPlaceOrder: () => void;
}

const ORDERS_PAGE_SIZE = 50;

export const OrdersTab: React.FC<OrdersTabProps> = ({
  currencyDisplayPreference,
  onEditOrder,
  onDeleteOrder,
  deleteOrderPending,
  updateOrderPending,
  onOpenPlaceOrder,
}) => {
  const [ordersAccountFilter, setOrdersAccountFilter] = useState('');
  const [orderSymbolFilter, setOrderSymbolFilter] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'' | 'buy' | 'sell'>('');
  const [ordersSortCol, setOrdersSortCol] = useState('occurred_at');
  const [ordersSortDir, setOrdersSortDir] = useState<SortDir>('desc');
  const [ordersOffset, setOrdersOffset] = useState(0);

  const accountsRes = useQuery({
    queryKey: queryKeys.finance.accounts(),
    queryFn: () => financeService.getAccounts(200, 0),
  });
  const accounts = useMemo(() => accountsRes.data?.items ?? [], [accountsRes.data]);
  const accountDropdownOptions = useMemo(
    () => accounts.map((acc) => ({ value: acc.public_id, label: acc.name })),
    [accounts]
  );

  const ordersRes = useQuery({
    queryKey: queryKeys.investing.orders(ordersOffset, orderSymbolFilter, orderTypeFilter),
    queryFn: () =>
      investingService.getOrders(ORDERS_PAGE_SIZE, ordersOffset, {
        search: orderSymbolFilter || undefined,
        order_type: orderTypeFilter || undefined,
      }),
  });

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

  const visibleOrders = useMemo(
    () => sortedOrders.filter((o) => !ordersAccountFilter || o.account_id === ordersAccountFilter),
    [sortedOrders, ordersAccountFilter]
  );

  return (
    <div className="space-y-6">
      <CompactFilterBar
        title="Order filters"
        onReset={() => {
          setOrdersAccountFilter('');
          setOrdersOffset(0);
        }}
      >
        <CompactFilterField label="Account">
          <DropdownSelect
            testId="investing-orders-account-filter"
            value={ordersAccountFilter}
            options={accountDropdownOptions}
            onChange={(value) => {
              setOrdersAccountFilter(value);
              setOrdersOffset(0);
            }}
            placeholder="All accounts"
            clearLabel="All accounts"
          />
        </CompactFilterField>
      </CompactFilterBar>

      <div data-testid="investing-orders-heading" className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold text-white text-base">Orders</h3>
        <Button
          type="button"
          data-testid="investing-place-order-btn"
          onClick={onOpenPlaceOrder}
          size="sm"
          className="rounded-lg"
        >
          <Plus className="h-4 w-4" />
          Place Order
        </Button>
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

      {/* Orders — mobile / tablet card list (canonical testids stay on the
          desktop table so tests resolve to exactly one element). */}
      <div className="space-y-3 lg:hidden">
        {ordersRes.isLoading ? (
          <div className="rounded-xl border border-slate-700/50 p-6 text-center text-sm text-slate-400">Loading…</div>
        ) : visibleOrders.length === 0 ? (
          <div className="rounded-xl border border-slate-700/50 p-6 text-center text-sm text-slate-400">No orders for this account yet.</div>
        ) : (
          visibleOrders.map((o) => {
            const fees = toNumber(o.brokerage_fee) + toNumber(o.tax_amount) + toNumber(o.other_fees);
            const isBuy = o.order_type === 'buy';
            return (
              <div key={o.public_id} className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${isBuy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        {isBuy ? 'BUY' : 'SELL'}
                      </span>
                      <span className="truncate font-semibold text-white">{o.symbol}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(o.occurred_at, { fallback: 'N/A' })} · {o.account_name}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={deleteOrderPending || updateOrderPending}
                      onClick={() => onEditOrder(o)}
                      className="rounded-lg border border-slate-600/70 p-2 text-slate-200 hover:bg-slate-700/60 disabled:opacity-60"
                      title="Edit order"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={deleteOrderPending || updateOrderPending}
                      onClick={() => onDeleteOrder(o)}
                      className="rounded-lg border border-rose-500/40 p-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
                      title="Delete order"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-700/40 pt-3 text-xs">
                  <div><span className="block text-slate-500">Qty × Price</span><span className="text-slate-200">{toNumber(o.quantity).toLocaleString()} × {formatCurrency(toNumber(o.price_per_unit), o.currency, currencyDisplayPreference)}</span></div>
                  <div><span className="block text-slate-500">Net</span><span className="font-medium text-white">{formatCurrency(toNumber(o.net_amount), o.currency, currencyDisplayPreference)}</span></div>
                  <div>
                    <span className="block text-slate-500">Realized G/L</span>
                    {o.realized_gain_loss != null ? (
                      <span className={toNumber(o.realized_gain_loss) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{formatCurrency(toNumber(o.realized_gain_loss), o.currency, currencyDisplayPreference)}</span>
                    ) : <span className="text-slate-500">—</span>}
                  </div>
                </div>
                {fees > 0 ? <p className="mt-1 text-[11px] text-slate-500">Fees {formatCurrency(fees, o.currency, currencyDisplayPreference)}</p> : null}
              </div>
            );
          })
        )}
      </div>

      {/* Orders table (desktop) */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-700/50 lg:block">
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
  );
};
