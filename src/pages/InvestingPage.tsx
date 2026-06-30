import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownUp, BarChart3, Check, ChevronDown, ChevronUp, ChevronsUpDown, Edit2, Info, Landmark, Layers, Plus, RefreshCw, Trash2, WalletCards, X } from 'lucide-react';
import { financeService } from '../services/finance';
import { investingService } from '../services/investing';
import type { CashBalance, InvestingOrder, InvestingOrderCreate, InvestingOrderUpdate, OrderType } from '../services/investing';
import { formatCurrency, toNumber } from '../utils/numberFormat';
import { DatePicker } from '../components/DatePicker';
import { DateTimePicker } from '../components/DateTimePicker';
import { CompactFilterBar, CompactFilterField } from '../components/filters/CompactFilterBar';
import { DropdownSelect } from '../components/DropdownSelect';
import { Combobox } from '../components/Combobox';
import { CurrencyBadge } from '../components/finance/Badges';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Pagination } from '../components/Pagination';
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
import type {
  CashBalanceCreate,
  Holding,
  Instrument,
  InstrumentConstituentUpsert,
  InstrumentCreate,
  InstrumentType,
} from '../types/investing';

const formatDateInput = (d: Date): string => {
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
};

const formatLocalDateInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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

const instrumentTypeLabel = (type: InstrumentType | undefined): string => {
  switch (type) {
    case 'etf':
      return 'ETF';
    case 'mutual_fund':
      return 'Mutual Fund';
    default:
      return 'Stock';
  }
};

