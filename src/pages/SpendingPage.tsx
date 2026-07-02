import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SkeletonList } from '../components/ui/FeedbackStates';
import { spendingService } from '../services/spending';
import { financeService } from '../services/finance';
import type {
  Budget,
  BudgetCreate,
  BudgetUpdate,
  LedgerEntry,
  RecurringTransaction,
  RecurringTransactionCreate,
  RecurringTransactionUpdate,
  RecurringFrequency,
  Transaction,
  TransactionCreate,
  TransactionType,
  TransactionUpdate,
} from '../types/spending';
import type { ReconciliationSummary } from '../types/finance';

import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Plus, 
  Trash2, 
  Tag,
  Calendar,
  X,
  Target,
  Edit2,
  RefreshCw,
  Clock,
  ToggleLeft,
  ArrowRightLeft,
  Landmark,
  TrendingUp,
  BarChart2,
  PieChart,
  Percent,
  PiggyBank,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { DropdownSelect } from '../components/DropdownSelect';
import { DatePicker } from '../components/DatePicker';
import { DateRangePicker } from '../components/DateRangePicker';
import { CompactFilterBar, CompactFilterField } from '../components/filters/CompactFilterBar';
import { AccountTypeBadge, CurrencyBadge } from '../components/finance/Badges';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatCurrency } from '../utils/numberFormat';
import { formatDate, formatMonthYear } from '../utils/dateFormat';

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

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const localDateInputValue = () => new Date().toLocaleDateString('en-CA');

const formatDueDate = (dateStr: string) => {
  if (!dateStr) return { label: 'N/A', color: 'text-slate-400 bg-slate-800' };
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return { label: 'N/A', color: 'text-slate-400 bg-slate-800' };
  const [year, month, day] = parts.map(Number);
  const due = new Date(year, month - 1, day);
  if (Number.isNaN(due.getTime())) return { label: 'N/A', color: 'text-slate-400 bg-slate-800' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-400 bg-red-500/10' };
  if (diffDays === 0) return { label: 'Due today', color: 'text-amber-400 bg-amber-500/10' };
  if (diffDays === 1) return { label: 'Due tomorrow', color: 'text-amber-400 bg-amber-500/10' };
  return { label: `Due in ${diffDays}d`, color: 'text-slate-400 bg-slate-800' };
};

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabelFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const formatMonthLabel = (monthValue: string) => {
  if (!/^\d{4}-\d{2}$/.test(monthValue)) return monthValue;
  const [yearStr, monthStr] = monthValue.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || month < 1 || month > 12) return monthValue;
  return monthLabelFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
};

const buildMonthOptions = (pastCount = 24, futureCount = 12) => {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let offset = futureCount; offset >= -pastCount; offset -= 1) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const value = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: formatMonthLabel(value) });
  }
  return options;
};

const monthStartToMonthValue = (monthStart: string) => monthStart.slice(0, 7);

const monthValueToDateRange = (monthValue: string) => {
  if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) {
    return {
      fromDate: '',
      toDate: '',
      monthStart: '',
      label: 'Invalid Month',
      isValid: false,
    };
  }

  const [yearStr, monthStr] = monthValue.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return {
    fromDate: start.toISOString(),
    toDate: end.toISOString(),
    monthStart: `${monthValue}-01`,
    label: formatMonthYear(start, { long: true }),
    isValid: true,
  };
};

