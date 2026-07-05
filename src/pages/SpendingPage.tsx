import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SkeletonList } from '../components/ui/FeedbackStates';
import { useInvalidatingMutation } from '../hooks/useInvalidatingMutation';
import { queryKeys } from '../lib/queryKeys';
import { spendingService } from '../services/spending';
import { financeService } from '../services/finance';
import type {
  Budget,
  BudgetCreate,
  BudgetUpdate,
  RecurringTransaction,
  RecurringTransactionCreate,
  RecurringTransactionUpdate,
  RecurringFrequency,
  Transaction,
  TransactionCreate,
  TransactionType,
  TransactionUpdate,
} from '../types/spending';

import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Trash2,
  Tag,
  X,
  Target,
  RefreshCw,
  ArrowRightLeft,
  Landmark,
  AlertCircle,
} from 'lucide-react';
import { DropdownSelect } from '../components/DropdownSelect';
import { DatePicker } from '../components/DatePicker';
import { DateRangePicker } from '../components/DateRangePicker';
import { CompactFilterBar, CompactFilterField } from '../components/filters/CompactFilterBar';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatCurrency } from '../utils/numberFormat';
import { formatDate } from '../utils/dateFormat';
import { TransactionsTab } from './spending/TransactionsTab';
import { BudgetsTab } from './spending/BudgetsTab';
import { RecurringTab } from './spending/RecurringTab';
import { TransfersTab } from './spending/TransfersTab';
import { AnalyticsTab } from './spending/AnalyticsTab';
import { LedgerTab } from './spending/LedgerTab';
import {
  buildMonthOptions,
  getCurrentMonthValue,
  localDateInputValue,
  monthStartToMonthValue,
  monthValueToDateRange,
} from './spending/format';

const budgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Select a category'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Select a valid month'),
  amount: z
    .string()
    .min(1, 'Enter a budget amount')
    .refine((value) => {
      const num = Number(value);
      return !Number.isNaN(num) && Number.isFinite(num) && num > 0;
    }, 'Budget must be a valid positive number'),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

const recurringFormSchema = z
  .object({
    categoryId: z.string().min(1, 'Select a category'),
    amount: z
      .string()
      .min(1, 'Enter an amount')
      .refine((v) => {
        const num = Number(v);
        return !Number.isNaN(num) && Number.isFinite(num) && num > 0;
      }, 'Amount must be a valid positive number'),
    type: z.enum(['income', 'expense']),
    description: z.string().max(500).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z
      .string()
      .refine((v) => {
        const num = Number(v);
        return Number.isInteger(num) && Number.isFinite(num) && num >= 1;
      }, 'Interval must be a positive integer'),
    anchor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a start date'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    monthly_mode: z.enum(['day_of_month', 'last_day', 'nth_weekday']),
    by_weekday: z.string().optional(),
    by_ordinal: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.end_date) return true;
      return new Date(data.end_date) >= new Date(data.anchor_date);
    },
    {
      message: 'End date must be after or equal to start date',
      path: ['end_date'],
    }
  );

type RecurringFormValues = z.infer<typeof recurringFormSchema>;

// Every new transaction must resolve to an account (spec-054). The
// workspace default takes priority; this is only the pre-fill fallback
// for workspaces that haven't set one yet.
const LAST_USED_ACCOUNT_KEY = 'spending:lastUsedAccountId';
const getLastUsedAccountId = (): string => {
  try {
    return window.localStorage.getItem(LAST_USED_ACCOUNT_KEY) ?? '';
  } catch {
    return '';
  }
};
const setLastUsedAccountId = (accountId: string) => {
  try {
    window.localStorage.setItem(LAST_USED_ACCOUNT_KEY, accountId);
  } catch {
    // Storage unavailable (private browsing, quota) — pre-fill just won't persist.
  }
};

// Sentinel for the account filter's "No account" option — historical
// NULL-account rows (forward-only per spec-054/spec-050) are filtered via
// the backend's `unassigned=true` param, not a real account id.
const UNASSIGNED_ACCOUNT_FILTER_VALUE = '__unassigned__';

