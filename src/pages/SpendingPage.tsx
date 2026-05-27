import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { spendingService } from '../services/spending';
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
  Calendar,
  X,
  Target,
  Edit2,
  Filter,
  Brush,
  RefreshCw,
  Clock,
  ToggleLeft,
} from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { DropdownSelect } from '../components/DropdownSelect';
import { DatePicker } from '../components/DatePicker';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const budgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Select a category'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Select a valid month'),
  amount: z
    .string()
    .min(1, 'Enter a budget amount')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, 'Budget must be greater than 0'),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

const recurringFormSchema = z
  .object({
    categoryId: z.string().min(1, 'Select a category'),
    amount: z
      .string()
      .min(1, 'Enter an amount')
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Amount must be greater than 0'),
    type: z.enum(['income', 'expense']),
    description: z.string().max(500).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z
      .string()
      .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, 'Interval must be a positive integer'),
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
    label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState<'transactions' | 'budgets' | 'recurring'>('transactions');

  // Budget Modal
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#60a5fa');
  const [categoryIcon, setCategoryIcon] = useState('');

  const [txOffset, setTxOffset] = useState(0);
  const [budgetOffset, setBudgetOffset] = useState(0);
  const [recurringOffset, setRecurringOffset] = useState(0);
  const limit = 50;
  const monthRange = useMemo(() => monthValueToDateRange(selectedMonth), [selectedMonth]);
  const monthFilterOptions = useMemo(() => buildMonthOptions(), []);

  // Recurring modal state
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);

  const { data: categoriesResponse, isLoading: isCatsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => spendingService.getCategories(200, 0)
  });
  const categories = categoriesResponse?.items;
  const customCategories = useMemo(
    () => categories?.filter((category) => !category.is_system) ?? [],
    [categories]
  );
  const categoryOptions = useMemo(() => categories?.map((category) => ({
    value: category.public_id,
    label: category.name,
  })) ?? [], [categories]);
  const categoryFilterOptions = categoryOptions;

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
    queryKey: ['transactions', txOffset, selectedMonth, selectedCategoryFilter],
    queryFn: () => spendingService.getTransactions(limit, txOffset, {
      categoryId: selectedCategoryFilter || undefined,
      fromDate: monthRange.fromDate,
      toDate: monthRange.toDate,
    }),
    enabled: monthRange.isValid,
  });
  const transactions = transactionsResponse?.items;

  const { data: summaryResponse, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['transactions-summary', selectedMonth],
    queryFn: () => spendingService.getTransactionSummary({
      fromDate: monthRange.fromDate,
      toDate: monthRange.toDate,
    }),
    enabled: monthRange.isValid,
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

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; color?: string | null; icon?: string | null }) =>
      spendingService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCategoryName('');
      setCategoryColor('#60a5fa');
      setCategoryIcon('');
      setIsCategoryModalOpen(false);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => spendingService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
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
  const recurringItems = recurringResponse?.items ?? [];

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

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !type || !date) return;
    const payload: TransactionCreate = {
      amount: parseFloat(amount),
      category_id: categoryId,
      type,
      occurred_at: new Date(date).toISOString(),
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
    setDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const openCategoryModal = () => {
    setIsCategoryModalOpen(true);
  };

  const openTransactionModalForEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setAmount(tx.amount.toString());
    setDescription(tx.description ?? '');
    setType(tx.type);
    setCategoryId(tx.category_id);
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
    setDate(new Date().toISOString().split('T')[0]);
  };

  const closeCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setCategoryName('');
    setCategoryColor('#60a5fa');
    setCategoryIcon('');
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
    <div className="mx-auto max-w-5xl p-8 animate-in fade-in duration-500">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">Spending Overview</h1>
          <p className="mt-2 text-slate-400">
            Track your finances across the workspace for {monthRange.label}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={openCategoryModal}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-slate-900 px-6 py-3 font-semibold text-slate-200 shadow-lg transition-all hover:bg-slate-800 active:scale-95 border border-slate-700/50"
          >
            <Brush className="h-5 w-5" />
            <span>Manage Categories</span>
          </button>
          <button
            onClick={openBudgetModalForNew}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95 border border-slate-700/50"
          >
            <Target className="h-5 w-5" />
            <span>Set Budget</span>
          </button>
          <button
            onClick={openRecurringModalForNew}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95 border border-slate-700/50"
          >
            <RefreshCw className="h-5 w-5" />
            <span>Add Recurring</span>
          </button>
          <button
            onClick={openTransactionModalForNew}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105 hover:shadow-blue-500/40 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <Plus className="h-5 w-5" />
            <span>New Transaction</span>
          </button>
        </div>
      </header>

      <div className="mb-6 rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-400">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="spending-month" className="mb-2 block">Month</Label>
                <DropdownSelect
                  id="spending-month"
                  value={selectedMonth}
                  onChange={(value) => {
                    setSelectedMonth(value);
                    setTxOffset(0);
                    setBudgetOffset(0);
                  }}
                  options={monthFilterOptions}
                  placeholder="Select month"
                />
              </div>
              <div>
                <Label className="mb-2 block">Category</Label>
                <DropdownSelect
                  value={selectedCategoryFilter}
                  onChange={(value) => {
                    setSelectedCategoryFilter(value);
                    setTxOffset(0);
                  }}
                  options={categoryFilterOptions}
                  placeholder="All categories"
                  clearLabel="All categories"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedMonth(getCurrentMonthValue());
                setSelectedCategoryFilter('');
                setTxOffset(0);
                setBudgetOffset(0);
              }}
              className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              Reset filters
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/80 p-6 backdrop-blur-xl transition-all hover:border-slate-600">
          <div className="absolute -right-4 -top-4 rounded-full bg-emerald-500/10 p-8 blur-2xl" />
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-emerald-500/20 p-3 text-emerald-400">
              <ArrowUpCircle className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Income</p>
              <h2 className="text-2xl font-bold text-white">${summary.income.toFixed(2)}</h2>
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
              <h2 className="text-2xl font-bold text-white">${summary.expense.toFixed(2)}</h2>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800 to-slate-800/80 p-6 backdrop-blur-xl transition-all hover:border-slate-600">
          <div className={`absolute -right-4 -top-4 rounded-full p-8 blur-2xl ${summary.net >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`} />
          <div className="flex items-center gap-4">
            <div className={`rounded-xl p-3 ${summary.net >= 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
              <Wallet className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Net Balance</p>
              <h2 className="text-2xl font-bold text-white">${summary.net.toFixed(2)}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-700/50 pb-px">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'transactions' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Transactions
        </button>
        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'budgets' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Budgets
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'recurring' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Recurring
        </button>
      </div>

      {isRecurringLoading && activeTab === 'recurring' ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-blue-500" />
        </div>
      ) : isLoading && activeTab !== 'recurring' ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-blue-500" />
        </div>
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
            <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Category</th>
                    <th className="px-6 py-4 font-medium">Description</th>
                    <th className="px-6 py-4 text-right font-medium">Amount</th>
                    <th className="px-6 py-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {transactions?.map((tx) => {
                    const catTheme = getCategoryTheme(tx.category_id);
                    const isIncome = tx.type === 'income';
                    const dateObj = new Date(tx.occurred_at);
                    
                    return (
                      <tr key={tx.public_id} className="group transition-colors hover:bg-slate-700/30">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
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
                          <p className="truncate max-w-[200px] text-slate-200">{tx.description || '-'}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-semibold ${isIncome ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {isIncome ? '+' : '-'}${parseFloat(tx.amount.toString()).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openTransactionModalForEdit(tx)}
                            className="inline-flex rounded-lg p-2 text-slate-500 opacity-0 transition-all hover:bg-blue-500/10 hover:text-blue-400 group-hover:opacity-100"
                            title="Edit transaction"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(tx.public_id)}
                            className="ml-2 inline-flex rounded-lg p-2 text-slate-500 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
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
                        <p className="text-lg font-bold text-white">${spent.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Budget</p>
                        <p className="font-semibold text-slate-300">${bAmount.toFixed(2)}</p>
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
                className="mt-6 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-500 transition-colors"
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
                        {isIncome ? '+' : '-'}${Number(r.amount).toFixed(2)}
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
                        Last generated{' '}
                        {new Date(r.last_generated_at).toLocaleDateString(undefined, {
                          timeZone: 'UTC',
                        })}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 border-t border-slate-700/50 pt-3">
                      <button
                        onClick={() => openRecurringModalForEdit(r)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              'Are you sure you want to deactivate this recurring rule?'
                            )
                          ) {
                            deactivateRecurringMutation.mutate(r.public_id);
                          }
                        }}
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
        </div>
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
                        value={field.value}
                        onChange={field.onChange}
                        options={categoryOptions}
                        placeholder="Select category"
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
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    id="rec-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="pl-8"
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
                  <Input
                    id="rec-anchor"
                    type="date"
                    {...registerRecurringField('anchor_date')}
                  />
                  {recurringErrors.anchor_date && (
                    <p className="mt-2 text-sm text-rose-400">{recurringErrors.anchor_date.message}</p>
                  )}
                </div>
              )}

              {/* End date (optional) */}
              <div>
                <Label htmlFor="rec-end" className="mb-2 block">End Date <span className="text-slate-500">(optional)</span></Label>
                <Input
                  id="rec-end"
                  type="date"
                  {...registerRecurringField('end_date')}
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="rec-desc" className="mb-2 block">Description <span className="text-slate-500">(optional)</span></Label>
                <Input
                  id="rec-desc"
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
                  disabled={createRecurringMutation.isPending || updateRecurringMutation.isPending}
                  className="flex-1 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
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
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/50 py-3 pl-8 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Category</label>
                  <DropdownSelect
                    value={categoryId}
                    onChange={setCategoryId}
                    options={categoryOptions}
                    placeholder="Select category"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Date</label>
                  <DatePicker
                    value={date}
                    onChange={setDate}
                    placeholder="Select date"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Description (Optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  disabled={(createMutation.isPending || updateMutation.isPending) || !amount || !categoryId || !type || !date}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 disabled:opacity-50"
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
                        value={field.value}
                        onChange={field.onChange}
                        options={categoryOptions}
                        placeholder="Select category"
                        disabled={!!editingBudgetId}
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
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <Input
                      id="budget-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      className="pl-8"
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

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={closeCategoryModal}
          />

          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">Manage Categories</h3>
              <button
                onClick={closeCategoryModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!categoryName.trim()) return;
                  createCategoryMutation.mutate({
                    name: categoryName.trim(),
                    color: categoryColor || null,
                    icon: categoryIcon || null,
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <Label className="mb-2 block">Name</Label>
                  <Input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g. Groceries"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-2 block">Color</Label>
                    <Input
                      type="color"
                      value={categoryColor}
                      onChange={(e) => setCategoryColor(e.target.value)}
                      className="h-11 p-1"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Icon</Label>
                    <Input
                      value={categoryIcon}
                      onChange={(e) => setCategoryIcon(e.target.value)}
                      placeholder="🧾"
                      maxLength={4}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={closeCategoryModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createCategoryMutation.isPending || !categoryName.trim()}
                  >
                    {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
                  </Button>
                </div>
              </form>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Custom categories
                  </h4>
                  <p className="text-xs text-slate-500">{customCategories.length} total</p>
                </div>
                <div className="space-y-2">
                  {customCategories.length === 0 ? (
                    <p className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                      No custom categories yet.
                    </p>
                  ) : (
                    customCategories.map((category) => (
                      <div
                        key={category.public_id}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm"
                            style={{ backgroundColor: `${category.color ?? '#64748b'}33`, color: category.color ?? '#94a3b8' }}
                          >
                            {category.icon || <Tag className="h-4 w-4" />}
                          </span>
                          <div>
                            <p className="font-medium text-white">{category.name}</p>
                            <p className="text-xs text-slate-500">{category.color ?? 'No color set'}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCategoryMutation.mutate(category.public_id)}
                          disabled={deleteCategoryMutation.isPending}
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                          title="Delete category"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