export const InvestingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'holdings' | 'orders' | 'cash' | 'analytics'>('holdings');
  const [analyticsAsOf, setAnalyticsAsOf] = useState(formatDateInput(new Date()));
  const [isEditHoldingModalOpen, setIsEditHoldingModalOpen] = useState(false);
  const [isAddCashModalOpen, setIsAddCashModalOpen] = useState(false);
  const [isCreateInstrumentModalOpen, setIsCreateInstrumentModalOpen] = useState(false);
  const [isSeedConstituentsModalOpen, setIsSeedConstituentsModalOpen] = useState(false);

  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [editHoldingForm, setEditHoldingForm] = useState({
    symbol: '',
    quantity: '',
    avg_cost: '',
    currency: 'USD',
    instrument_type: 'stock' as InstrumentType,
  });

  const [cashForm, setCashForm] = useState({
    account_id: '',
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
  const [holdingsAccountFilter, setHoldingsAccountFilter] = useState('');
  const [holdingsCurrencyFilter, setHoldingsCurrencyFilter] = useState('');
  const [holdingsTypeFilter, setHoldingsTypeFilter] = useState('');
  const [hideZeroBookValue, setHideZeroBookValue] = useState(false);
  const [cashAccountFilter, setCashAccountFilter] = useState('');
  const [cashCurrencyFilter, setCashCurrencyFilter] = useState('');
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [constituentRowsText, setConstituentRowsText] = useState('AAPL,0.60\nMSFT,0.40');
  const [constituentError, setConstituentError] = useState('');
  const [editingInstrumentId, setEditingInstrumentId] = useState<string | null>(null);
  const [instrumentEditForm, setInstrumentEditForm] = useState({
    name: '',
    instrument_type: 'stock' as InstrumentType,
  });

  const holdingsRes = useQuery({
    queryKey: ['investing', 'holdings'],
    queryFn: () => investingService.getHoldings(200, 0),
  });

  const cashRes = useQuery({
    queryKey: ['investing', 'cash-balances'],
    queryFn: () => investingService.getCashBalances(200, 0),
  });

  const summary = useQuery({
    queryKey: ['investing', 'summary'],
    queryFn: () => investingService.getSummary(),
  });
  const performanceSummary = useQuery({
    queryKey: ['investing', 'performance', 'summary'],
    queryFn: () => investingService.getPerformanceSummary(),
  });
  const instrumentsRes = useQuery({
    queryKey: ['investing', 'instruments'],
    queryFn: () => investingService.getInstruments(),
  });
  const instruments = useMemo(() => instrumentsRes.data ?? [], [instrumentsRes.data]);
  const instrumentsLoading = instrumentsRes.isLoading;

  const exposureRes = useQuery({
    queryKey: ['investing', 'analytics', 'exposure', analyticsAsOf],
    queryFn: () => investingService.getExposureAnalytics(analyticsAsOf),
    enabled: tab === 'analytics',
  });
  const exposure = exposureRes.data;
  const exposureLoading = exposureRes.isLoading;

  const overlapRes = useQuery({
    queryKey: ['investing', 'analytics', 'overlap', analyticsAsOf],
    queryFn: () => investingService.getOverlapAnalytics(analyticsAsOf),
    enabled: tab === 'analytics',
  });
  const overlap = overlapRes.data;
  const overlapLoading = overlapRes.isLoading;

  const currenciesRes = useQuery({
    queryKey: ['finance', 'currencies'],
    queryFn: () => financeService.getCurrencies(),
  });
  const currencies = useMemo(() => currenciesRes.data ?? [], [currenciesRes.data]);

  const accountsRes = useQuery({
    queryKey: ['finance', 'accounts'],
    queryFn: () => financeService.getAccounts(200, 0),
  });
  const userFinanceSettingsRes = useQuery({
    queryKey: ['finance', 'settings', 'user'],
    queryFn: () => financeService.getUserSettings(),
  });
  const userFinanceSettings = userFinanceSettingsRes.data;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['investing'] });
    void queryClient.invalidateQueries({ queryKey: ['finance'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createInstrumentMutation = useMutation({
    mutationFn: (payload: InstrumentCreate) => investingService.createInstrument(payload),
    onSuccess: (created) => {
      setInstrumentForm({
        symbol: '',
        name: '',
        instrument_type: created.instrument_type,
      });
      setSelectedInstrumentId(created.public_id);
      setIsCreateInstrumentModalOpen(false);
      refresh();
    },
  });
  const updateInstrumentMutation = useMutation({
    mutationFn: (payload: { publicId: string; name: string; instrument_type: InstrumentType }) =>
      investingService.updateInstrument(payload.publicId, {
        name: payload.name,
        instrument_type: payload.instrument_type,
      }),
    onSuccess: () => {
      setEditingInstrumentId(null);
      refresh();
    },
  });
  const updateHoldingMutation = useMutation({
    mutationFn: async (payload: {
      holding: Holding;
      symbol: string;
      quantity: number;
      avg_cost: number;
      currency: string;
      instrument_type: InstrumentType;
    }) => {
      const updatedHolding = await investingService.updateHolding(payload.holding.public_id, {
        symbol: payload.symbol,
        quantity: payload.quantity,
        avg_cost: payload.avg_cost,
        currency: payload.currency,
        instrument_type: payload.instrument_type,
      });
      return updatedHolding;
    },
    onSuccess: () => {
      setSelectedHolding(null);
      setIsEditHoldingModalOpen(false);
      refresh();
    },
  });
  const upsertConstituentsMutation = useMutation({
    mutationFn: async (payload: InstrumentConstituentUpsert) => {
      if (!selectedInstrumentId) return [];
      return investingService.upsertInstrumentConstituents(selectedInstrumentId, payload);
    },
    onSuccess: () => {
      setIsSeedConstituentsModalOpen(false);
      refresh();
    },
  });

  const deleteHoldingMutation = useMutation({
    mutationFn: (publicId: string) => investingService.deleteHolding(publicId),
    onSuccess: () => {
      setPendingDeleteHolding(null);
      refresh();
    },
  });

  const createCashMutation = useMutation({
    mutationFn: (payload: CashBalanceCreate) => investingService.createCashBalance(payload),
    onSuccess: () => {
      setCashForm({
        account_id: cashForm.account_id,
        balance: '',
        currency: cashForm.currency,
        as_of: formatDateTimeLocalInput(new Date()),
      });
      setIsAddCashModalOpen(false);
      refresh();
    },
  });

  const deleteCashMutation = useMutation({
    mutationFn: (publicId: string) => investingService.deleteCashBalance(publicId),
    onSuccess: () => {
      setPendingDeleteCash(null);
      refresh();
    },
  });

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
  const [tradeHistoryHolding, setTradeHistoryHolding] = useState<Holding | null>(null);
  const [pendingDeleteHolding, setPendingDeleteHolding] = useState<Holding | null>(null);
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<InvestingOrder | null>(null);
  const [pendingDeleteCash, setPendingDeleteCash] = useState<CashBalance | null>(null);

  // Sort state
  const [holdingsSortCol, setHoldingsSortCol] = useState('symbol');
  const [holdingsSortDir, setHoldingsSortDir] = useState<'asc' | 'desc'>('asc');
  const [ordersSortCol, setOrdersSortCol] = useState('occurred_at');
  const [ordersSortDir, setOrdersSortDir] = useState<'asc' | 'desc'>('desc');
  const [cashSortCol, setCashSortCol] = useState('account_name');
  const [cashSortDir, setCashSortDir] = useState<'asc' | 'desc'>('asc');

  const ORDERS_PAGE_SIZE = 50;
  const [ordersOffset, setOrdersOffset] = useState(0);

  const ordersRes = useQuery({
    queryKey: ['investing', 'orders', ordersOffset, orderSymbolFilter, orderTypeFilter],
    queryFn: () =>
      investingService.getOrders(ORDERS_PAGE_SIZE, ordersOffset, {
        symbol: orderSymbolFilter || undefined,
        order_type: orderTypeFilter || undefined,
      }),
    enabled: tab === 'orders',
  });

  const tradeHistoryRes = useQuery({
    queryKey: ['investing', 'orders', 'by-holding', tradeHistoryHolding?.symbol, tradeHistoryHolding?.account_id],
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
    return [...data].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  }, [tradeHistoryRes.data]);

  const placeOrderMutation = useMutation({
    mutationFn: (payload: InvestingOrderCreate) => investingService.placeOrder(payload),
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
      refresh();
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (publicId: string) => investingService.deleteOrder(publicId),
    onSuccess: () => {
      setPendingDeleteOrder(null);
      refresh();
    },
  });

  const confirmDeleteHolding = () => {
    if (!pendingDeleteHolding) return;
    deleteHoldingMutation.mutate(pendingDeleteHolding.public_id);
  };

  const confirmDeleteOrder = () => {
    if (!pendingDeleteOrder) return;
    deleteOrderMutation.mutate(pendingDeleteOrder.public_id);
  };

  const confirmDeleteCash = () => {
    if (!pendingDeleteCash) return;
    deleteCashMutation.mutate(pendingDeleteCash.public_id);
  };

  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InvestingOrder | null>(null);
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

  const updateOrderMutation = useMutation({
    mutationFn: ({ publicId, payload }: { publicId: string; payload: InvestingOrderUpdate }) =>
      investingService.updateOrder(publicId, payload),
    onSuccess: () => {
      setIsEditOrderModalOpen(false);
      setSelectedOrder(null);
      refresh();
    },
  });

  const handleStartEditOrder = (order: InvestingOrder) => {
    setSelectedOrder(order);
    setEditOrderForm({
      order_type: order.order_type as OrderType,
      quantity: toNumber(order.quantity).toString(),
      price_per_unit: toNumber(order.price_per_unit).toString(),
      brokerage_fee: toNumber(order.brokerage_fee).toString(),
      tax_amount: toNumber(order.tax_amount).toString(),
      other_fees: toNumber(order.other_fees).toString(),
      exchange_name: order.exchange_name ?? '',
      occurred_at: formatDateTimeLocalInput(new Date(order.occurred_at)),
      notes: order.notes ?? '',
    });
    setIsEditOrderModalOpen(true);
  };

  const onUpdateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const qty = Number(editOrderForm.quantity);
    const price = Number(editOrderForm.price_per_unit);
    const brokerageFee = editOrderForm.brokerage_fee ? Number(editOrderForm.brokerage_fee) : 0;
    const taxAmount = editOrderForm.tax_amount ? Number(editOrderForm.tax_amount) : 0;
    const otherFees = editOrderForm.other_fees ? Number(editOrderForm.other_fees) : 0;
    const occurredAt = new Date(editOrderForm.occurred_at);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0 || Number.isNaN(occurredAt.getTime())) return;
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

  const [editingPriceHoldingId, setEditingPriceHoldingId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');

  const refreshPricesMutation = useMutation({
    mutationFn: () => investingService.refreshPrices(),
    onSuccess: () => {
      refresh();
    },
  });

  const submitPricesMutation = useMutation({
    mutationFn: (payload: {
      price_date: string;
      prices: Array<{ holding_public_id: string; unit_price: number }>;
    }) => investingService.submitPrices(payload),
    onSuccess: () => {
      setEditingPriceHoldingId(null);
      refresh();
    },
  });

  const handleStartEditPrice = (h: Holding) => {
    setEditingPriceHoldingId(h.public_id);
    setEditPriceValue(toNumber(h.current_price ?? h.avg_cost).toString());
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

  const handleStartEditInstrument = (instrument: Instrument) => {
    setEditingInstrumentId(instrument.public_id);
    setInstrumentEditForm({
      name: instrument.name,
      instrument_type: instrument.instrument_type,
    });
  };

  const handleSaveInstrument = (instrument: Instrument) => {
    if (!instrumentEditForm.name.trim()) return;
    updateInstrumentMutation.mutate({
      publicId: instrument.public_id,
      name: instrumentEditForm.name.trim(),
      instrument_type: instrumentEditForm.instrument_type,
    });
  };

  const onUpdateHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHolding) return;

    const qty = Number(editHoldingForm.quantity);
    const cost = Number(editHoldingForm.avg_cost);
    const symbol = editHoldingForm.symbol.trim().toUpperCase();
    const currency = editHoldingForm.currency.trim().toUpperCase();
    if (!symbol || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0 || !currency) return;

    updateHoldingMutation.mutate({
      holding: selectedHolding,
      symbol,
      quantity: qty,
      avg_cost: cost,
      currency,
      instrument_type: editHoldingForm.instrument_type,
    });
  };

  const performancePctRaw =
    performanceSummary.data?.total_gain_loss_pct != null
      ? Number(performanceSummary.data.total_gain_loss_pct)
      : Number.NaN;
  const performancePctLabel = Number.isNaN(performancePctRaw)
    ? 'N/A'
    : `${performancePctRaw.toFixed(2)}%`;
  const holdings = useMemo(() => holdingsRes.data?.items ?? [], [holdingsRes.data]);
  const cashBalances = useMemo(() => cashRes.data?.items ?? [], [cashRes.data]);
  const accounts = useMemo(() => accountsRes.data?.items ?? [], [accountsRes.data]);
  const accountOptions = useMemo(() => accounts.map((account) => account.name), [accounts]);
  const currencyOptions = useMemo(() => currencies.map((currency) => currency.code), [currencies]);
  const accountDropdownOptions = useMemo(
    () => accounts.map((acc) => ({ value: acc.public_id, label: acc.name })),
    [accounts]
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
  const selectedCashAccount = cashForm.account_id;
  const currencyDisplayPreference =
    userFinanceSettings?.effective_currency_display_preference ?? 'symbol';
  const preferredWorkspaceCurrency =
    (userFinanceSettings?.effective_reporting_currency_code &&
    currencyOptions.includes(userFinanceSettings.effective_reporting_currency_code)
      ? userFinanceSettings.effective_reporting_currency_code
      : null) ?? currencyOptions[0] ?? 'USD';
  const selectedCashCurrency =
    currencyOptions.includes(cashForm.currency) ? cashForm.currency : preferredWorkspaceCurrency;
  const analyticsCurrency = exposureRes.data?.currency;

  const createAccountMutation = useMutation({
    mutationFn: () =>
      financeService.createAccount({
        name: newAccountName.trim(),
        account_type: newAccountType,
        default_currency_code: selectedCashCurrency,
      }),
    onSuccess: (created) => {
      setNewAccountName('');
      setCashForm((prev) => ({ ...prev, account_id: created.public_id }));
      refresh();
    },
  });

  const filteredHoldings = useMemo(
    () =>
      holdings.filter((holding) => {
        const accountMatch = !holdingsAccountFilter || holding.account_id === holdingsAccountFilter;
        const currencyMatch =
          !holdingsCurrencyFilter || (holding.currency ?? 'USD').toUpperCase() === holdingsCurrencyFilter.toUpperCase();
        const typeMatch = !holdingsTypeFilter || (holding.instrument_type ?? 'stock') === holdingsTypeFilter;
        const bookValueMatch =
          !hideZeroBookValue || toNumber(holding.quantity) * toNumber(holding.avg_cost) !== 0;
        return accountMatch && currencyMatch && typeMatch && bookValueMatch;
      }),
    [holdings, holdingsAccountFilter, holdingsCurrencyFilter, holdingsTypeFilter, hideZeroBookValue]
  );
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
        case 'as_of': return dir * (new Date(a.as_of).getTime() - new Date(b.as_of).getTime());
        default: return 0;
      }
    });
  }, [filteredCashBalances, cashSortCol, cashSortDir]);

  const instrumentBySymbol = useMemo(
    () => new Map(instruments.map((i) => [i.symbol, i])),
    [instruments]
  );

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
        case 'book_value': return dir * (toNumber(a.quantity) * toNumber(a.avg_cost) - toNumber(b.quantity) * toNumber(b.avg_cost));
        case 'current_price': return dir * (toNumber(a.current_price ?? a.avg_cost) - toNumber(b.current_price ?? b.avg_cost));
        case 'current_value': return dir * (toNumber(a.current_value ?? 0) - toNumber(b.current_value ?? 0));
        case 'gain_loss': return dir * (toNumber(a.gain_loss ?? 0) - toNumber(b.gain_loss ?? 0));
        default: return 0;
      }
    });
  }, [filteredHoldings, holdingsSortCol, holdingsSortDir]);

  const orders = useMemo(() => ordersRes.data?.items ?? [], [ordersRes.data]);

  const sortedOrders = useMemo(() => {
    const dir = ordersSortDir === 'asc' ? 1 : -1;
    return [...orders].sort((a, b) => {
      switch (ordersSortCol) {
        case 'occurred_at': return dir * (new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
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

  const orderQty = Number(orderForm.quantity);
  const orderPrice = Number(orderForm.price_per_unit);
  const orderGross = Number.isFinite(orderQty) && Number.isFinite(orderPrice) ? orderQty * orderPrice : 0;
  const orderFees =
    Number(orderForm.brokerage_fee || 0) +
    Number(orderForm.tax_amount || 0) +
    Number(orderForm.other_fees || 0);
  const orderNet = orderForm.order_type === 'buy' ? orderGross + orderFees : orderGross - orderFees;

  const brokerageAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'brokerage'),
    [accounts]
  );
  const brokerageAccountOptions = useMemo(
    () => brokerageAccounts.map((a) => ({ value: a.public_id, label: a.name })),
    [brokerageAccounts]
  );

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
  const holdingsByCurrency = useMemo(() => {
    return filteredHoldings.reduce<Record<string, number>>((acc, item) => {
      const currency = item.currency?.toUpperCase() || 'USD';
      const value = toNumber(item.quantity) * toNumber(item.avg_cost);
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
      const value = toNumber(h.quantity) * toNumber(h.avg_cost);
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
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-orders" value="orders">Orders</TabsTrigger>
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-cash" value="cash">Cash Balances</TabsTrigger>
            <TabsTrigger className="min-w-fit sm:min-w-[8rem]" data-testid="investing-tab-analytics" value="analytics">Look-through Analytics</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="holdings">
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
                  setHideZeroBookValue(false);
                }}
              >
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
                  <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 text-sm text-white cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="investing-holdings-hide-zero-book-value"
                      checked={hideZeroBookValue}
                      onChange={(e) => setHideZeroBookValue(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                    />
                    Hide zero book value
                  </label>
                </CompactFilterField>
              </CompactFilterBar>

              <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30">
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
                    {sortedHoldings.length === 0 ? (
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
                            <td className="px-4 py-3">{formatCurrency(toNumber(h.quantity) * toNumber(h.avg_cost), h.currency, currencyDisplayPreference)}</td>
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
                            <td className="px-4 py-3">{formatCurrency(h.current_value ?? (toNumber(h.quantity) * toNumber(h.avg_cost)), h.currency, currencyDisplayPreference)}</td>
                            <td className="px-4 py-3 font-medium">
                              <span className={colorClass}>
                                {sign}{formatCurrency(gainLoss, h.currency, currencyDisplayPreference)} ({sign}{gainLossPct.toFixed(2)}%)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                {h.source_type !== 'order' && (
                                  <button
                                    type="button"
                                    data-testid={`investing-edit-holding-${h.public_id}`}
                                    onClick={() => handleStartEditHolding(h)}
                                    className="rounded-lg border border-slate-600/70 p-2 text-slate-200 hover:bg-slate-700/60"
                                    title="Edit holding"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                )}
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
                                  {Number.isNaN(new Date(o.occurred_at).getTime())
                                    ? 'N/A'
                                    : new Date(o.occurred_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}
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
                                      onClick={() => handleStartEditOrder(o)}
                                      className="rounded-lg border border-slate-600/70 p-2 text-slate-200 hover:bg-slate-700/60"
                                      title="Edit order"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`investing-trade-history-delete-${o.public_id}`}
                                      disabled={deleteOrderMutation.isPending}
                                      onClick={() => setPendingDeleteOrder(o)}
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
        </TabsContent>

        <TabsContent value="orders">
          <div className="space-y-6">
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
                placeholder="Filter by symbol…"
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
                  ) : sortedOrders.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">No orders yet. Place your first order to get started.</td></tr>
                  ) : (
                    sortedOrders.map((o) => {
                      const fees = toNumber(o.brokerage_fee) + toNumber(o.tax_amount) + toNumber(o.other_fees);
                      const isBuy = o.order_type === 'buy';
                      return (
                        <tr
                          key={o.public_id}
                          data-testid={`investing-order-row-${o.public_id}`}
                          className="bg-slate-900/20 hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                            {Number.isNaN(new Date(o.occurred_at).getTime())
                              ? 'N/A'
                              : new Date(o.occurred_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}
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
                                onClick={() => handleStartEditOrder(o)}
                                className="rounded-lg border border-slate-600/70 p-2 text-slate-200 hover:bg-slate-700/60"
                                title="Edit order"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={deleteOrderMutation.isPending}
                                onClick={() => setPendingDeleteOrder(o)}
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
                      {(placeOrderMutation.error as Error)?.message ?? 'Failed to place order'}
                    </p>
                  )}
                </form>
              </div>
            </div>
          )}

        </TabsContent>

        <TabsContent value="cash">
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
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-6">
            <div data-testid="investing-analytics-heading" className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-white text-base">Look-through Analytics</h3>
              <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsCreateInstrumentModalOpen(true)}
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 sm:w-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Instrument
                </button>
                <button
                  type="button"
                  onClick={() => setIsSeedConstituentsModalOpen(true)}
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 sm:w-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Seed Constituents
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-4">
              <div className="lg:col-span-1 space-y-4">
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
                  <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold uppercase text-slate-400">Instruments</h4>
                      <span className="text-xs text-slate-500">{instruments.length}</span>
                    </div>
                    <div className="max-h-64 overflow-auto rounded border border-slate-700/40">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-800/60 text-slate-400">
                          <tr>
                            <th className="px-2 py-1.5">Symbol</th>
                            <th className="px-2 py-1.5">Type</th>
                            <th className="px-2 py-1.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {instruments.length === 0 ? (
                            <tr>
                              <td className="px-2 py-2 text-slate-500" colSpan={3}>No instruments yet.</td>
                            </tr>
                          ) : (
                            instruments.map((instrument) => (
                              <tr key={instrument.public_id} className="border-t border-slate-700/40">
                                <td className="px-2 py-1.5 font-medium text-slate-100">
                                  {editingInstrumentId === instrument.public_id ? (
                                    <input
                                      className="w-28 rounded border border-slate-600 bg-slate-950 px-1.5 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                      value={instrumentEditForm.name}
                                      onChange={(e) =>
                                        setInstrumentEditForm((s) => ({ ...s, name: e.target.value }))
                                      }
                                    />
                                  ) : (
                                    instrument.symbol
                                  )}
                                </td>
                                <td className="px-2 py-1.5">
                                  {editingInstrumentId === instrument.public_id ? (
                                    <DropdownSelect
                                      value={instrumentEditForm.instrument_type}
                                      options={[...instrumentTypeOptions]}
                                      onChange={(value) =>
                                        setInstrumentEditForm((s) => ({
                                          ...s,
                                          instrument_type: value as InstrumentType,
                                        }))
                                      }
                                      placeholder="Type"
                                    />
                                  ) : (
                                    instrumentTypeLabel(instrument.instrument_type)
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  {editingInstrumentId === instrument.public_id ? (
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveInstrument(instrument)}
                                        disabled={updateInstrumentMutation.isPending}
                                        className="rounded p-1 text-green-300 hover:bg-green-500/10 disabled:opacity-60"
                                        title="Save instrument"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingInstrumentId(null)}
                                        className="rounded p-1 text-rose-300 hover:bg-rose-500/10"
                                        title="Cancel"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditInstrument(instrument)}
                                      className="rounded p-1 text-slate-400 hover:bg-slate-700/60 hover:text-white"
                                      title="Edit instrument"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-100">
                  <Layers className="h-4 w-4" />
                  <h3 className="font-semibold">Exposure (Look-through)</h3>
                </div>
                {exposureLoading ? (
                  <p className="text-sm text-slate-400">Loading exposure…</p>
                ) : (
                  <div className="space-y-2 text-sm text-slate-300">
                    <p data-testid="investing-total-direct">
                      Total direct:{' '}
                      {exposure?.total_direct_exposure != null && analyticsCurrency
                        ? formatCurrency(exposure.total_direct_exposure, analyticsCurrency, currencyDisplayPreference)
                        : 'N/A'}
                    </p>
                    <p data-testid="investing-total-lookthrough">
                      Total look-through:{' '}
                      {exposure?.total_lookthrough_exposure != null && analyticsCurrency
                        ? formatCurrency(exposure.total_lookthrough_exposure, analyticsCurrency, currencyDisplayPreference)
                        : 'N/A'}
                    </p>
                    {(exposure?.warnings ?? []).map((warning, index) => (
                      <p key={`${warning}-${index}`} className="text-xs text-amber-300">{warning}</p>
                    ))}
                    {exposure && (
                      <p className="text-xs text-slate-500">
                        Showing constituents at or above {exposure.display_threshold_pct}% of the
                        portfolio
                        {exposure.hidden_exposure_count > 0
                          ? ` (${exposure.hidden_exposure_count} smaller constituents hidden)`
                          : ''}.
                      </p>
                    )}
                    <div className="max-h-96 overflow-auto rounded-lg border border-slate-700/40">
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
                              <td className="px-3 py-2">{analyticsCurrency ? formatCurrency(row.direct_exposure, analyticsCurrency, currencyDisplayPreference) : 'N/A'}</td>
                              <td className="px-3 py-2">{analyticsCurrency ? formatCurrency(row.lookthrough_exposure, analyticsCurrency, currencyDisplayPreference) : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-1 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
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
          </div>
        </TabsContent>
      </Tabs>

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
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    type="number"
                    step="0.00000001"
                    value={editHoldingForm.quantity}
                    onChange={(e) => setEditHoldingForm((s) => ({ ...s, quantity: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">Avg Cost</label>
                  <input
                    data-testid="investing-edit-holding-avg-cost"
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    type="number"
                    step="0.01"
                    value={editHoldingForm.avg_cost}
                    onChange={(e) => setEditHoldingForm((s) => ({ ...s, avg_cost: e.target.value }))}
                    required
                  />
                </div>
              </div>

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

      {/* Create Instrument Modal */}
      {isCreateInstrumentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsCreateInstrumentModalOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-semibold text-white">Create Instrument</h2>
              <button
                type="button"
                onClick={() => setIsCreateInstrumentModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onCreateInstrument} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Symbol (e.g. VTI)</label>
                <input
                  className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Symbol (e.g. VTI)"
                  value={instrumentForm.symbol}
                  onChange={(e) => setInstrumentForm((s) => ({ ...s, symbol: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Name</label>
                <input
                  className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Name"
                  value={instrumentForm.name}
                  onChange={(e) => setInstrumentForm((s) => ({ ...s, name: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Instrument Type</label>
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
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateInstrumentModalOpen(false)}
                  className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={createInstrumentMutation.isPending}
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {createInstrumentMutation.isPending ? 'Creating...' : 'Create instrument'}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                Instruments: {instrumentsLoading ? 'Loading...' : instruments.length}
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Seed Constituents Modal */}
      {isSeedConstituentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsSeedConstituentsModalOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-semibold text-white">Seed Constituents</h2>
              <button
                type="button"
                onClick={() => setIsSeedConstituentsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onUpsertConstituents} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Select Pooled Instrument</label>
                <Combobox
                  value={selectedInstrumentId}
                  options={pooledInstrumentOptions}
                  onChange={setSelectedInstrumentId}
                  placeholder="Select pooled instrument"
                  searchPlaceholder="Search instruments..."
                  clearLabel="Clear selection"
                  emptyText="No pooled instruments found."
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Constituents (TICKER,WEIGHT)</label>
                <textarea
                  className="h-28 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  value={constituentRowsText}
                  onChange={(e) => setConstituentRowsText(e.target.value)}
                  placeholder="AAPL,0.60&#10;MSFT,0.40"
                />
                {constituentError ? <p className="text-xs text-rose-300">{constituentError}</p> : null}
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSeedConstituentsModalOpen(false)}
                  className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={upsertConstituentsMutation.isPending}
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {upsertConstituentsMutation.isPending ? 'Upserting...' : 'Upsert constituents'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            }}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Edit Order — {selectedOrder.symbol}</h2>
              <button
                type="button"
                onClick={() => { setIsEditOrderModalOpen(false); setSelectedOrder(null); }}
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

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsEditOrderModalOpen(false); setSelectedOrder(null); }}
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
    </PageShell>
  );
};

type SortDir = 'asc' | 'desc';

const SortableHeader = ({
  children,
  col,
  activeCol,
  dir,
  onSort,
  className,
}: {
  children: React.ReactNode;
  col: string;
  activeCol: string;
  dir: SortDir;
  onSort: (col: string, dir: SortDir) => void;
  className?: string;
}) => {
  const isActive = activeCol === col;
  const nextDir: SortDir = isActive && dir === 'asc' ? 'desc' : 'asc';
  return (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:text-slate-200 transition-colors ${className ?? ''}`}
      onClick={() => onSort(col, nextDir)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
};

const SummaryCard = ({ label, value, icon, testId }: { label: string; value: string; icon: React.ReactNode; testId?: string }) => (
  <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
    <div className="mb-2 inline-flex rounded-xl bg-slate-700/60 p-2 text-slate-100">{icon}</div>
    <p className="text-sm text-slate-400">{label}</p>
    <p data-testid={testId} className="mt-2 text-2xl font-bold text-white">{value}</p>
  </div>
);

const formatPerformanceMetric = (
  amount: number | string,
  percentage: number | string | null,
  currency: string,
  preference: 'symbol' | 'code',
) => {
  const numericAmount = toNumber(amount);
  const sign = numericAmount > 0 ? '+' : '';
  const percentageLabel = percentage == null
    ? ''
    : ` (${toNumber(percentage) > 0 ? '+' : ''}${toNumber(percentage).toFixed(2)}%)`;
  return `${sign}${formatCurrency(numericAmount, currency, preference)}${percentageLabel}`;
};