export const SpendingPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    return start.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => {
    const now = new Date();
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
    return end.toISOString().split('T')[0];
  });
  const selectedMonth = useMemo(() => fromDate.slice(0, 7), [fromDate]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState<'transactions' | 'budgets' | 'recurring' | 'transfers' | 'analytics' | 'ledger'>('transactions');

  // Ledger tab state
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [ledgerOffset, setLedgerOffset] = useState(0);
  const ledgerLimit = 50;

  // Budget Modal
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [txOffset, setTxOffset] = useState(0);
  const [budgetOffset, setBudgetOffset] = useState(0);
  const [recurringOffset, setRecurringOffset] = useState(0);
  const [transferOffset, setTransferOffset] = useState(0);
  const limit = 50;
  const monthRange = useMemo(() => monthValueToDateRange(selectedMonth), [selectedMonth]);
  const monthFilterOptions = useMemo(() => buildMonthOptions(), []);

  // Recurring modal state
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isQuickAccountModalOpen, setIsQuickAccountModalOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'bank' | 'wallet' | 'card' | 'gift_card'>('wallet');
  const [newAccountCurrency, setNewAccountCurrency] = useState('USD');
  const [recurringPendingDeactivate, setRecurringPendingDeactivate] = useState<{
    publicId: string;
    description: string;
  } | null>(null);
  const [transferFromAccountId, setTransferFromAccountId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFxRate, setTransferFxRate] = useState('');
  const [transferFxFee, setTransferFxFee] = useState('0');
  const [transferPlatformFee, setTransferPlatformFee] = useState('0');
  const [transferTax, setTransferTax] = useState('0');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);

  // Edit / delete transfer state
  const [editingTransfer, setEditingTransfer] = useState<import('../types/finance').CapitalTransfer | null>(null);
  const [editTransferFromId, setEditTransferFromId] = useState('');
  const [editTransferToId, setEditTransferToId] = useState('');
  const [editTransferGross, setEditTransferGross] = useState('');
  const [editTransferFxRate, setEditTransferFxRate] = useState('');
  const [editTransferFxFee, setEditTransferFxFee] = useState('0');
  const [editTransferPlatformFee, setEditTransferPlatformFee] = useState('0');
  const [editTransferTax, setEditTransferTax] = useState('0');
  const [editTransferNet, setEditTransferNet] = useState('');
  const [editTransferNotes, setEditTransferNotes] = useState('');
  const [editTransferDate, setEditTransferDate] = useState('');
  const [editTransferError, setEditTransferError] = useState<string | null>(null);
  const [deletingTransfer, setDeletingTransfer] = useState<import('../types/finance').CapitalTransfer | null>(null);
  const [deleteTransferError, setDeleteTransferError] = useState<string | null>(null);

  const { data: categoriesResponse, isLoading: isCatsLoading } = useQuery({
    queryKey: queryKeys.spending.categories(),
    queryFn: () => spendingService.getCategories(200, 0)
  });
  const categories = categoriesResponse?.items;
  const categoryOptions = useMemo(() => categories?.map((category) => ({
    value: category.public_id,
    label: category.name,
  })) ?? [], [categories]);
  const categoryFilterOptions = categoryOptions;
  const { data: accountsResponse } = useQuery({
    queryKey: ['finance', 'accounts', 'spending'],
    queryFn: () => financeService.getAccounts(200, 0),
  });
  const allAccounts = useMemo(() => accountsResponse?.items ?? [], [accountsResponse?.items]);
  const spendingAccounts = useMemo(
    () =>
      allAccounts.filter((account) =>
        ['bank', 'wallet', 'card', 'gift_card'].includes(account.account_type)
      ),
    [allAccounts]
  );
  const accountOptions = useMemo(
    () =>
      spendingAccounts.map((account) => ({
          value: account.public_id,
          label: `${account.name} (${account.account_type.replace('_', ' ')})`,
        })),
    [spendingAccounts]
  );
  const accountById = useMemo(
    () => new Map(spendingAccounts.map((account) => [account.public_id, account])),
    [spendingAccounts]
  );
  const transferAccountOptions = useMemo(
    () =>
      allAccounts.map((account) => ({
        value: account.public_id,
        label: `${account.name} (${account.account_type.replace('_', ' ')})`,
      })),
    [allAccounts]
  );
  const transferAccountById = useMemo(
    () => new Map(allAccounts.map((account) => [account.public_id, account])),
    [allAccounts]
  );
  const accountTypeOptions: Array<{ value: 'bank' | 'wallet' | 'card' | 'gift_card'; label: string }> = [
    { value: 'wallet', label: 'Wallet' },
    { value: 'bank', label: 'Bank' },
    { value: 'card', label: 'Card' },
    { value: 'gift_card', label: 'Gift Card' },
  ];

  const {
    control: budgetControl,
    register: registerBudgetField,
    handleSubmit: handleBudgetSubmit,
    reset: resetBudgetForm,
    formState: { errors: budgetErrors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoryId: '',
      month: getCurrentMonthValue(),
      amount: '',
    },
  });

  const isUnassignedFilterActive = selectedAccountFilter === UNASSIGNED_ACCOUNT_FILTER_VALUE;

  const { data: transactionsResponse, isLoading: isTxLoading } = useQuery({
    queryKey: queryKeys.spending.transactions(txOffset, fromDate, toDate, selectedCategoryFilter, selectedAccountFilter),
    queryFn: () => spendingService.getTransactions(limit, txOffset, {
      categoryId: selectedCategoryFilter || undefined,
      accountId: isUnassignedFilterActive ? undefined : selectedAccountFilter || undefined,
      unassigned: isUnassignedFilterActive,
      fromDate: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
      toDate: toDate ? `${toDate}T23:59:59.999Z` : undefined,
    }),
  });
  const transactions = transactionsResponse?.items;

  // Backing the filter's count badge — the `unassigned` list endpoint's
  // `total` is already exactly this count (spec-054), no separate endpoint.
  // Mirror the active date/category filters so the badge matches the list
  // shown when the option is selected (the list query above also passes
  // fromDate/toDate through while the unassigned filter is active).
  const { data: unassignedCountResponse } = useQuery({
    queryKey: queryKeys.spending.transactions('unassigned-count', fromDate, toDate, selectedCategoryFilter),
    queryFn: () => spendingService.getTransactions(1, 0, {
      unassigned: true,
      categoryId: selectedCategoryFilter || undefined,
      fromDate: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
      toDate: toDate ? `${toDate}T23:59:59.999Z` : undefined,
    }),
  });
  const unassignedTransactionCount = unassignedCountResponse?.total ?? 0;

  const { data: summaryResponse, isLoading: isSummaryLoading } = useQuery({
    queryKey: queryKeys.spending.summary(fromDate, toDate, selectedCategoryFilter, selectedAccountFilter),
    queryFn: () => spendingService.getTransactionSummary({
      fromDate: fromDate ? `${fromDate}T00:00:00.000Z` : `${new Date().getFullYear()}-01-01T00:00:00.000Z`,
      toDate: toDate ? `${toDate}T23:59:59.999Z` : `${new Date().getFullYear()}-12-31T23:59:59.999Z`,
      categoryId: selectedCategoryFilter || undefined,
      // The summary endpoint has no unassigned filter — falls back to the
      // unfiltered (all-accounts) summary while the unassigned filter is active.
      accountId: isUnassignedFilterActive ? undefined : selectedAccountFilter || undefined,
    }),
  });

  // "No account" is always last (spec-054) — real accounts sort
  // alphabetically ahead of it, so sortByLabel is not used on this dropdown.
  const accountFilterOptions = useMemo(
    () => [
      ...[...accountOptions].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      ),
      { value: UNASSIGNED_ACCOUNT_FILTER_VALUE, label: `No account (${unassignedTransactionCount})` },
    ],
    [accountOptions, unassignedTransactionCount]
  );

  const { data: budgetsResponse, isLoading: isBudgetsLoading } = useQuery({
    queryKey: queryKeys.spending.budgets(budgetOffset, selectedMonth),
    queryFn: () => spendingService.getBudgets(limit, budgetOffset, monthRange.monthStart),
    enabled: monthRange.isValid,
  });
  const budgets = useMemo(
    () => budgetsResponse?.items.filter((budget) => monthStartToMonthValue(budget.month_start) === selectedMonth) ?? [],
    [budgetsResponse, selectedMonth]
  );

  const createMutation = useInvalidatingMutation(
    (newTx: TransactionCreate) => spendingService.createTransaction(newTx),
    [queryKeys.spending.transactions(), queryKeys.spending.summary(), queryKeys.dashboard.all],
    { onSuccess: () => closeTransactionModal() },
  );

  const updateMutation = useInvalidatingMutation(
    ({ id, data }: { id: string; data: TransactionUpdate }) => spendingService.updateTransaction(id, data),
    [queryKeys.spending.transactions(), queryKeys.spending.summary(), queryKeys.dashboard.all],
    { onSuccess: () => closeTransactionModal() },
  );

  const deleteMutation = useInvalidatingMutation(
    (id: string) => spendingService.deleteTransaction(id),
    [queryKeys.spending.transactions(), queryKeys.spending.summary(), queryKeys.dashboard.all],
  );

  const createBudgetMutation = useInvalidatingMutation(
    (newBudget: BudgetCreate) => spendingService.createBudget(newBudget),
    [queryKeys.spending.budgets(), queryKeys.dashboard.all],
    { onSuccess: () => closeBudgetModal() },
  );

  const updateBudgetMutation = useInvalidatingMutation(
    ({ id, data }: { id: string; data: BudgetUpdate }) => spendingService.updateBudget(id, data),
    [queryKeys.spending.budgets(), queryKeys.dashboard.all],
    { onSuccess: () => closeBudgetModal() },
  );

  // ----- Recurring Queries & Mutations -----
  const { data: recurringResponse, isLoading: isRecurringLoading } = useQuery({
    queryKey: queryKeys.spending.recurring(recurringOffset),
    queryFn: () => spendingService.getRecurring(limit, recurringOffset, true),
  });
  const { data: transfersResponse, isLoading: isTransfersLoading } = useQuery({
    queryKey: ['finance', 'transfers', transferOffset],
    queryFn: () => financeService.getTransfers(limit, transferOffset),
  });
  const { data: userFinanceSettings } = useQuery({
    queryKey: ['finance', 'settings', 'user'],
    queryFn: () => financeService.getUserSettings(),
  });
  const { data: workspaceFinanceSettings } = useQuery({
    queryKey: ['finance', 'settings', 'workspace'],
    queryFn: () => financeService.getSettings(),
  });
  const defaultSpendingAccountId = workspaceFinanceSettings?.default_spending_account_id ?? null;

  // If the workspace default (or accounts list) is still loading when the
  // "new transaction" modal opens, pre-fill it reactively once it arrives
  // instead of leaving the field stuck empty (spec-054).
  React.useEffect(() => {
    if (!isModalOpen || editingTransaction || accountId) return;
    const fallbackAccountId = defaultSpendingAccountId || getLastUsedAccountId();
    if (fallbackAccountId && accountById.has(fallbackAccountId)) {
      setAccountId(fallbackAccountId);
    }
  }, [isModalOpen, editingTransaction, accountId, defaultSpendingAccountId, accountById]);

  const displayCurrency = userFinanceSettings?.effective_reporting_currency_code ?? 'USD';
  const currencyDisplayPreference =
    userFinanceSettings?.effective_currency_display_preference ?? 'symbol';
  const recurringItems = recurringResponse?.items ?? [];
  const transferItems = transfersResponse?.items ?? [];

  const {
    control: recurringControl,
    register: registerRecurringField,
    handleSubmit: handleRecurringSubmit,
    reset: resetRecurringForm,
    watch: watchRecurringForm,
    formState: { errors: recurringErrors },
  } = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      categoryId: '',
      amount: '',
      type: 'expense',
      description: '',
      frequency: 'monthly',
      interval: '1',
      anchor_date: localDateInputValue(),
      end_date: '',
      monthly_mode: 'day_of_month',
      by_weekday: '0',
      by_ordinal: '1',
    },
  });
  const recurringFrequencyWatch = watchRecurringForm('frequency');
  const recurringMonthlyModeWatch = watchRecurringForm('monthly_mode');
  const isRecurringNthWeekdayMode =
    recurringFrequencyWatch === 'monthly' && recurringMonthlyModeWatch === 'nth_weekday';

  const createRecurringMutation = useInvalidatingMutation(
    (data: RecurringTransactionCreate) => spendingService.createRecurring(data),
    [queryKeys.spending.recurring()],
    { onSuccess: () => closeRecurringModal() },
  );

  const updateRecurringMutation = useInvalidatingMutation(
    ({ id, data }: { id: string; data: RecurringTransactionUpdate }) =>
      spendingService.updateRecurring(id, data),
    [queryKeys.spending.recurring()],
    { onSuccess: () => closeRecurringModal() },
  );

  const deactivateRecurringMutation = useInvalidatingMutation(
    (id: string) => spendingService.deleteRecurring(id),
    [queryKeys.spending.recurring()],
    {
      onError: (error) => {
        console.error('Failed to deactivate recurring rule:', error);
        alert('Failed to deactivate recurring rule. Please try again.');
      },
    },
  );
  const createTransferMutation = useInvalidatingMutation(
    () => {
      const from = transferAccountById.get(transferFromAccountId);
      const to = transferAccountById.get(transferToAccountId);
      if (!from || !to) {
        throw new Error('Transfer accounts are required');
      }
      const fromModule = from.account_type === 'brokerage' ? 'investing' : 'spending';
      const toModule = to.account_type === 'brokerage' ? 'investing' : 'spending';
      const gross = Number(transferAmount);
      if (Number.isNaN(gross) || !Number.isFinite(gross) || gross <= 0) {
        throw new Error('Gross amount must be a valid positive number');
      }
      const fxFee = transferFxFee ? Number(transferFxFee) : 0;
      const platformFee = transferPlatformFee ? Number(transferPlatformFee) : 0;
      const tax = transferTax ? Number(transferTax) : 0;

      if (Number.isNaN(fxFee) || !Number.isFinite(fxFee) || fxFee < 0) {
        throw new Error('FX fee must be a valid non-negative number');
      }
      if (Number.isNaN(platformFee) || !Number.isFinite(platformFee) || platformFee < 0) {
        throw new Error('Platform fee must be a valid non-negative number');
      }
      if (Number.isNaN(tax) || !Number.isFinite(tax) || tax < 0) {
        throw new Error('Tax must be a valid non-negative number');
      }

      let parsedFxRate = null;
      let rateNum = 1;
      if (transferFxRate) {
        const rate = Number(transferFxRate);
        if (Number.isNaN(rate) || !Number.isFinite(rate) || rate <= 0) {
          throw new Error('FX rate must be a valid positive number');
        }
        parsedFxRate = rate.toFixed(10);
        rateNum = rate;
      }

      const net = Math.max(0, gross * rateNum - fxFee - platformFee - tax);
      const parsedTransferDate = new Date(transferDate);
      if (Number.isNaN(parsedTransferDate.getTime())) {
        throw new Error('Invalid transfer date');
      }

      return financeService.createTransfer({
        from_module: fromModule,
        to_module: toModule,
        from_account_id: from.public_id,
        to_account_id: to.public_id,
        from_currency_code: from.default_currency_code,
        to_currency_code: to.default_currency_code,
        gross_amount: gross.toFixed(2),
        fx_rate_used: parsedFxRate,
        fx_fee_amount: fxFee.toFixed(2),
        platform_fee_amount: platformFee.toFixed(2),
        tax_amount: tax.toFixed(2),
        net_amount_received: net.toFixed(2),
        occurred_at: parsedTransferDate.toISOString(),
        notes: transferNotes || null,
      });
    },
    [queryKeys.dashboard.all, queryKeys.finance.transfers()],
    {
      onSuccess: () => {
        setIsTransferModalOpen(false);
        setTransferFromAccountId('');
        setTransferToAccountId('');
        setTransferAmount('');
        setTransferFxRate('');
        setTransferFxFee('0');
        setTransferPlatformFee('0');
        setTransferTax('0');
        setTransferNotes('');
        setTransferDate(new Date().toISOString().split('T')[0]);
        setTransferOffset(0);
      },
    },
  );

  const updateTransferMutation = useInvalidatingMutation(
    () => {
      if (!editingTransfer) throw new Error('No transfer selected');
      if (!editTransferFromId || !editTransferToId) {
        throw new Error('Both From and To accounts must be selected');
      }
      if (editTransferFromId === editTransferToId) {
        throw new Error('Source and destination accounts cannot be the same');
      }
      const gross = Number(editTransferGross);
      if (Number.isNaN(gross) || !Number.isFinite(gross) || gross <= 0) {
        throw new Error('Gross amount must be a valid positive number');
      }
      const net = Number(editTransferNet);
      if (Number.isNaN(net) || !Number.isFinite(net) || net < 0) {
        throw new Error('Net received must be a valid non-negative number');
      }
      const fxFee = editTransferFxFee ? Number(editTransferFxFee) : 0;
      const platformFee = editTransferPlatformFee ? Number(editTransferPlatformFee) : 0;
      const tax = editTransferTax ? Number(editTransferTax) : 0;
      if (Number.isNaN(fxFee) || !Number.isFinite(fxFee) || fxFee < 0) {
        throw new Error('FX fee must be a valid non-negative number');
      }
      if (Number.isNaN(platformFee) || !Number.isFinite(platformFee) || platformFee < 0) {
        throw new Error('Platform fee must be a valid non-negative number');
      }
      if (Number.isNaN(tax) || !Number.isFinite(tax) || tax < 0) {
        throw new Error('Tax must be a valid non-negative number');
      }
      let parsedFxRate: string | null = null;
      if (editTransferFxRate) {
        const rate = Number(editTransferFxRate);
        if (Number.isNaN(rate) || !Number.isFinite(rate) || rate <= 0) {
          throw new Error('FX rate must be a valid positive number');
        }
        parsedFxRate = rate.toFixed(10);
      }
      const parsedDate = new Date(editTransferDate);
      if (Number.isNaN(parsedDate.getTime())) throw new Error('Invalid date');
      const fromAccount = transferAccountById.get(editTransferFromId);
      const toAccount = transferAccountById.get(editTransferToId);
      return financeService.updateTransfer(editingTransfer.public_id, {
        from_account_id: fromAccount?.public_id ?? editingTransfer.from_account_public_id ?? undefined,
        to_account_id: toAccount?.public_id ?? editingTransfer.to_account_public_id ?? undefined,
        from_currency_code: fromAccount?.default_currency_code,
        to_currency_code: toAccount?.default_currency_code,
        gross_amount: gross.toFixed(2),
        fx_rate_used: parsedFxRate,
        fx_fee_amount: fxFee.toFixed(2),
        platform_fee_amount: platformFee.toFixed(2),
        tax_amount: tax.toFixed(2),
        net_amount_received: net.toFixed(2),
        occurred_at: parsedDate.toISOString(),
        notes: editTransferNotes || null,
      });
    },
    [queryKeys.finance.transfers(), queryKeys.dashboard.all],
    {
      onSuccess: () => {
        setEditingTransfer(null);
        setEditTransferError(null);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (err instanceof Error ? err.message : 'Failed to update transfer');
        setEditTransferError(msg);
      },
    },
  );

  const deleteTransferMutation = useInvalidatingMutation(
    () => {
      if (!deletingTransfer) throw new Error('No transfer selected');
      return financeService.deleteTransfer(deletingTransfer.public_id);
    },
    [queryKeys.finance.transfers(), queryKeys.dashboard.all],
    {
      onSuccess: () => {
        setDeletingTransfer(null);
        setDeleteTransferError(null);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (err instanceof Error ? err.message : 'Failed to delete transfer');
        setDeleteTransferError(msg);
      },
    },
  );

  const openEditTransfer = (t: import('../types/finance').CapitalTransfer) => {
    setEditingTransfer(t);
    setEditTransferFromId(t.from_account_public_id ?? '');
    setEditTransferToId(t.to_account_public_id ?? '');
    setEditTransferGross(t.gross_amount);
    setEditTransferFxRate(t.fx_rate_used ?? '');
    setEditTransferFxFee(t.fx_fee_amount);
    setEditTransferPlatformFee(t.platform_fee_amount);
    setEditTransferTax(t.tax_amount);
    setEditTransferNet(t.net_amount_received);
    setEditTransferNotes(t.notes ?? '');
    setEditTransferDate(
      t.occurred_at && !Number.isNaN(Date.parse(t.occurred_at))
        ? new Date(t.occurred_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    );
    setEditTransferError(null);
  };

  const createAccountMutation = useInvalidatingMutation(
    () =>
      financeService.createAccount({
        name: newAccountName.trim(),
        account_type: newAccountType,
        default_currency_code: newAccountCurrency.trim().toUpperCase(),
      }),
    [queryKeys.finance.accounts(), queryKeys.finance.accounts('spending')],
    {
      onSuccess: (created) => {
        setAccountId(created.public_id);
        if (!transferFromAccountId) setTransferFromAccountId(created.public_id);
        setNewAccountName('');
        setNewAccountType('wallet');
        setNewAccountCurrency(created.default_currency_code);
        setIsQuickAccountModalOpen(false);
      },
    },
  );

  const createCategoryMutation = useInvalidatingMutation(
    (data: { name: string; icon?: string }) =>
      spendingService.createCategory({ name: data.name, icon: data.icon || null }),
    [queryKeys.spending.categories()],
    {
      onSuccess: () => {
        setNewCategoryName('');
        setNewCategoryIcon('');
        setIsManageCategoriesOpen(false);
      },
    },
  );

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    // Every new transaction must resolve to an account (spec-054); editing a
    // historical NULL-account row is still allowed to leave it unassigned —
    // that's the forward-only house rule, not a form bug.
    if (!amount || !categoryId || !type || !date || (!editingTransaction && !accountId)) return;
    const parsedAmount = parseFloat(amount);
    if (Number.isNaN(parsedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }
    const parsedTransactionDate = new Date(date);
    if (Number.isNaN(parsedTransactionDate.getTime())) {
      alert('Please enter a valid transaction date.');
      return;
    }
    const payload: TransactionCreate = {
      amount: parsedAmount,
      category_id: categoryId,
      account_id: accountId || null,
      type,
      occurred_at: parsedTransactionDate.toISOString(),
      description: description || null
    };

    if (editingTransaction) {
      updateMutation.mutate({
        id: editingTransaction.public_id,
        data: payload,
      });
      return;
    }

    if (accountId) {
      setLastUsedAccountId(accountId);
    }
    createMutation.mutate(payload);
  };

  const closeBudgetModal = () => {
    setIsBudgetModalOpen(false);
    setEditingBudgetId(null);
    resetBudgetForm({
      categoryId: '',
      month: selectedMonth,
      amount: '',
    });
  };

  const openTransactionModalForNew = () => {
    setEditingTransaction(null);
    setAmount('');
    setDescription('');
    setType('expense');
    setCategoryId('');
    // Pre-fill: workspace default spending account, else the last account
    // this user picked (spec-054) — falls back to empty only when neither
    // is available, which blocks submit until one is chosen.
    const fallbackAccountId = defaultSpendingAccountId || getLastUsedAccountId();
    setAccountId(
      fallbackAccountId && accountById.has(fallbackAccountId) ? fallbackAccountId : ''
    );
    setDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };


  const openTransactionModalForEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setAmount(tx.amount.toString());
    setDescription(tx.description ?? '');
    setType(tx.type);
    setCategoryId(tx.category_id);
    setAccountId(tx.account_id ?? '');
    setDate(new Date(tx.occurred_at).toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const closeTransactionModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
    setAmount('');
    setDescription('');
    setType('expense');
    setCategoryId('');
    setAccountId('');
    setDate(new Date().toISOString().split('T')[0]);
  };


  const openRecurringModalForNew = () => {
    setEditingRecurring(null);
    resetRecurringForm({
      categoryId: '',
      amount: '',
      type: 'expense',
      description: '',
      frequency: 'monthly',
      interval: '1',
      anchor_date: localDateInputValue(),
      end_date: '',
      monthly_mode: 'day_of_month',
      by_weekday: '0',
      by_ordinal: '1',
    });
    setIsRecurringModalOpen(true);
  };

  const openRecurringModalForEdit = (r: RecurringTransaction) => {
    setEditingRecurring(r);
    resetRecurringForm({
      categoryId: r.category_id,
      amount: r.amount.toString(),
      type: r.type,
      description: r.description ?? '',
      frequency: r.frequency as RecurringFrequency,
      interval: r.interval.toString(),
      anchor_date: r.anchor_date,
      end_date: r.end_date ?? '',
      monthly_mode: r.monthly_mode ?? 'day_of_month',
      by_weekday: r.by_weekday != null ? String(r.by_weekday) : '0',
      by_ordinal: r.by_ordinal != null ? String(r.by_ordinal) : '1',
    });
    setIsRecurringModalOpen(true);
  };

  const closeRecurringModal = () => {
    setIsRecurringModalOpen(false);
    setEditingRecurring(null);
    resetRecurringForm();
  };

  const confirmDeactivateRecurring = () => {
    if (!recurringPendingDeactivate) return;
    deactivateRecurringMutation.mutate(recurringPendingDeactivate.publicId, {
      onSuccess: () => setRecurringPendingDeactivate(null),
    });
  };

  const handleSaveRecurring = (values: RecurringFormValues) => {
    const isNthWeekday = values.frequency === 'monthly' && values.monthly_mode === 'nth_weekday';
    const monthlyMode = values.frequency === 'monthly' ? values.monthly_mode : 'day_of_month';
    const byWeekday = isNthWeekday && values.by_weekday ? parseInt(values.by_weekday, 10) : null;
    const byOrdinal = isNthWeekday && values.by_ordinal ? parseInt(values.by_ordinal, 10) : null;
    if (editingRecurring) {
      const update: RecurringTransactionUpdate = {
        amount: parseFloat(values.amount),
        description: values.description || null,
        frequency: values.frequency as RecurringFrequency,
        interval: parseInt(values.interval, 10),
        end_date: values.end_date || null,
        monthly_mode: monthlyMode,
        by_weekday: byWeekday,
        by_ordinal: byOrdinal,
      };
      updateRecurringMutation.mutate({ id: editingRecurring.public_id, data: update });
    } else {
      const create: RecurringTransactionCreate = {
        category_id: values.categoryId,
        amount: parseFloat(values.amount),
        type: values.type as TransactionType,
        description: values.description || null,
        frequency: values.frequency as RecurringFrequency,
        interval: parseInt(values.interval, 10),
        anchor_date: values.anchor_date,
        end_date: values.end_date || null,
        monthly_mode: monthlyMode,
        by_weekday: byWeekday,
        by_ordinal: byOrdinal,
      };
      createRecurringMutation.mutate(create);
    }
  };

  const handleSaveBudget = (values: BudgetFormValues) => {
    // Normalize to the first of the month as required by the backend
    const monthStart = `${values.month}-01`;

    if (editingBudgetId) {
      updateBudgetMutation.mutate({
        id: editingBudgetId,
        data: { amount: parseFloat(values.amount) }
      });
    } else {
      createBudgetMutation.mutate({
        category_id: values.categoryId,
        amount: parseFloat(values.amount),
        month_start: monthStart
      });
    }
  };

  const openBudgetModalForNew = () => {
    setEditingBudgetId(null);
    resetBudgetForm({
      categoryId: '',
      month: selectedMonth,
      amount: '',
    });
    setIsBudgetModalOpen(true);
  };

  const openBudgetModalForEdit = (b: Budget) => {
    setEditingBudgetId(b.public_id);
    resetBudgetForm({
      categoryId: b.category_id,
      month: monthStartToMonthValue(b.month_start),
      amount: b.amount.toString(),
    });
    setIsBudgetModalOpen(true);
  };

  const getCategoryTheme = (catId: string) => {
    const cat = categories?.find(c => c.public_id === catId);
    return cat ? { name: cat.name, color: cat.color || '#3b82f6', icon: cat.icon } : { name: 'Unknown', color: '#64748b', icon: '' };
  };

  // Summaries
  const summary = useMemo(() => {
    const income = Number(summaryResponse?.income_total ?? 0);
    const expense = Number(summaryResponse?.expense_total ?? 0);
    return {
      income,
      expense,
      net: Number(summaryResponse?.net_total ?? income - expense),
    };
  }, [summaryResponse]);

  const spentByCategory = useMemo(() => {
    return new Map(
      (summaryResponse?.category_totals ?? []).map((entry) => [entry.category_id, Number(entry.total)])
    );
  }, [summaryResponse]);

  const isLoading = isCatsLoading || isTxLoading || isBudgetsLoading || isSummaryLoading;

  return (
    <PageShell animated>
      <PageHero
        title="Spending Overview"
        subtitle={`Track your finances across the workspace for ${monthRange.label}.`}
        actions={(
          <>
          <button
            onClick={openTransactionModalForNew}
            data-testid="spending-open-new-transaction"
            className="group relative flex h-12 min-w-[170px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-500 px-5 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] hover:shadow-cyan-500/40 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <Plus className="h-5 w-5" />
            <span className="whitespace-nowrap">New Transaction</span>
          </button>

          <button
            onClick={openBudgetModalForNew}
            data-testid="spending-open-set-budget"
            className="group relative flex h-12 min-w-[150px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800 px-5 font-semibold text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95"
          >
            <Target className="h-5 w-5" />
            <span className="whitespace-nowrap">Set Budget</span>
          </button>
          <button
            onClick={openRecurringModalForNew}
            data-testid="spending-open-add-recurring"
            className="group relative flex h-12 min-w-[160px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800 px-5 font-semibold text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95"
          >
            <RefreshCw className="h-5 w-5" />
            <span className="whitespace-nowrap">Add Recurring</span>
          </button>
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="group relative flex h-12 min-w-[130px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800 px-5 font-semibold text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95"
          >
            <ArrowRightLeft className="h-5 w-5" />
            <span className="whitespace-nowrap">Transfer</span>
          </button>
          <button
            onClick={() => setIsManageCategoriesOpen(true)}
            data-testid="spending-open-manage-categories"
            className="group relative flex h-12 min-w-[160px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800 px-5 font-semibold text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95"
          >
            <Tag className="h-5 w-5" />
            <span className="whitespace-nowrap">Categories</span>
          </button>
          </>
        )}
      />

      <CompactFilterBar
        className="mb-6"
        onReset={() => {
          const now = new Date();
          const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
          const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
          setFromDate(start.toISOString().split('T')[0]);
          setToDate(end.toISOString().split('T')[0]);
          setSelectedCategoryFilter('');
          setSelectedAccountFilter('');
          setTxOffset(0);
          setBudgetOffset(0);
        }}
      >
        <CompactFilterField label="Date range">
          <DateRangePicker
            from={fromDate}
            to={toDate}
            onChange={({ from, to }) => {
              setFromDate(from);
              setToDate(to);
              setTxOffset(0);
              setBudgetOffset(0);
            }}
            placeholder="Select date range"
          />
        </CompactFilterField>
        <CompactFilterField label="Category">
          <DropdownSelect
            value={selectedCategoryFilter}
            onChange={(value) => {
              setSelectedCategoryFilter(value);
              setTxOffset(0);
            }}
            options={categoryFilterOptions}
            placeholder="All categories"
            clearLabel="All categories"
            showSearch
            sortByLabel
          />
        </CompactFilterField>
        <CompactFilterField label="Account">
          <DropdownSelect
            testId="spending-account-filter"
            value={selectedAccountFilter}
            onChange={(value) => {
              setSelectedAccountFilter(value);
              setTxOffset(0);
            }}
            options={accountFilterOptions}
            placeholder="All accounts"
            clearLabel="All accounts"
            showSearch
          />
        </CompactFilterField>
      </CompactFilterBar>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/80 p-6 backdrop-blur-xl transition-all hover:border-slate-600">
          <div className="absolute -right-4 -top-4 rounded-full bg-emerald-500/10 p-8 blur-2xl" />
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-emerald-500/20 p-3 text-emerald-400">
              <ArrowUpCircle className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Income</p>
              <h2 className="text-2xl font-bold text-white">{formatCurrency(summary.income, displayCurrency, currencyDisplayPreference)}</h2>
              <p className="mt-1 text-xs text-slate-500">Reporting: {displayCurrency}</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/80 p-6 backdrop-blur-xl transition-all hover:border-slate-600">
          <div className="absolute -right-4 -top-4 rounded-full bg-rose-500/10 p-8 blur-2xl" />
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-rose-500/20 p-3 text-rose-400">
              <ArrowDownCircle className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Expenses</p>
              <h2 className="text-2xl font-bold text-white">{formatCurrency(summary.expense, displayCurrency, currencyDisplayPreference)}</h2>
              <p className="mt-1 text-xs text-slate-500">Reporting: {displayCurrency}</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-800/80 p-6 backdrop-blur-xl transition-all hover:border-slate-600">
          <div className={`absolute -right-4 -top-4 rounded-full p-8 blur-2xl ${summary.net >= 0 ? 'bg-cyan-500/10' : 'bg-red-500/10'}`} />
          <div className="flex items-start justify-between gap-4">
            <div className={`rounded-xl p-3 ${summary.net >= 0 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'}`}>
              <Wallet className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Net Balance</p>
              <h2 className="text-2xl font-bold text-white">{formatCurrency(summary.net, displayCurrency, currencyDisplayPreference)}</h2>
              <p className="mt-1 text-xs text-slate-500">Reporting: {displayCurrency}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mb-6 rounded-xl border border-slate-700/50 bg-slate-900/35 px-4 py-3 text-xs text-slate-300">
        Transaction rows show their original source currency. Summary cards above are reported in {displayCurrency}.
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-700/50 pb-px">
        <button
          data-testid="spending-tab-transactions"
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'transactions' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Transactions
        </button>
        <button
          data-testid="spending-tab-budgets"
          onClick={() => setActiveTab('budgets')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'budgets' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Budgets
        </button>
        <button
          data-testid="spending-tab-recurring"
          onClick={() => setActiveTab('recurring')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'recurring' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Recurring rules
        </button>
        <button
          data-testid="spending-tab-transfers"
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'transfers' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Transfers
        </button>
        <button
          data-testid="spending-tab-analytics"
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'analytics' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Analytics
        </button>
        <button
          data-testid="spending-tab-ledger"
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'ledger' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Ledger
        </button>
      </div>

      {isRecurringLoading && activeTab === 'recurring' ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-cyan-500" />
        </div>
      ) : isTransfersLoading && activeTab === 'transfers' ? (
        <SkeletonList rows={4} />
      ) : isLoading && activeTab !== 'recurring' && activeTab !== 'analytics' && activeTab !== 'ledger' ? (
        <SkeletonList rows={5} />
      ) : activeTab === 'transactions' ? (
        <TransactionsTab
          transactions={transactions}
          transactionsResponse={transactionsResponse}
          monthLabel={monthRange.label}
          accountById={accountById}
          displayCurrency={displayCurrency}
          currencyDisplayPreference={currencyDisplayPreference}
          getCategoryTheme={getCategoryTheme}
          onEdit={openTransactionModalForEdit}
          onDelete={deleteMutation.mutate}
          onPageChange={setTxOffset}
          isDeletePending={deleteMutation.isPending}
        />
      ) : activeTab === 'budgets' ? (
        <BudgetsTab
          budgets={budgets}
          budgetsResponse={budgetsResponse}
          monthLabel={monthRange.label}
          spentByCategory={spentByCategory}
          displayCurrency={displayCurrency}
          currencyDisplayPreference={currencyDisplayPreference}
          getCategoryTheme={getCategoryTheme}
          onEdit={openBudgetModalForEdit}
          onPageChange={setBudgetOffset}
        />
      ) : activeTab === 'recurring' ? (
        <RecurringTab
          recurringItems={recurringItems}
          recurringResponse={recurringResponse}
          displayCurrency={displayCurrency}
          currencyDisplayPreference={currencyDisplayPreference}
          getCategoryTheme={getCategoryTheme}
          onOpenNew={openRecurringModalForNew}
          onEdit={openRecurringModalForEdit}
          onRequestDeactivate={setRecurringPendingDeactivate}
          deactivateMutationPending={deactivateRecurringMutation.isPending}
          pendingDeactivate={recurringPendingDeactivate}
          onCancelDeactivate={() => setRecurringPendingDeactivate(null)}
          onConfirmDeactivate={confirmDeactivateRecurring}
          onPageChange={setRecurringOffset}
        />
      ) : activeTab === 'transfers' ? (
        <TransfersTab
          transferItems={transferItems}
          transfersResponse={transfersResponse}
          currencyDisplayPreference={currencyDisplayPreference}
          onEdit={openEditTransfer}
          onRequestDelete={(t) => { setDeletingTransfer(t); setDeleteTransferError(null); }}
          onPageChange={setTransferOffset}
        />
      ) : activeTab === 'analytics' ? (
        <AnalyticsTab
          selectedMonth={selectedMonth}
          displayCurrency={displayCurrency}
          currencyDisplayPreference={currencyDisplayPreference}
          getCategoryTheme={getCategoryTheme}
        />
      ) : activeTab === 'ledger' ? (
        <LedgerTab
          accounts={spendingAccounts}
          selectedAccountId={ledgerAccountId}
          onAccountChange={(id: string) => { setLedgerAccountId(id); setLedgerOffset(0); }}
          offset={ledgerOffset}
          limit={ledgerLimit}
          onOffsetChange={setLedgerOffset}
          currencyDisplayPreference={currencyDisplayPreference}
          fromDate={fromDate}
          toDate={toDate}
        />
      ) : null}

      {/* Recurring Modal */}
      {isRecurringModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={closeRecurringModal}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white">
                {editingRecurring ? 'Edit Recurring Rule' : 'New Recurring Rule'}
              </h3>
              <button
                onClick={closeRecurringModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecurringSubmit(handleSaveRecurring)} className="space-y-5 p-6">
              {(createRecurringMutation.isError || updateRecurringMutation.isError) && (
                <div className="rounded-xl border bg-red-500/10 border-red-500/50 p-3 text-sm text-red-400">
                  Failed to save recurring rule. Please check your inputs and try again.
                </div>
              )}

              {/* Category */}
              {!editingRecurring && (
                <div>
                  <Label className="mb-2 block">Category</Label>
                  <Controller
                    control={recurringControl}
                    name="categoryId"
                    render={({ field }) => (
                      <DropdownSelect
                        testId="spending-recurring-category"
                        value={field.value}
                        onChange={field.onChange}
                        options={categoryOptions}
                        placeholder="Select category"
                        showSearch
                        sortByLabel
                      />
                    )}
                  />
                  {recurringErrors.categoryId && (
                    <p className="mt-2 text-sm text-rose-400">{recurringErrors.categoryId.message}</p>
                  )}
                </div>
              )}

              {/* Type toggle (create only) */}
              {!editingRecurring && (
                <div>
                  <Label className="mb-2 block">Type</Label>
                  <Controller
                    control={recurringControl}
                    name="type"
                    render={({ field }) => (
                      <div className="flex gap-2 rounded-xl bg-slate-800/50 p-1 border border-slate-700/50">
                        <button
                          type="button"
                          onClick={() => field.onChange('expense')}
                          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                            field.value === 'expense' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Expense
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange('income')}
                          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                            field.value === 'income' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Income
                        </button>
                      </div>
                    )}
                  />
                </div>
              )}

              {/* Amount */}
              <div>
                <Label htmlFor="rec-amount" className="mb-2 block">Amount</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{displayCurrency}</span>
                  <Input
                    id="rec-amount"
                    data-testid="spending-recurring-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="pl-16"
                    placeholder="0.00"
                    {...registerRecurringField('amount')}
                  />
                </div>
                {recurringErrors.amount && (
                  <p className="mt-2 text-sm text-rose-400">{recurringErrors.amount.message}</p>
                )}
              </div>

              {/* Frequency + Interval row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rec-frequency" className="mb-2 block">Frequency</Label>
                  <Controller
                    control={recurringControl}
                    name="frequency"
                    render={({ field }) => (
                      <DropdownSelect
                        testId="spending-recurring-frequency"
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: 'daily', label: 'Daily' },
                          { value: 'weekly', label: 'Weekly' },
                          { value: 'monthly', label: 'Monthly' },
                          { value: 'yearly', label: 'Yearly' },
                        ]}
                        placeholder="Select frequency"
                      />
                    )}
                  />
                  {recurringErrors.frequency && (
                    <p className="mt-2 text-sm text-rose-400">{recurringErrors.frequency.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="rec-interval" className="mb-2 block">Every N</Label>
                  <Input
                    id="rec-interval"
                    data-testid="spending-recurring-interval"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1"
                    {...registerRecurringField('interval')}
                  />
                  {recurringErrors.interval && (
                    <p className="mt-2 text-sm text-rose-400">{recurringErrors.interval.message}</p>
                  )}
                </div>
              </div>

              {/* Monthly recurrence mode (spec-053) */}
              {recurringFrequencyWatch === 'monthly' && (
                <div className="space-y-3">
                  <div>
                    <Label className="mb-2 block">Monthly mode</Label>
                    <Controller
                      control={recurringControl}
                      name="monthly_mode"
                      render={({ field }) => (
                        <DropdownSelect
                          testId="spending-recurring-monthly-mode"
                          value={field.value ?? 'day_of_month'}
                          onChange={field.onChange}
                          options={[
                            { value: 'day_of_month', label: 'On day N' },
                            { value: 'last_day', label: 'On the last day' },
                            { value: 'nth_weekday', label: 'On the Nth weekday' },
                          ]}
                          placeholder="Select monthly mode"
                        />
                      )}
                    />
                  </div>
                  {isRecurringNthWeekdayMode && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-2 block">Occurrence</Label>
                        <Controller
                          control={recurringControl}
                          name="by_ordinal"
                          render={({ field }) => (
                            <DropdownSelect
                              testId="spending-recurring-ordinal"
                              value={field.value ?? '1'}
                              onChange={field.onChange}
                              options={[
                                { value: '1', label: 'First' },
                                { value: '2', label: 'Second' },
                                { value: '3', label: 'Third' },
                                { value: '4', label: 'Fourth' },
                                { value: '-1', label: 'Last' },
                              ]}
                              placeholder="Occurrence"
                            />
                          )}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Weekday</Label>
                        <Controller
                          control={recurringControl}
                          name="by_weekday"
                          render={({ field }) => (
                            <DropdownSelect
                              testId="spending-recurring-weekday"
                              value={field.value ?? '0'}
                              onChange={field.onChange}
                              options={[
                                { value: '0', label: 'Monday' },
                                { value: '1', label: 'Tuesday' },
                                { value: '2', label: 'Wednesday' },
                                { value: '3', label: 'Thursday' },
                                { value: '4', label: 'Friday' },
                                { value: '5', label: 'Saturday' },
                                { value: '6', label: 'Sunday' },
                              ]}
                              placeholder="Weekday"
                            />
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Start date (create only) */}
              {!editingRecurring && (
                <div>
                  <Label htmlFor="rec-anchor" className="mb-2 block">Start Date</Label>
                  <Controller
                    control={recurringControl}
                    name="anchor_date"
                    render={({ field }) => (
                      <DatePicker
                        testId="spending-recurring-anchor-date"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select start date"
                        required
                      />
                    )}
                  />
                  {recurringErrors.anchor_date && (
                    <p className="mt-2 text-sm text-rose-400">{recurringErrors.anchor_date.message}</p>
                  )}
                </div>
              )}

              {/* End date (optional) */}
              <div>
                <Label htmlFor="rec-end" className="mb-2 block">End Date <span className="text-slate-500">(optional)</span></Label>
                <Controller
                  control={recurringControl}
                  name="end_date"
                  render={({ field }) => (
                    <DatePicker
                      testId="spending-recurring-end-date"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Select end date"
                    />
                  )}
                />
                {recurringErrors.end_date && (
                  <p className="mt-2 text-sm text-rose-400">{recurringErrors.end_date.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="rec-desc" className="mb-2 block">Description <span className="text-slate-500">(optional)</span></Label>
                <Input
                  id="rec-desc"
                  data-testid="spending-recurring-description"
                  placeholder="e.g. Netflix subscription"
                  {...registerRecurringField('description')}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRecurringModal}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid={editingRecurring ? 'spending-recurring-update' : 'spending-recurring-create'}
                  disabled={createRecurringMutation.isPending || updateRecurringMutation.isPending}
                  className="flex-1 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-500 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {(createRecurringMutation.isPending || updateRecurringMutation.isPending)
                    ? 'Saving...'
                    : editingRecurring ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
            onClick={closeTransactionModal}
          />
          
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white">
                {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
              </h3>
              <button 
                onClick={closeTransactionModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveTransaction} className="p-6">
              <div className="space-y-5">
                {/* Type Selection */}
                <div className="flex gap-2 rounded-xl bg-slate-800/50 p-1 border border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${type === 'expense' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${type === 'income' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Income
                  </button>
                </div>
                
                {/* Amount */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{displayCurrency}</span>
                    <Input
                      data-testid="spending-transaction-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-16"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Category</label>
                  <DropdownSelect
                    testId="spending-transaction-category"
                    value={categoryId}
                    onChange={setCategoryId}
                    options={categoryOptions}
                    placeholder="Select category"
                    showSearch
                    sortByLabel
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Wallet / Account{editingTransaction ? ' (Optional)' : ''}
                  </label>
                  <DropdownSelect
                    testId="spending-transaction-account"
                    value={accountId}
                    onChange={setAccountId}
                    options={accountOptions}
                    placeholder={editingTransaction ? 'Unassigned' : 'Select account'}
                    clearLabel={editingTransaction ? 'Unassigned' : undefined}
                    showSearch
                    sortByLabel
                  />
                  {!editingTransaction && !accountId && (
                    <p
                      data-testid="spending-transaction-account-error"
                      className="mt-2 text-sm text-rose-400"
                    >
                      Every transaction needs an account. Pick one above, or set a{' '}
                      <Link to="/settings" className="underline hover:text-rose-300">
                        default spending account
                      </Link>{' '}
                      in Finance Settings.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNewAccountCurrency(displayCurrency || 'USD');
                      setIsQuickAccountModalOpen(true);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300"
                  >
                    <Landmark className="h-3.5 w-3.5" />
                    Create account
                  </button>
                </div>

                {/* Date */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Date</label>
                  <DatePicker
                    testId="spending-transaction-date"
                    value={date}
                    onChange={setDate}
                    placeholder="Select date"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Description (Optional)</label>
                  <Input
                    data-testid="spending-transaction-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What did you spend on?"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={closeTransactionModal}
                  className="flex-1 rounded-xl bg-slate-800 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="spending-transaction-save"
                  disabled={
                    (createMutation.isPending || updateMutation.isPending) ||
                    !amount ||
                    !categoryId ||
                    !type ||
                    !date ||
                    (!editingTransaction && !accountId)
                  }
                  className="flex-1 rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-500 hover:shadow-cyan-500/40 disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
            onClick={closeBudgetModal}
          />
          
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white">{editingBudgetId ? 'Edit Budget' : 'Set Budget'}</h3>
              <button 
                onClick={closeBudgetModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleBudgetSubmit(handleSaveBudget)} className="p-6">
              {(createBudgetMutation.isError || updateBudgetMutation.isError) && (
                <div className="mb-4 rounded-xl relative border bg-red-500/10 border-red-500/50 p-3 text-sm text-red-500 font-medium">
                  <p>
                    {createBudgetMutation.isError 
                      ? "Failed to create budget. You may already have a budget for this category and month."
                      : "Failed to update budget. Please try again."
                    }
                  </p>
                </div>
              )}
              <div className="space-y-5">
                {/* Category */}
                <div>
                  <Label className="mb-2 block">Category</Label>
                  <Controller
                    control={budgetControl}
                    name="categoryId"
                    render={({ field }) => (
                      <DropdownSelect
                        testId="spending-budget-category"
                        value={field.value}
                        onChange={field.onChange}
                        options={categoryOptions}
                        placeholder="Select category"
                        disabled={!!editingBudgetId}
                        showSearch
                        sortByLabel
                      />
                    )}
                  />
                  {budgetErrors.categoryId ? (
                    <p className="mt-2 text-sm text-rose-400">{budgetErrors.categoryId.message}</p>
                  ) : null}
                </div>

                {/* Budget Month */}
                <div>
                  <Label htmlFor="budget-month" className="mb-2 block">Budget Month</Label>
                  <Controller
                    control={budgetControl}
                    name="month"
                    render={({ field }) => (
                      <DropdownSelect
                        id="budget-month"
                        value={field.value}
                        onChange={field.onChange}
                        options={monthFilterOptions}
                        placeholder="Select month"
                        disabled={!!editingBudgetId}
                      />
                    )}
                  />
                  {budgetErrors.month ? (
                    <p className="mt-2 text-sm text-rose-400">{budgetErrors.month.message}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">We store this as the 1st day of the selected month.</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <Label htmlFor="budget-amount" className="mb-2 block">Budget Limit</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{displayCurrency}</span>
                    <Input
                      id="budget-amount"
                      data-testid="spending-budget-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      className="pl-16"
                      placeholder="0.00"
                      {...registerBudgetField('amount')}
                    />
                  </div>
                  {budgetErrors.amount ? (
                    <p className="mt-2 text-sm text-rose-400">{budgetErrors.amount.message}</p>
                  ) : null}
                </div>

              </div>

              <div className="mt-8 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={closeBudgetModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  data-testid="spending-budget-save"
                  className="flex-1"
                  disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
                >
                  {(createBudgetMutation.isPending || updateBudgetMutation.isPending) ? 'Saving...' : 'Save Budget'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}



      {isQuickAccountModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsQuickAccountModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white">Create Wallet / Account</h3>
              <button
                onClick={() => setIsQuickAccountModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="space-y-4 p-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (createAccountMutation.isPending || !newAccountName.trim()) return;
                createAccountMutation.mutate();
              }}
            >
              <div>
                <Label className="mb-2 block">Account Name</Label>
                <Input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g. Main Wallet"
                />
              </div>
              <div>
                <Label className="mb-2 block">Type</Label>
                <DropdownSelect
                  value={newAccountType}
                  onChange={(value) => setNewAccountType(value as 'bank' | 'wallet' | 'card' | 'gift_card')}
                  options={accountTypeOptions}
                  placeholder="Select account type"
                />
              </div>
              <div>
                <Label className="mb-2 block">Default Currency</Label>
                <Input
                  value={newAccountCurrency}
                  onChange={(e) => setNewAccountCurrency(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                  placeholder="USD"
                  maxLength={3}
                />
              </div>
              {createAccountMutation.isError ? (
                <p className="text-sm text-rose-400">
                  Failed to create account. Check fields and try again.
                </p>
              ) : null}
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setIsQuickAccountModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createAccountMutation.isPending || !newAccountName.trim() || newAccountCurrency.trim().length !== 3}
                >
                  {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={() => setIsTransferModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white">Transfer Between Wallets/Accounts</h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="space-y-4 p-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (!transferFromAccountId || !transferToAccountId || !transferAmount) return;
                createTransferMutation.mutate();
              }}
            >
              <div>
                <Label className="mb-2 block">From</Label>
                <DropdownSelect value={transferFromAccountId} onChange={setTransferFromAccountId} options={transferAccountOptions} placeholder="Select source account" showSearch sortByLabel />
              </div>
              <div>
                <Label className="mb-2 block">To</Label>
                <DropdownSelect value={transferToAccountId} onChange={setTransferToAccountId} options={transferAccountOptions} placeholder="Select destination account" showSearch sortByLabel />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setNewAccountCurrency(displayCurrency || 'USD');
                    setIsQuickAccountModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  <Landmark className="h-3.5 w-3.5" />
                  Need another account? Create one now
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-2 block">Amount</Label>
                  <Input type="number" min="0.01" step="0.01" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0.00" required />
                </div>
                <div>
                  <Label className="mb-2 block">Date</Label>
                  <DatePicker value={transferDate} onChange={setTransferDate} required />
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div>
                  <Label className="mb-2 block">FX Rate (optional)</Label>
                  <Input type="number" min="0" step="0.0000000001" value={transferFxRate} onChange={(e) => setTransferFxRate(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">FX Fee</Label>
                  <Input type="number" min="0" step="0.01" value={transferFxFee} onChange={(e) => setTransferFxFee(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">Platform Fee</Label>
                  <Input type="number" min="0" step="0.01" value={transferPlatformFee} onChange={(e) => setTransferPlatformFee(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">Tax</Label>
                  <Input type="number" min="0" step="0.01" value={transferTax} onChange={(e) => setTransferTax(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Same-currency transfer: FX rate can be empty. Cross-currency transfer: provide FX rate and optional fee/tax charges.
              </p>
              <div>
                <Label className="mb-2 block">Notes (optional)</Label>
                <Input value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} placeholder="e.g. Top-up to wallet" />
              </div>
              <div className="mt-6 flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsTransferModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={
                    createTransferMutation.isPending ||
                    !transferFromAccountId ||
                    !transferToAccountId ||
                    !transferAmount ||
                    transferFromAccountId === transferToAccountId
                  }
                >
                  {createTransferMutation.isPending ? 'Transferring...' : 'Create Transfer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transfer Modal */}
      {editingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={() => setEditingTransfer(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">Edit Transfer</h3>
              <button onClick={() => setEditingTransfer(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="space-y-4 p-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editTransferFromId || !editTransferToId) {
                  setEditTransferError('Both From and To accounts must be selected.');
                  return;
                }
                if (editTransferFromId === editTransferToId) {
                  setEditTransferError('Source and destination accounts cannot be the same.');
                  return;
                }
                if (updateTransferMutation.isPending) return;
                setEditTransferError(null);
                updateTransferMutation.mutate();
              }}
            >
              {editTransferError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{editTransferError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs mb-1 block">From Account</Label>
                  <DropdownSelect
                    options={transferAccountOptions}
                    value={editTransferFromId}
                    onChange={setEditTransferFromId}
                    placeholder="From account"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs mb-1 block">To Account</Label>
                  <DropdownSelect
                    options={transferAccountOptions}
                    value={editTransferToId}
                    onChange={setEditTransferToId}
                    placeholder="To account"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs mb-1 block">Gross Amount</Label>
                  <Input type="number" min="0" step="0.01" value={editTransferGross} onChange={(e) => setEditTransferGross(e.target.value)} placeholder="1000.00" className="bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs mb-1 block">Net Received</Label>
                  <Input type="number" min="0" step="0.01" value={editTransferNet} onChange={(e) => setEditTransferNet(e.target.value)} placeholder="950.00" className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs mb-1 block">FX Rate</Label>
                  <Input type="number" min="0" step="any" value={editTransferFxRate} onChange={(e) => setEditTransferFxRate(e.target.value)} placeholder="optional" className="bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs mb-1 block">FX Fee</Label>
                  <Input type="number" min="0" step="0.01" value={editTransferFxFee} onChange={(e) => setEditTransferFxFee(e.target.value)} placeholder="0" className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs mb-1 block">Platform Fee</Label>
                  <Input type="number" min="0" step="0.01" value={editTransferPlatformFee} onChange={(e) => setEditTransferPlatformFee(e.target.value)} placeholder="0" className="bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs mb-1 block">Tax</Label>
                  <Input type="number" min="0" step="0.01" value={editTransferTax} onChange={(e) => setEditTransferTax(e.target.value)} placeholder="0" className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Date</Label>
                <DatePicker value={editTransferDate} onChange={setEditTransferDate} required />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Notes</Label>
                <Input value={editTransferNotes} onChange={(e) => setEditTransferNotes(e.target.value)} placeholder="optional" className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditingTransfer(null)}>Cancel</Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={
                    updateTransferMutation.isPending ||
                    !editTransferFromId ||
                    !editTransferToId ||
                    editTransferFromId === editTransferToId
                  }
                >
                  {updateTransferMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Transfer Confirmation */}
      {deletingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={() => setDeletingTransfer(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-500/10 p-2.5">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Delete Transfer</h3>
                  <p className="text-sm text-slate-400">This action cannot be undone.</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-sm text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Flow</span>
                  <span>{deletingTransfer.from_account_name ?? '?'} → {deletingTransfer.to_account_name ?? '?'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date</span>
                  <span>
                    {formatDate(deletingTransfer.occurred_at, { fallback: 'N/A' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Net received</span>
                  <span>{formatCurrency(Number(deletingTransfer.net_amount_received), deletingTransfer.to_currency_code, currencyDisplayPreference)}</span>
                </div>
              </div>
              {deleteTransferError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{deleteTransferError}</span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setDeletingTransfer(null)}>Cancel</Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={deleteTransferMutation.isPending}
                  onClick={() => deleteTransferMutation.mutate()}
                >
                  {deleteTransferMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isManageCategoriesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsManageCategoriesOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">Manage Categories</h3>
              <button
                onClick={() => setIsManageCategoriesOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="space-y-4 p-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (createCategoryMutation.isPending || !newCategoryName.trim()) return;
                createCategoryMutation.mutate({ name: newCategoryName.trim(), icon: newCategoryIcon.trim() || undefined });
              }}
            >
              <div>
                <Label className="mb-2 block">Category Name</Label>
                <Input
                  data-testid="spending-category-name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Dining Out"
                />
              </div>
              <div>
                <Label className="mb-2 block">Icon (emoji)</Label>
                <Input
                  data-testid="spending-category-icon"
                  value={newCategoryIcon}
                  onChange={(e) => setNewCategoryIcon(e.target.value)}
                  placeholder="🍔"
                />
              </div>
              {createCategoryMutation.isError ? (
                <p className="text-sm text-rose-400">Failed to create category. Please try again.</p>
              ) : null}
              <button
                data-testid="spending-category-create"
                type="submit"
                disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
                className="w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
              </button>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
};
