import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { spendingService } from '../services/spending';
import type { TransactionCreate, TransactionType, BudgetCreate, BudgetUpdate, Budget } from '../types/spending';
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
  Edit2
} from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { DropdownSelect } from '../components/DropdownSelect';
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

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthStartToMonthValue = (monthStart: string) => monthStart.slice(0, 7);

export const SpendingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'transactions' | 'budgets'>('transactions');

  // Budget Modal
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const [txOffset, setTxOffset] = useState(0);
  const [budgetOffset, setBudgetOffset] = useState(0);
  const limit = 50;

  const { data: categoriesResponse, isLoading: isCatsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => spendingService.getCategories(200, 0)
  });
  const categories = categoriesResponse?.items;
  const categoryOptions = useMemo(() => categories?.map((category) => ({
    value: category.public_id,
    label: category.name,
  })) ?? [], [categories]);

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
    queryKey: ['transactions', txOffset],
    queryFn: () => spendingService.getTransactions(limit, txOffset)
  });
  const transactions = transactionsResponse?.items;

  const { data: budgetsResponse, isLoading: isBudgetsLoading } = useQuery({
    queryKey: ['budgets', budgetOffset],
    queryFn: () => spendingService.getBudgets(limit, budgetOffset)
  });
  const budgets = budgetsResponse?.items;

  const createMutation = useMutation({
    mutationFn: (newTx: TransactionCreate) => spendingService.createTransaction(newTx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsModalOpen(false);
      setAmount('');
      setDescription('');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => spendingService.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !type || !date) return;
    
    createMutation.mutate({
      amount: parseFloat(amount),
      category_id: categoryId,
      type,
      occurred_at: new Date(date).toISOString(),
      description: description || null
    });
  };

  const closeBudgetModal = () => {
    setIsBudgetModalOpen(false);
    setEditingBudgetId(null);
    resetBudgetForm({
      categoryId: '',
      month: getCurrentMonthValue(),
      amount: '',
    });
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
      month: getCurrentMonthValue(),
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
    if (!transactions) return { income: 0, expense: 0, net: 0 };
    const result = transactions.reduce((acc, tx) => {
      const amt = parseFloat(tx.amount.toString());
      if (tx.type === 'income') acc.income += amt;
      else acc.expense += amt;
      return acc;
    }, { income: 0, expense: 0, net: 0 });
    
    result.net = result.income - result.expense;
    return result;
  }, [transactions]);

  const isLoading = isCatsLoading || isTxLoading || isBudgetsLoading;

  return (
    <div className="mx-auto max-w-5xl p-8 animate-in fade-in duration-500">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">Spending Overview</h1>
          <p className="mt-2 text-slate-400">Track your finances across the workspace.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openBudgetModalForNew}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95 border border-slate-700/50"
          >
            <Target className="h-5 w-5" />
            <span>Set Budget</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105 hover:shadow-blue-500/40 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <Plus className="h-5 w-5" />
            <span>New Transaction</span>
          </button>
        </div>
      </header>

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
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-blue-500" />
        </div>
      ) : activeTab === 'transactions' ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h3 className="text-xl font-semibold text-white">Recent Transactions</h3>
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
                            onClick={() => deleteMutation.mutate(tx.public_id)}
                            className="inline-flex rounded-lg p-2 text-slate-500 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
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
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h3 className="text-xl font-semibold text-white">Category Budgets</h3>
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
                // Calculate total spent for this category (for the budget month roughly)
                const monthPrefix = b.month_start.substring(0, 7); // YYYY-MM
                const spent = transactions?.filter(t => 
                  t.category_id === b.category_id && 
                  t.type === 'expense' &&
                  t.occurred_at.startsWith(monthPrefix)
                ).reduce((acc, t) => acc + parseFloat(t.amount.toString()), 0) || 0;
                
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
                        <p className="text-xs text-slate-400">Spent ({monthPrefix})</p>
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
      )}

      {/* Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsModalOpen(false)}
          />
          
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">New Transaction</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6">
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
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl bg-slate-800 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !amount || !categoryId || !type || !date}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Transaction'}
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
                  <Input
                    id="budget-month"
                    type="month"
                    required
                    disabled={!!editingBudgetId} // Cannot change month when editing
                    {...registerBudgetField('month')}
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
    </div>
  );
};