export const SpendingPage: React.FC = () => {
  const queryClient = useQueryClient();
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
    queryKey: ['categories'],
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

  const { data: transactionsResponse, isLoading: isTxLoading } = useQuery({
    queryKey: ['transactions', txOffset, fromDate, toDate, selectedCategoryFilter, selectedAccountFilter],
    queryFn: () => spendingService.getTransactions(limit, txOffset, {
      categoryId: selectedCategoryFilter || undefined,
      accountId: selectedAccountFilter || undefined,
      fromDate: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
      toDate: toDate ? `${toDate}T23:59:59.999Z` : undefined,
    }),
  });
  const transactions = transactionsResponse?.items;

  const { data: summaryResponse, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['transactions-summary', fromDate, toDate, selectedCategoryFilter, selectedAccountFilter],
    queryFn: () => spendingService.getTransactionSummary({
      fromDate: fromDate ? `${fromDate}T00:00:00.000Z` : `${new Date().getFullYear()}-01-01T00:00:00.000Z`,
      toDate: toDate ? `${toDate}T23:59:59.999Z` : `${new Date().getFullYear()}-12-31T23:59:59.999Z`,
      categoryId: selectedCategoryFilter || undefined,
      accountId: selectedAccountFilter || undefined,
    }),
  });

  const { data: budgetsResponse, isLoading: isBudgetsLoading } = useQuery({
    queryKey: ['budgets', budgetOffset, selectedMonth],
    queryFn: () => spendingService.getBudgets(limit, budgetOffset, monthRange.monthStart),
    enabled: monthRange.isValid,
  });
  const budgets = useMemo(
    () => budgetsResponse?.items.filter((budget) => monthStartToMonthValue(budget.month_start) === selectedMonth) ?? [],
    [budgetsResponse, selectedMonth]
  );

  const createMutation = useMutation({
    mutationFn: (newTx: TransactionCreate) => spendingService.createTransaction(newTx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      closeTransactionModal();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionUpdate }) => spendingService.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      closeTransactionModal();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => spendingService.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });



  const createBudgetMutation = useMutation({
    mutationFn: (newBudget: BudgetCreate) => spendingService.createBudget(newBudget),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      closeBudgetModal();
    }
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: BudgetUpdate }) => spendingService.updateBudget(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      closeBudgetModal();
    }
  });

  // ----- Recurring Queries & Mutations -----
  const { data: recurringResponse, isLoading: isRecurringLoading } = useQuery({
    queryKey: ['recurring', recurringOffset],
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
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: (data: RecurringTransactionCreate) => spendingService.createRecurring(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      closeRecurringModal();
    },
  });

  const updateRecurringMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecurringTransactionUpdate }) =>
      spendingService.updateRecurring(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      closeRecurringModal();
    },
  });

  const deactivateRecurringMutation = useMutation({
    mutationFn: (id: string) => spendingService.deleteRecurring(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
    onError: (error) => {
      console.error('Failed to deactivate recurring rule:', error);
      alert('Failed to deactivate recurring rule. Please try again.');
    },
  });
  const createTransferMutation = useMutation({
    mutationFn: () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'transfers'] });
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
  });

  const updateTransferMutation = useMutation({
    mutationFn: () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditingTransfer(null);
      setEditTransferError(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to update transfer');
      setEditTransferError(msg);
    },
  });

  const deleteTransferMutation = useMutation({
    mutationFn: () => {
      if (!deletingTransfer) throw new Error('No transfer selected');
      return financeService.deleteTransfer(deletingTransfer.public_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeletingTransfer(null);
      setDeleteTransferError(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to delete transfer');
      setDeleteTransferError(msg);
    },
  });

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

  const createAccountMutation = useMutation({
    mutationFn: () =>
      financeService.createAccount({
        name: newAccountName.trim(),
        account_type: newAccountType,
        default_currency_code: newAccountCurrency.trim().toUpperCase(),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'accounts', 'spending'] });
      setAccountId(created.public_id);
      if (!transferFromAccountId) setTransferFromAccountId(created.public_id);
      setNewAccountName('');
      setNewAccountType('wallet');
      setNewAccountCurrency(created.default_currency_code);
      setIsQuickAccountModalOpen(false);
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; icon?: string }) =>
      spendingService.createCategory({ name: data.name, icon: data.icon || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewCategoryName('');
      setNewCategoryIcon('');
      setIsManageCategoriesOpen(false);
    },
  });

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !type || !date) return;
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
    setAccountId('');
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
    if (editingRecurring) {
      const update: RecurringTransactionUpdate = {
        amount: parseFloat(values.amount),
        description: values.description || null,
        frequency: values.frequency as RecurringFrequency,
        interval: parseInt(values.interval, 10),
        end_date: values.end_date || null,
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
            options={accountOptions}
            placeholder="All accounts"
            clearLabel="All accounts"
            showSearch
            sortByLabel
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
        <div className="space-y-4 animate-in fade-in duration-300">
          <h3 className="text-xl font-semibold text-white">Transactions in {monthRange.label}</h3>
          {transactions?.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
              <div className="mb-4 rounded-full bg-slate-800 p-4">
                <Wallet className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-white">No transactions yet</h3>
              <p className="text-slate-400">Start tracking your spending by adding a new transaction.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
              <table className="w-full text-left text-sm text-slate-300 min-w-[1000px]">
                <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Category</th>
                    <th className="px-6 py-4 font-medium">Details</th>
                    <th className="px-6 py-4 font-medium">Source</th>
                    <th className="px-6 py-4 font-medium">Tags</th>
                    <th className="px-6 py-4 text-right font-medium">Amount (Original)</th>
                    <th className="px-6 py-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {transactions?.map((tx) => {
                    const catTheme = getCategoryTheme(tx.category_id);
                    const isIncome = tx.type === 'income';
                    const dateObj = new Date(tx.occurred_at);
                    const linkedAccount = tx.account_id ? accountById.get(tx.account_id) : undefined;
                    const sourceName = tx.wallet_name || linkedAccount?.name || '-';
                    const sourceType = linkedAccount?.account_type
                      ? linkedAccount.account_type.replace('_', ' ')
                      : tx.wallet_name
                        ? 'wallet'
                        : null;
                    const sourceCurrency = linkedAccount?.default_currency_code ?? displayCurrency;
                    const sourceMetadata = tx.source_metadata;
                    
                    return (
                      <tr key={tx.public_id} className="group transition-colors hover:bg-slate-700/30">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            {formatDate(dateObj)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span 
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{ backgroundColor: `${catTheme.color}20`, color: catTheme.color }}
                          >
                            {catTheme.icon && <span>{catTheme.icon}</span>}
                            {!catTheme.icon && <Tag className="h-3 w-3" />}
                            {catTheme.name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="max-w-[240px] truncate text-slate-200">{tx.description || '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            <span className="inline-flex max-w-[180px] truncate rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-200">
                              {sourceName}
                            </span>
                            {sourceType ? <AccountTypeBadge type={sourceType} /> : null}
                            <CurrencyBadge code={sourceCurrency} />
                            {sourceMetadata ? (
                              <span
                                data-testid={`transaction-source-metadata-${tx.public_id}`}
                                title={
                                  sourceMetadata.rollback_supported && sourceMetadata.import_row_number
                                    ? `${sourceMetadata.label}, row ${sourceMetadata.import_row_number}`
                                    : sourceMetadata.label
                                }
                                className="rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-300"
                              >
                                {sourceMetadata.origin === 'bulk_import'
                                  ? `Imported${sourceMetadata.import_row_number ? ` #${sourceMetadata.import_row_number}` : ''}`
                                  : sourceMetadata.label}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {tx.labels ? (
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              {tx.labels
                                .split(',')
                                .map((label) => label.trim())
                                .filter(Boolean)
                                .slice(0, 3)
                                .map((label, index) => (
                                  <span
                                    key={`${tx.public_id}-${label}-${index}`}
                                    className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                                  >
                                    {label}
                                  </span>
                                ))}
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-semibold ${isIncome ? 'text-emerald-400' : 'text-slate-200'}`}>
                              {isIncome ? '+' : '-'}{formatCurrency(parseFloat(tx.amount.toString()), sourceCurrency, currencyDisplayPreference)}
                            </span>
                            {sourceCurrency !== displayCurrency ? (
                              <span
                                title={`Reporting currency is ${displayCurrency}. This row keeps source currency ${sourceCurrency}.`}
                                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300"
                              >
                                Report {displayCurrency}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openTransactionModalForEdit(tx)}
                            className="inline-flex rounded-lg p-2 text-slate-500 transition-all hover:bg-cyan-500/10 hover:text-cyan-400"
                            title="Edit transaction"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(tx.public_id)}
                            className="ml-2 inline-flex rounded-lg p-2 text-slate-500 transition-all hover:bg-red-500/10 hover:text-red-400"
                            title="Delete transaction"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {transactionsResponse && (
            <Pagination 
              total={transactionsResponse.total} 
              limit={transactionsResponse.limit} 
              offset={transactionsResponse.offset} 
              onPageChange={setTxOffset} 
            />
          )}
        </div>
      ) : activeTab === 'budgets' ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h3 className="text-xl font-semibold text-white">Category Budgets for {monthRange.label}</h3>
          {budgets?.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
              <div className="mb-4 rounded-full bg-slate-800 p-4">
                <Target className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-white">No budgets set</h3>
              <p className="text-slate-400">Set a budget to track your limits.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {budgets?.map((b) => {
                const catTheme = getCategoryTheme(b.category_id);
                const spent = spentByCategory.get(b.category_id) ?? 0;
                
                const bAmount = parseFloat(b.amount.toString());
                const progress = Math.min(100, Math.max(0, (spent / bAmount) * 100));
                
                return (
                  <div key={b.public_id} className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 transition-all hover:border-slate-600">
                    <div className="mb-4 flex items-center justify-between">
                      <span 
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ backgroundColor: `${catTheme.color}20`, color: catTheme.color }}
                      >
                        {catTheme.icon && <span>{catTheme.icon}</span>}
                        {!catTheme.icon && <Tag className="h-3 w-3" />}
                        {catTheme.name}
                      </span>
                      <button
                        onClick={() => openBudgetModalForEdit(b)}
                        className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300"
                        title="Edit Budget"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="mb-1 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-slate-400">Spent ({monthStartToMonthValue(b.month_start)})</p>
                        <p className="text-lg font-bold text-white">{formatCurrency(spent, displayCurrency, currencyDisplayPreference)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Budget</p>
                        <p className="font-semibold text-slate-300">{formatCurrency(bAmount, displayCurrency, currencyDisplayPreference)}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-900/50">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-red-500' : progress > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {budgetsResponse && (
            <Pagination
              total={budgetsResponse.total}
              limit={budgetsResponse.limit}
              offset={budgetsResponse.offset}
              onPageChange={setBudgetOffset}
            />
          )}
        </div>
      ) : activeTab === 'recurring' ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h3 className="text-xl font-semibold text-white">Recurring Rules</h3>
          {recurringItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
              <div className="mb-4 rounded-full bg-slate-800 p-4">
                <RefreshCw className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-white">No recurring rules yet</h3>
              <p className="text-slate-400">Set up recurring transactions for rent, subscriptions, or salary.</p>
              <button
                onClick={openRecurringModalForNew}
                className="mt-6 flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-cyan-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add First Rule
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recurringItems.map((r) => {
                const catTheme = getCategoryTheme(r.category_id);
                const isIncome = r.type === 'income';
                const dueInfo = formatDueDate(r.next_due_date);
                return (
                  <div
                    key={r.public_id}
                    data-testid={`spending-recurring-rule-${r.public_id}`}
                    className="group flex flex-col gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 backdrop-blur-sm transition-all hover:border-slate-600 hover:bg-slate-800/60"
                  >
                    {/* Category + Type row */}
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ backgroundColor: `${catTheme.color}20`, color: catTheme.color }}
                      >
                        {catTheme.icon ? <span>{catTheme.icon}</span> : <Tag className="h-3 w-3" />}
                        {catTheme.name}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isIncome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {isIncome ? 'Income' : 'Expense'}
                      </span>
                    </div>

                    {/* Amount */}
                    <div>
                      <p
                        className={`text-2xl font-bold ${
                          isIncome ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {isIncome ? '+' : '-'}{formatCurrency(Number(r.amount), displayCurrency, currencyDisplayPreference)}
                      </p>
                      {r.description && (
                        <p className="mt-0.5 text-sm text-slate-400 truncate">{r.description}</p>
                      )}
                    </div>

                    {/* Frequency + Next due */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <RefreshCw className="h-3.5 w-3.5" />
                        {FREQUENCY_LABELS[r.frequency as RecurringFrequency] ?? r.frequency} · Every {r.interval}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dueInfo.color}`}>
                        {dueInfo.label}
                      </span>
                    </div>

                    {/* Last generated */}
                    {r.last_generated_at && !Number.isNaN(Date.parse(r.last_generated_at)) && (
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        Last generated {formatDate(r.last_generated_at)}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 border-t border-slate-700/50 pt-3">
                      <button
                        data-testid={`spending-recurring-edit-${r.public_id}`}
                        onClick={() => openRecurringModalForEdit(r)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        data-testid="spending-recurring-deactivate"
                        onClick={() =>
                          setRecurringPendingDeactivate({
                            publicId: r.public_id,
                            description: r.description || 'this recurring rule',
                          })
                        }
                        disabled={deactivateRecurringMutation.isPending}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Deactivate this rule"
                      >
                        <ToggleLeft className="h-3.5 w-3.5" /> Deactivate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {recurringResponse && (
            <Pagination
              total={recurringResponse.total}
              limit={recurringResponse.limit}
              offset={recurringResponse.offset}
              onPageChange={setRecurringOffset}
            />
          )}
          <Dialog
            open={!!recurringPendingDeactivate}
            onOpenChange={(open) => !open && setRecurringPendingDeactivate(null)}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Deactivate recurring rule?</DialogTitle>
                <DialogDescription>
                  {recurringPendingDeactivate
                    ? `Deactivate "${recurringPendingDeactivate.description}"? Future recurring transactions will stop generating.`
                    : 'Future recurring transactions will stop generating.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setRecurringPendingDeactivate(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-rose-300 hover:text-rose-200"
                  onClick={confirmDeactivateRecurring}
                  disabled={deactivateRecurringMutation.isPending}
                >
                  {deactivateRecurringMutation.isPending ? 'Deactivating...' : 'Deactivate rule'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : activeTab === 'transfers' ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h3 className="text-xl font-semibold text-white">Transfer History</h3>
          {transferItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
              <div className="mb-4 rounded-full bg-slate-800 p-4">
                <ArrowRightLeft className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-white">No transfers yet</h3>
              <p className="text-slate-400">Create an account-to-account transfer from the Transfer button above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
              <table className="w-full text-left text-sm text-slate-300 min-w-[700px]">
                <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Flow</th>
                    <th className="px-6 py-4 text-right font-medium">Gross</th>
                    <th className="px-6 py-4 text-right font-medium">Net</th>
                    <th className="px-6 py-4 font-medium">Notes</th>
                    <th className="px-6 py-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {transferItems.map((t) => (
                    <tr key={t.public_id} className="transition-colors hover:bg-slate-700/30">
                      <td className="whitespace-nowrap px-6 py-4">
                        {formatDate(t.occurred_at, { fallback: 'N/A' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex max-w-[160px] truncate rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-200">
                              {t.from_account_name ?? `Account #${t.from_account_id}`}
                            </span>
                            {t.from_account_type ? <AccountTypeBadge type={t.from_account_type} /> : null}
                            <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                              {t.from_module}
                            </span>
                            <span className="text-slate-500">→</span>
                            <span className="inline-flex max-w-[160px] truncate rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-200">
                              {t.to_account_name ?? `Account #${t.to_account_id}`}
                            </span>
                            {t.to_account_type ? <AccountTypeBadge type={t.to_account_type} /> : null}
                            <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                              {t.to_module}
                            </span>
                          </div>
                          {t.fx_rate_used ? (
                            <div className="flex flex-wrap gap-1">
                              <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300">
                                FX {t.fx_rate_used}
                              </span>
                              {(Number(t.fx_fee_amount) > 0 || Number(t.platform_fee_amount) > 0 || Number(t.tax_amount) > 0) ? (
                                <span
                                  title={`FX fee ${t.fx_fee_amount}, platform fee ${t.platform_fee_amount}, tax ${t.tax_amount}`}
                                  className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                                >
                                  Fees metadata
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {formatCurrency(Number(t.gross_amount), t.from_currency_code, currencyDisplayPreference)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {formatCurrency(Number(t.net_amount_received), t.to_currency_code, currencyDisplayPreference)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="truncate max-w-[280px] text-slate-400">{t.notes || '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditTransfer(t)}
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                            title="Edit transfer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setDeletingTransfer(t); setDeleteTransferError(null); }}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-900/40 hover:text-red-400 transition-colors"
                            title="Delete transfer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {transfersResponse && (
            <Pagination
              total={transfersResponse.total}
              limit={transfersResponse.limit}
              offset={transfersResponse.offset}
              onPageChange={setTransferOffset}
            />
          )}
        </div>
      ) : activeTab === 'analytics' ? (
        <SpendingAnalyticsTab
          selectedMonth={selectedMonth}
          displayCurrency={displayCurrency}
          currencyDisplayPreference={currencyDisplayPreference}
          getCategoryTheme={getCategoryTheme}
        />
      ) : activeTab === 'ledger' ? (
        <SpendingLedgerTab
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
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-900 z-10">
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
          
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
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
                  <label className="mb-2 block text-sm font-medium text-slate-300">Wallet / Account (Optional)</label>
                  <DropdownSelect
                    testId="spending-transaction-account"
                    value={accountId}
                    onChange={setAccountId}
                    options={accountOptions}
                    placeholder="Unassigned"
                    clearLabel="Unassigned"
                    showSearch
                    sortByLabel
                  />
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
                  disabled={(createMutation.isPending || updateMutation.isPending) || !amount || !categoryId || !type || !date}
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
          
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
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
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
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
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
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
              <div className="grid gap-3 sm:grid-cols-3">
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

interface SpendingAnalyticsTabProps {
  selectedMonth: string;
  displayCurrency: string;
  currencyDisplayPreference: 'symbol' | 'code';
  getCategoryTheme: (catId: string) => { name: string; color: string; icon: string | null };
}

const SpendingAnalyticsTab: React.FC<SpendingAnalyticsTabProps> = ({
  selectedMonth,
  displayCurrency,
  currencyDisplayPreference,
  getCategoryTheme,
}) => {
  const [rangeMonths, setRangeMonths] = useState(6);
  const [breakdownType, setBreakdownType] = useState<'income' | 'expense'>('expense');

  // Calculate the dates range for queries
  const analyticsRange = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) {
      return { fromMonth: selectedMonth, toMonth: selectedMonth, fromDate: '', toDate: '' };
    }
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    
    // Calculate starting month of range
    const startMonthDate = new Date(Date.UTC(year, month - 1 - (rangeMonths - 1), 1));
    const fromMonthVal = `${startMonthDate.getUTCFullYear()}-${String(startMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    
    const endMonthDate = new Date(Date.UTC(year, month - 1, 1));
    const toMonthVal = `${endMonthDate.getUTCFullYear()}-${String(endMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    
    const fromDate = `${fromMonthVal}-01`;
    // Last day of the selected month
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const toDate = `${toMonthVal}-${String(lastDay).padStart(2, '0')}`;
    
    return {
      fromMonth: fromMonthVal,
      toMonth: toMonthVal,
      fromDate,
      toDate
    };
  }, [selectedMonth, rangeMonths]);

  // Queries
  const { data: trendsData, isLoading: isTrendsLoading } = useQuery({
    queryKey: ['spending-trends', analyticsRange.fromMonth, analyticsRange.toMonth],
    queryFn: () => spendingService.getTrends(analyticsRange.fromMonth, analyticsRange.toMonth),
    enabled: !!analyticsRange.fromMonth,
  });

  const { data: breakdownData, isLoading: isBreakdownLoading } = useQuery({
    queryKey: ['spending-breakdown', analyticsRange.fromDate, analyticsRange.toDate, breakdownType],
    queryFn: () => spendingService.getCategoryBreakdown(analyticsRange.fromDate, analyticsRange.toDate, breakdownType),
    enabled: !!analyticsRange.fromDate,
  });

  const { data: budgetPerfData, isLoading: isBudgetPerfLoading } = useQuery({
    queryKey: ['spending-budget-perf', analyticsRange.fromMonth, analyticsRange.toMonth],
    queryFn: () => spendingService.getBudgetPerformance(analyticsRange.fromMonth, analyticsRange.toMonth),
    enabled: !!analyticsRange.fromMonth,
  });

  const { data: savingsRateData, isLoading: isSavingsRateLoading } = useQuery({
    queryKey: ['spending-savings-rate', analyticsRange.fromMonth, analyticsRange.toMonth],
    queryFn: () => spendingService.getSavingsRate(analyticsRange.fromMonth, analyticsRange.toMonth),
    enabled: !!analyticsRange.fromMonth,
  });

  const isAnalyticsLoading = isTrendsLoading || isBreakdownLoading || isBudgetPerfLoading || isSavingsRateLoading;

  if (isAnalyticsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-800/30" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-slate-800/30" />
          <div className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-slate-800/30" />
        </div>
      </div>
    );
  }

  // Format month names (Jan, Feb, ...)
  const formatMonthShort = (monthStr: string) => {
    if (!/^\d{4}-\d{2}$/.test(monthStr)) return monthStr;
    const [, m] = monthStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[Number(m) - 1];
  };

  // Period stats summary
  const totalIncome = savingsRateData?.period_totals?.total_income ?? 0;
  const totalExpense = savingsRateData?.period_totals?.total_expense ?? 0;
  const totalSavings = savingsRateData?.period_totals?.total_savings ?? 0;
  const averageSavingsRate = savingsRateData?.period_totals?.average_savings_rate_pct ?? null;

  // --- 1. Trends Bar Chart Setup ---
  const trendsList = trendsData?.months ?? [];
  const maxTrendVal = Math.max(
    ...trendsList.flatMap((m) => [Number(m.total_income), Number(m.total_expense)]),
    100
  );

  // --- 2. Savings Rate Area Chart Setup ---
  const savingsRateList = savingsRateData?.months ?? [];
  const rates = savingsRateList.map((m) => m.savings_rate_pct ?? 0);
  const minRate = Math.min(...rates, 0);
  const maxRate = Math.max(...rates, 100);
  const rateRange = maxRate - minRate || 100;

  // --- 3. Category Breakdown donut calculation ---
  const breakdownCategories = breakdownData?.categories ?? [];
  const otherItem = breakdownData?.other;
  const donutItems = [...breakdownCategories];
  if (otherItem) {
    donutItems.push({
      category_id: 'other',
      category_name: 'Other Categories',
      amount: otherItem.amount,
      pct_of_total: otherItem.pct_of_total,
      transaction_count: 0
    });
  }

  // --- 4. Budget Performance sorting ---
  const sortedBudgetItems = [...(budgetPerfData?.categories ?? [])].sort(
    (a, b) => (b.utilization_pct ?? 0) - (a.utilization_pct ?? 0)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Analytics Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-700/50 bg-slate-800/20 p-4">
        <div>
          <h4 className="text-base font-semibold text-white">Analysis Window</h4>
          <p className="text-xs text-slate-400">Comparing trends ending in {formatMonthLabel(selectedMonth)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Duration:</span>
          {[3, 6, 12].map((m) => (
            <button
              key={m}
              onClick={() => setRangeMonths(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                rangeMonths === m
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-800/40 text-slate-400 border border-transparent hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              {m} Months
            </button>
          ))}
        </div>
      </div>

      {/* Period Stats Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card: Total Income */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Period Income</p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {formatCurrency(Number(totalIncome), displayCurrency, currencyDisplayPreference)}
              </h3>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Card: Total Expenses */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Period Expenses</p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {formatCurrency(Number(totalExpense), displayCurrency, currencyDisplayPreference)}
              </h3>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400">
              <TrendingUp className="h-5 w-5 rotate-180" />
            </div>
          </div>
        </div>

        {/* Card: Period Savings */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Net Savings</p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {formatCurrency(Number(totalSavings), displayCurrency, currencyDisplayPreference)}
              </h3>
            </div>
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
              <PiggyBank className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Card: Savings Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Avg Savings Rate</p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {averageSavingsRate !== null ? `${Number(averageSavingsRate).toFixed(1)}%` : 'N/A'}
              </h3>
            </div>
            <div className="rounded-lg bg-violet-500/10 p-2 text-violet-400">
              <Percent className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trends Chart */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <BarChart2 className="h-4 w-4 text-cyan-400" />
              Income vs Expenses Trend
            </h4>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                Income
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Expenses
              </div>
            </div>
          </div>

          {trendsList.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No trend data available for the period
            </div>
          ) : (
            <div className="h-64 w-full">
              <svg className="h-full w-full" viewBox="0 0 500 300" preserveAspectRatio="none">
                {/* Horizontal Grid lines & Y Axis Labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                  const y = 20 + (1 - p) * 235;
                  const labelVal = maxTrendVal * p;
                  return (
                    <g key={idx}>
                      <line x1="50" y1={y} x2="480" y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="42" y={y + 4} textAnchor="end" className="text-[10px] font-medium fill-slate-400">
                        {labelVal >= 1000 ? `${(labelVal / 1000).toFixed(0)}k` : labelVal.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {/* Bars per Month */}
                {(() => {
                  const step = 430 / trendsList.length;
                  const barW = Math.max(4, step * 0.25);
                  return trendsList.map((m, idx) => {
                    const xCenter = 50 + idx * step + step * 0.5;
                    const incomeH = (Number(m.total_income) / maxTrendVal) * 235;
                    const expenseH = (Number(m.total_expense) / maxTrendVal) * 235;

                    return (
                      <g key={m.month}>
                        {/* Income Bar */}
                        <rect
                          x={xCenter - barW - 2}
                          y={20 + 235 - incomeH}
                          width={barW}
                          height={incomeH}
                          rx="2"
                          className="fill-cyan-500 hover:fill-cyan-400 transition-colors"
                        >
                          <title>{`Income: ${formatCurrency(Number(m.total_income), displayCurrency, currencyDisplayPreference)}`}</title>
                        </rect>
                        {/* Expense Bar */}
                        <rect
                          x={xCenter + 2}
                          y={20 + 235 - expenseH}
                          width={barW}
                          height={expenseH}
                          rx="2"
                          className="fill-rose-500 hover:fill-rose-400 transition-colors"
                        >
                          <title>{`Expense: ${formatCurrency(Number(m.total_expense), displayCurrency, currencyDisplayPreference)}`}</title>
                        </rect>
                        {/* X Axis Label */}
                        <text x={xCenter} y="275" textAnchor="middle" className="text-[10px] font-semibold fill-slate-400">
                          {formatMonthShort(m.month)}
                        </text>
                      </g>
                    );
                  });
                })()}
                <line x1="50" y1="255" x2="480" y2="255" stroke="#475569" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>

        {/* Savings Rate Chart */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Percent className="h-4 w-4 text-emerald-400" />
              Savings Rate Trend (%)
            </h4>
          </div>

          {savingsRateList.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No savings rate data available
            </div>
          ) : (
            <div className="h-64 w-full">
              <svg className="h-full w-full" viewBox="0 0 500 300" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="savingsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                  const y = 20 + (1 - p) * 235;
                  const labelVal = minRate + rateRange * p;
                  return (
                    <g key={idx}>
                      <line x1="50" y1={y} x2="480" y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="42" y={y + 4} textAnchor="end" className="text-[10px] font-medium fill-slate-400">
                        {labelVal.toFixed(0)}%
                      </text>
                    </g>
                  );
                })}

                {/* Area and Line Graph */}
                {(() => {
                  const step = 430 / Math.max(savingsRateList.length - 1, 1);
                  const points = savingsRateList.map((m, idx) => {
                    const rate = m.savings_rate_pct ?? 0;
                    const x = 50 + idx * step;
                    const y = 20 + 235 - ((rate - minRate) / rateRange) * 235;
                    return { x, y, rate, month: m.month };
                  });

                  const lineD = points.map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
                  const zeroY = 20 + 235 - ((0 - minRate) / rateRange) * 235;
                  const areaD = `${lineD} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`;

                  return (
                    <g>
                      {/* Gradient Area */}
                      <path d={areaD} fill="url(#savingsAreaGrad)" />
                      {/* Stroke Line */}
                      <path d={lineD} fill="none" stroke="#10b981" strokeWidth="2.5" />
                      {/* Zero line */}
                      {minRate < 0 && (
                        <line x1="50" y1={zeroY} x2="480" y2={zeroY} stroke="#f43f5e" strokeWidth="1" strokeDasharray="2 2" />
                      )}
                      {/* Data Point Circles + X Labels */}
                      {points.map((p, idx) => (
                        <g key={idx}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="4.5"
                            className="fill-emerald-400 stroke-slate-900 stroke-2 hover:r-6 cursor-pointer transition-all"
                          >
                            <title>{`${p.month}: ${p.rate.toFixed(1)}%`}</title>
                          </circle>
                          {/* Value label directly above dot */}
                          <text x={p.x} y={p.y - 8} textAnchor="middle" className="text-[9px] font-bold fill-emerald-300 bg-slate-900/80 px-1 rounded">
                            {p.rate.toFixed(0)}%
                          </text>
                          <text x={p.x} y="275" textAnchor="middle" className="text-[10px] font-semibold fill-slate-400">
                            {formatMonthShort(p.month)}
                          </text>
                        </g>
                      ))}
                    </g>
                  );
                })()}
                <line x1="50" y1="255" x2="480" y2="255" stroke="#475569" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Categories Breakdown & Budget Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown Card */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 backdrop-blur-sm">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <PieChart className="h-4 w-4 text-cyan-400" />
              Category Breakdown
            </h4>
            <div className="flex rounded-lg bg-slate-950/40 p-1">
              <button
                onClick={() => setBreakdownType('expense')}
                className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  breakdownType === 'expense'
                    ? 'bg-cyan-500/25 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Expenses
              </button>
              <button
                onClick={() => setBreakdownType('income')}
                className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  breakdownType === 'income'
                    ? 'bg-cyan-500/25 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Income
              </button>
            </div>
          </div>

          {donutItems.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-500">
              No transactions for breakdown during this period
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
              {/* SVG Donut */}
              <div className="relative h-40 w-40 flex-shrink-0">
                <svg className="h-full w-full" viewBox="0 0 200 200">
                  {(() => {
                    let currentOffset = 0;
                    return donutItems.map((cat) => {
                      const theme = cat.category_id === 'other' ? { color: '#94a3b8' } : getCategoryTheme(cat.category_id as string);
                      const strokeDash = `${(Number(cat.pct_of_total) / 100) * 376.99} 376.99`;
                      const offset = -currentOffset;
                      currentOffset += (Number(cat.pct_of_total) / 100) * 376.99;
                      return (
                        <circle
                          key={cat.category_id}
                          cx={100}
                          cy={100}
                          r={60}
                          fill="transparent"
                          stroke={theme.color}
                          strokeWidth="14"
                          strokeDasharray={strokeDash}
                          strokeDashoffset={offset}
                          transform="rotate(-90 100 100)"
                          className="transition-all duration-300 hover:stroke-[18px]"
                        >
                          <title>{`${cat.category_name}: ${Number(cat.pct_of_total).toFixed(1)}%`}</title>
                        </circle>
                      );
                    });
                  })()}
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</span>
                  <span className="text-sm font-extrabold text-white">
                    {formatCurrency(Number(breakdownData?.total ?? 0), displayCurrency, currencyDisplayPreference)}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 w-full max-h-52 overflow-y-auto space-y-2.5 pr-2">
                {donutItems.map((cat) => {
                  const theme = cat.category_id === 'other' ? { color: '#94a3b8' } : getCategoryTheme(cat.category_id as string);
                  return (
                    <div key={cat.category_id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded" style={{ backgroundColor: theme.color }} />
                        <span className="font-medium text-slate-300 truncate">{cat.category_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-semibold">{Number(cat.pct_of_total).toFixed(1)}%</span>
                        <span className="text-slate-100 font-bold">
                          {formatCurrency(Number(cat.amount), displayCurrency, currencyDisplayPreference)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Budget Performance Card */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-5 backdrop-blur-sm">
          <div className="mb-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Budget Guardrails &amp; Performance
            </h4>
          </div>

          {sortedBudgetItems.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-500">
              No active budgets found for this month window
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-4 pr-2">
              {sortedBudgetItems.map((item) => {
                const isWarning = item.status === 'warning';
                const isExceeded = item.status === 'exceeded';
                const statusColor = isExceeded ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';
                const progressColor = isExceeded ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
                const uPct = item.utilization_pct !== null ? Math.round(item.utilization_pct) : 0;
                
                return (
                  <div key={item.category_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{item.category_name}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Spent {formatCurrency(Number(item.actual_amount), displayCurrency, currencyDisplayPreference)} of{' '}
                        {item.budget_amount !== null
                          ? formatCurrency(Number(item.budget_amount), displayCurrency, currencyDisplayPreference)
                          : 'N/A'}
                      </span>
                      <span className="font-semibold">{uPct}%</span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950/40">
                      <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${Math.max(0, Math.min(100, uPct))}%` }} />
                    </div>

                    {item.remaining !== null && (
                      <p className="text-[10px] text-right font-medium text-slate-500">
                        {isExceeded
                          ? `${formatCurrency(Math.abs(Number(item.remaining)), displayCurrency, currencyDisplayPreference)} over limit`
                          : `${formatCurrency(Number(item.remaining), displayCurrency, currencyDisplayPreference)} remaining`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// =============================================================================
// SpendingLedgerTab – per-account transaction ledger with running balance
// =============================================================================

interface SpendingLedgerTabProps {
  accounts: Array<{ public_id: string; name: string; account_type: string; default_currency_code: string }>;
  selectedAccountId: string;
  onAccountChange: (id: string) => void;
  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
  currencyDisplayPreference: 'symbol' | 'code';
  fromDate?: string;
  toDate?: string;
}

// Reconciliation card: compares projected ledger balance to cash snapshot
const ReconciliationCard: React.FC<{
  reconciliation: ReconciliationSummary;
  formatBal: (v: string | number | undefined) => string;
}> = ({ reconciliation, formatBal }) => {
  const disc = reconciliation.discrepancy !== null ? Number(reconciliation.discrepancy) : null;
  const discAbs = disc !== null ? Math.abs(disc) : null;
  const projected = Number(reconciliation.projected_balance);
  const threshold = projected !== 0 ? Math.abs(projected) * 0.05 : 100;
  const discColor =
    disc === null
      ? 'text-slate-400'
      : disc === 0
      ? 'text-emerald-400'
      : discAbs! >= threshold
      ? 'text-rose-400'
      : 'text-amber-400';

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reconciliation</span>
        {disc === 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Balanced</span>
        )}
        {disc !== null && disc !== 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            discAbs! >= threshold ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'
          }`}>Discrepancy</span>
        )}
        {disc === null && (
          <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">No Snapshot</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Projected</p>
          <p className={`text-base font-bold ${Number(reconciliation.projected_balance) >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
            {formatBal(reconciliation.projected_balance)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Snapshot</p>
          {reconciliation.snapshot_balance !== null ? (
            <p className={`text-base font-bold ${Number(reconciliation.snapshot_balance) >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
              {formatBal(reconciliation.snapshot_balance)}
            </p>
          ) : (
            <p className="text-base font-bold text-slate-500">—</p>
          )}
          {reconciliation.snapshot_as_of && !isNaN(new Date(reconciliation.snapshot_as_of).getTime()) && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              as of {formatDate(reconciliation.snapshot_as_of)}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Gap</p>
          <p className={`text-base font-bold ${discColor}`}>
            {disc !== null ? (disc > 0 ? '+' : '') + formatBal(reconciliation.discrepancy!) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

const SpendingLedgerTab: React.FC<SpendingLedgerTabProps> = ({
  accounts,
  selectedAccountId,
  onAccountChange,
  offset,
  limit,
  onOffsetChange,
  currencyDisplayPreference,
  fromDate,
  toDate,
}) => {
  const selectedAccount = accounts.find((a) => a.public_id === selectedAccountId) ?? null;

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['spending', 'ledger', selectedAccountId, offset, limit, fromDate, toDate],
    queryFn: () => spendingService.getAccountLedger(selectedAccountId, {
      limit,
      offset,
      from_date: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
      to_date: toDate ? `${toDate}T23:59:59.999Z` : undefined,
    }),
    enabled: !!selectedAccountId,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['finance', 'account-balance', selectedAccountId],
    queryFn: () => financeService.getAccountBalance(selectedAccountId),
    enabled: !!selectedAccountId,
  });

  const { data: reconciliation } = useQuery({
    queryKey: ['finance', 'reconciliation', selectedAccountId],
    queryFn: () => financeService.getAccountReconciliation(selectedAccountId),
    enabled: !!selectedAccountId,
  });

  const currency = selectedAccount?.default_currency_code ?? 'USD';

  const formatBal = (val: string | number | undefined) =>
    val !== undefined
      ? formatCurrency(Number(val), currency, currencyDisplayPreference)
      : '—';


  return (
    <div className="animate-in fade-in duration-300 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Account Ledger</h3>
          <p className="text-sm text-slate-400 mt-0.5">Transaction-by-transaction running balance for a spending account</p>
        </div>

        {/* Account selector */}
        <div className="flex min-w-[220px] flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Select Account</label>
          <select
            value={selectedAccountId}
            onChange={(e) => onAccountChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">— Pick an account —</option>
            {accounts.map((a) => (
              <option key={a.public_id} value={a.public_id}>
                {a.name} ({a.account_type.replace('_', ' ')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedAccountId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
          <div className="mb-4 rounded-full bg-slate-800 p-4">
            <Landmark className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">Select an account</h3>
          <p className="text-slate-400 text-sm">Choose a spending account above to view its transaction ledger and running balance.</p>
        </div>
      ) : isLoading ? (
        <SkeletonList rows={5} />
      ) : (
        <>
          {/* Balance summary cards */}
          {balanceData && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Projected Balance</p>
                <p className={`text-xl font-bold ${
                  Number(balanceData.spending_balance) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {formatBal(balanceData.spending_balance)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Transactions</p>
                <p className="text-xl font-bold text-white">{balanceData.transaction_count}</p>
                {balanceData.transfer_count > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">{balanceData.transfer_count} transfer{balanceData.transfer_count > 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Page Opening</p>
                <p className={`text-xl font-bold ${
                  Number(ledger?.opening_balance ?? 0) >= 0 ? 'text-slate-200' : 'text-rose-400'
                }`}>
                  {formatBal(ledger?.opening_balance)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Page Closing</p>
                <p className={`text-xl font-bold ${
                  Number(ledger?.closing_balance ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {formatBal(ledger?.closing_balance)}
                </p>
              </div>
            </div>
          )}

          {/* Reconciliation card */}
          {reconciliation && (
            <ReconciliationCard reconciliation={reconciliation} formatBal={formatBal} />
          )}


          {/* Ledger table */}
          {ledger && ledger.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
              <Wallet className="h-8 w-8 text-slate-500 mb-3" />
              <p className="text-slate-400">No transactions for this account yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-sm text-slate-300 min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Debit</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Credit</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(ledger?.items ?? []).map((entry: LedgerEntry) => {
                    const isTransfer = entry.entry_kind === 'transfer_out' || entry.entry_kind === 'transfer_in';
                    const isCredit = entry.entry_kind === 'transfer_in' || entry.type === 'income';
                    const amount = Number(entry.amount);
                    const balance = Number(entry.running_balance);
                    const date = formatDate(entry.occurred_at, { fallback: '—' });

                    // Derive description label for transfer rows
                    const descLabel = isTransfer
                      ? (entry.description
                          ? (entry.entry_kind === 'transfer_out' ? `Transfer → ${entry.description}` : `Transfer ← ${entry.description}`)
                          : (entry.entry_kind === 'transfer_out' ? 'Transfer out' : 'Transfer in'))
                      : entry.description ?? '—';

                    // Row background tint for transfers
                    const rowClass = isTransfer
                      ? 'hover:bg-slate-800/50 transition-colors bg-slate-800/20'
                      : 'hover:bg-slate-800/30 transition-colors';

                    return (
                      <tr
                        key={entry.public_id}
                        className={rowClass}
                      >
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{date}</td>
                        <td className="px-4 py-3">
                          <span className={isTransfer ? 'text-slate-300 text-xs font-medium' : 'text-slate-200'}>
                            {descLabel}
                          </span>
                          {!isTransfer && entry.wallet_name && (
                            <span className="ml-2 text-xs text-slate-500">{entry.wallet_name}</span>
                          )}
                          {isTransfer && (
                            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              entry.entry_kind === 'transfer_out'
                                ? 'bg-indigo-500/15 text-indigo-400'
                                : 'bg-cyan-500/15 text-cyan-400'
                            }`}>
                              {entry.entry_kind === 'transfer_out' ? 'Out' : 'In'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {!isCredit && (
                            <span className={isTransfer ? 'text-indigo-400' : 'text-rose-400'}>
                              {formatCurrency(amount, currency, currencyDisplayPreference)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {isCredit && (
                            <span className={isTransfer ? 'text-cyan-400' : 'text-emerald-400'}>
                              {formatCurrency(amount, currency, currencyDisplayPreference)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={balance >= 0 ? 'text-slate-200' : 'text-rose-400'}>
                            {formatCurrency(balance, currency, currencyDisplayPreference)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {ledger && ledger.total_entries > limit && (
            <Pagination
              total={ledger.total_entries}
              limit={limit}
              offset={offset}
              onPageChange={onOffsetChange}
            />
          )}

        </>
      )}
    </div>
  );
};
