import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SkeletonList } from '../components/ui/FeedbackStates';
import { useInvalidatingMutation } from '../hooks/useInvalidatingMutation';
import { mutationInvalidations, queryKeys } from '../lib/queryKeys';
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
} from '../types/spending';

import {
  ArrowDownCircle,
  Plus,
  Trash2,
  Tag,
  Target,
  Clock3,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import { DropdownSelect } from '../components/DropdownSelect';
import { DatePicker } from '../components/DatePicker';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { FormattedNumberInput } from '../components/ui/formatted-number-input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  DEFAULT_DECIMAL_PLACES,
  DEFAULT_DISPLAY_LOCALE,
  formatCurrency,
} from '../utils/numberFormat';
import { BudgetsTab } from './spending/BudgetsTab';
import { KpisTab } from './spending/KpisTab';
import { RecurringTab } from './spending/RecurringTab';
import { AnalyticsTab } from './spending/AnalyticsTab';
import {
  buildMonthOptions,
  getCurrentMonthValue,
  monthValueToDateRange,
} from './spending/format';

const budgetFormSchema = z
  .object({
    scope: z.enum(['category', 'group']),
    categoryId: z.string().optional(),
    groupId: z.string().optional(),
    startMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Select a valid start month'),
    endMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .or(z.literal('')),
    amount: z
      .string()
      .min(1, 'Enter a budget amount')
      .refine((value) => {
        const num = Number(value);
        return !Number.isNaN(num) && Number.isFinite(num) && num > 0;
      }, 'Budget must be a valid positive number'),
  })
  .refine((values) => (values.scope === 'category' ? !!values.categoryId : true), {
    message: 'Select a category',
    path: ['categoryId'],
  })
  .refine((values) => (values.scope === 'group' ? !!values.groupId : true), {
    message: 'Select a category group',
    path: ['groupId'],
  })
  .refine((values) => !values.endMonth || values.endMonth >= values.startMonth, {
    message: 'End month must be on or after the start month',
    path: ['endMonth'],
  });

type SpendingTab = 'recurring' | 'budgets' | 'kpis' | 'analytics';

const SPENDING_TAB_ROUTES: Record<SpendingTab, string> = {
  recurring: 'recurring',
  budgets: 'budgets',
  kpis: 'kpis',
  analytics: 'analytics',
};

const SPENDING_ROUTE_TABS = Object.fromEntries(
  Object.entries(SPENDING_TAB_ROUTES).map(([tab, route]) => [route, tab]),
) as Record<string, SpendingTab>;

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

const recurringFormSchema = z
  .object({
    categoryId: z.string().min(1, 'Select a category'),
    accountId: z.string().optional(),
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
    interval: z.string().refine((v) => {
      const num = Number(v);
      return Number.isInteger(num) && Number.isFinite(num) && num >= 1;
    }, 'Interval must be a positive integer'),
    anchor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a start date'),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal('')),
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
    },
  );

type RecurringFormValues = z.infer<typeof recurringFormSchema>;

const DEFAULT_PAGE_SIZE = 50;

export const SpendingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Budgets state
  const [budgetsMonth, setBudgetsMonth] = useState(() => getCurrentMonthValue());
  const [budgetsDuration, setBudgetsDuration] = useState<number>(1);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetOffset, setBudgetOffset] = useState(0);

  // Recurring state
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [recurringOffset, setRecurringOffset] = useState(0);
  const [recurringPendingDeactivate, setRecurringPendingDeactivate] = useState<{
    publicId: string;
    description: string;
  } | null>(null);

  // Category management modal
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#22c55e');
  const [newCatIcon, setNewCatIcon] = useState('');
  const [newCatGroupId, setNewCatGroupId] = useState('');

  // Tag management modal
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  // Analytics month
  const [analyticsMonth, setAnalyticsMonth] = useState(() => getCurrentMonthValue());

  const requestedLegacyTab = searchParams.get('tab');
  const pathTab = SPENDING_ROUTE_TABS[location.pathname.slice('/spending/'.length)];
  const legacyTab = requestedLegacyTab && requestedLegacyTab in SPENDING_TAB_ROUTES
    ? (requestedLegacyTab as SpendingTab)
    : null;
  const activeTab: SpendingTab = pathTab ?? legacyTab ?? 'recurring';

  const setActiveTab = useCallback(
    (nextTab: SpendingTab) => {
      const params = new URLSearchParams(location.search);
      params.delete('tab');
      const query = params.toString();
      navigate(`/spending/${SPENDING_TAB_ROUTES[nextTab]}${query ? `?${query}` : ''}`);
    },
    [location.search, navigate],
  );

  useEffect(() => {
    // Redirect legacy routes to /money
    const subpath = location.pathname.slice('/spending/'.length);
    if (subpath === 'transactions' || subpath === 'account-activity') {
      navigate('/money', { replace: true });
      return;
    }

    const isSpendingRoot = location.pathname === '/spending' || location.pathname === '/spending/';
    const isUnknownSpendingBranch = location.pathname.startsWith('/spending/') && !pathTab;
    if (!isSpendingRoot && !isUnknownSpendingBranch) return;

    const targetTab = legacyTab ?? 'recurring';
    const params = new URLSearchParams(location.search);
    params.delete('tab');
    const query = params.toString();
    navigate(`/spending/${SPENDING_TAB_ROUTES[targetTab]}${query ? `?${query}` : ''}`, {
      replace: true,
    });
  }, [legacyTab, location.pathname, location.search, navigate, pathTab]);

  const monthFilterOptions = useMemo(() => buildMonthOptions(), []);
  const budgetsRange = useMemo(
    () => monthValueToDateRange(budgetsMonth),
    [budgetsMonth],
  );

  // Settings & currency display profile
  const userSettingsQuery = useQuery({
    queryKey: queryKeys.finance.settings('user'),
    queryFn: () => financeService.getUserSettings(),
  });
  const workspaceSettingsQuery = useQuery({
    queryKey: queryKeys.finance.settings(),
    queryFn: () => financeService.getSettings(),
  });

  const displayCurrency =
    userSettingsQuery.data?.effective_reporting_currency_code ??
    workspaceSettingsQuery.data?.reporting_currency_code ??
    'USD';

  const currencyDisplayPreference =
    userSettingsQuery.data?.effective_currency_display_preference ??
    workspaceSettingsQuery.data?.currency_display_preference ??
    'symbol';

  const displayLocale = userSettingsQuery.data?.effective_locale ?? DEFAULT_DISPLAY_LOCALE;
  const decimalPlaces = userSettingsQuery.data?.effective_decimal_places ?? DEFAULT_DECIMAL_PLACES;

  // Query categories
  const categoriesQuery = useQuery({
    queryKey: queryKeys.spending.categories(),
    queryFn: () => spendingService.getCategories(200, 0),
  });
  const categories = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data]);

  // Query category groups
  const categoryGroupsQuery = useQuery({
    queryKey: queryKeys.spending.categoryGroups(),
    queryFn: () => spendingService.getCategoryGroups(200, 0),
  });
  const categoryGroups = useMemo(
    () => categoryGroupsQuery.data?.items ?? [],
    [categoryGroupsQuery.data],
  );

  // Query accounts
  const accountsQuery = useQuery({
    queryKey: queryKeys.finance.accounts(),
    queryFn: () => financeService.getAccounts(),
  });
  const accounts = useMemo(() => accountsQuery.data?.items ?? [], [accountsQuery.data]);
  const spendingAccounts = useMemo(
    () =>
      accounts.filter((a) =>
        ['wallet', 'bank', 'card', 'gift_card'].includes(a.account_type.toLowerCase()),
      ),
    [accounts],
  );

  const accountOptions = useMemo(
    () =>
      spendingAccounts.map((a) => ({
        value: a.public_id,
        label: `${a.name} (${a.default_currency_code})`,
      })),
    [spendingAccounts],
  );

  // Query tags
  const tagsQuery = useQuery({
    queryKey: queryKeys.spending.tags(),
    queryFn: () => spendingService.getTags(),
  });
  const tags = useMemo(() => tagsQuery.data?.items ?? [], [tagsQuery.data]);

  // Query recurring rules
  const recurringQuery = useQuery({
    queryKey: queryKeys.spending.recurring({ offset: recurringOffset, limit: DEFAULT_PAGE_SIZE }),
    queryFn: () => spendingService.getRecurring(DEFAULT_PAGE_SIZE, recurringOffset),
  });
  const recurringResponse = recurringQuery.data;
  const recurringItems = useMemo(() => recurringResponse?.items ?? [], [recurringResponse]);

  // Query budgets
  const budgetsQuery = useQuery({
    queryKey: queryKeys.spending.budgets({
      month: budgetsMonth,
      offset: budgetOffset,
      limit: DEFAULT_PAGE_SIZE,
    }),
    queryFn: () =>
      spendingService.getBudgets(
        DEFAULT_PAGE_SIZE,
        budgetOffset,
        `${budgetsMonth}-01`,
      ),
    enabled: budgetsDuration === 1,
  });
  const budgetsResponse = budgetsQuery.data;
  const budgets = useMemo(() => budgetsResponse?.items ?? [], [budgetsResponse]);

  // Query multi-month budget performance
  const budgetPerformanceQuery = useQuery({
    queryKey: ['spending', 'budget-performance', budgetsMonth, budgetsDuration],
    queryFn: () => {
      const fromMonth = budgetsMonth;
      const [year, month] = budgetsMonth.split('-').map(Number);
      const endDate = new Date(Date.UTC(year, month - 1 + budgetsDuration - 1, 1));
      const toMonth = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}`;
      return spendingService.getBudgetPerformance(fromMonth, toMonth);
    },
    enabled: budgetsDuration > 1,
  });

  const periodBudgets = useMemo(() => {
    if (budgetsDuration <= 1 || !budgetPerformanceQuery.data) return [];
    return (budgetPerformanceQuery.data.categories ?? []).map((cat) => ({
      id: cat.category_id ?? cat.category_group_id ?? 'unknown',
      name: cat.category_name ?? cat.category_group_name ?? 'Unnamed',
      isGroup: !cat.category_id && !!cat.category_group_id,
      amount: Number(cat.budget_amount ?? 0),
      spent: Number(cat.actual_amount ?? 0),
      status: cat.status ?? (Number(cat.utilization_pct ?? 0) > 100 ? 'exceeded' : 'on_track'),
      utilization: Number(cat.utilization_pct ?? 0),
      remaining: Number(cat.remaining ?? 0),
      monthly: [],
    }));
  }, [budgetsDuration, budgetPerformanceQuery.data]);

  // Monthly summary for top stats
  const currentMonthValue = useMemo(() => getCurrentMonthValue(), []);
  const currentMonthRange = useMemo(
    () => monthValueToDateRange(currentMonthValue),
    [currentMonthValue],
  );
  const summaryQuery = useQuery({
    queryKey: queryKeys.spending.summary(currentMonthRange.fromDate, currentMonthRange.toDate),
    queryFn: () =>
      spendingService.getTransactionSummary({
        fromDate: currentMonthRange.fromDate,
        toDate: currentMonthRange.toDate,
      }),
  });

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    (summaryQuery.data?.category_totals ?? []).forEach((c) => {
      map.set(c.category_id, Number(c.total));
    });
    return map;
  }, [summaryQuery.data]);

  const spentByGroup = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((cat) => {
      if (cat.category_group_id) {
        const catSpent = spentByCategory.get(cat.public_id) ?? 0;
        map.set(cat.category_group_id, (map.get(cat.category_group_id) ?? 0) + catSpent);
      }
    });
    return map;
  }, [categories, spentByCategory]);

  const getCategoryTheme = useCallback(
    (catId: string | null) => {
      if (!catId) return { name: 'Uncategorized', color: '#64748b', icon: null };
      const cat = categories.find((c) => c.public_id === catId);
      return {
        name: cat?.name ?? 'Unknown',
        color: cat?.color ?? '#22c55e',
        icon: cat?.icon ?? null,
      };
    },
    [categories],
  );

  const getGroupTheme = useCallback(
    (groupId: string | null) => {
      if (!groupId) return { name: 'No Group', color: '#64748b', icon: null };
      const group = categoryGroups.find((g) => g.public_id === groupId);
      return {
        name: group?.name ?? 'Unknown Group',
        color: group?.color ?? '#06b6d4',
        icon: group?.icon ?? null,
      };
    },
    [categoryGroups],
  );

  const categoryFilterOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.public_id,
        label: c.name,
      })),
    [categories],
  );

  const categoryGroupOptions = useMemo(
    () =>
      categoryGroups.map((g) => ({
        value: g.public_id,
        label: g.name,
      })),
    [categoryGroups],
  );

  // Forms
  const budgetForm = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      scope: 'category',
      categoryId: '',
      groupId: '',
      startMonth: getCurrentMonthValue(),
      endMonth: '',
      amount: '',
    },
  });

  const recurringForm = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      categoryId: '',
      accountId: '',
      amount: '',
      type: 'expense',
      description: '',
      frequency: 'monthly',
      interval: '1',
      anchor_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      monthly_mode: 'day_of_month',
      by_weekday: '',
      by_ordinal: '',
    },
  });

  // Mutations
  const createBudgetMutation = useInvalidatingMutation(
    async (values: BudgetFormValues) => {
      const payload: BudgetCreate = {
        category_id: values.scope === 'category' ? values.categoryId : undefined,
        category_group_id: values.scope === 'group' ? values.groupId : undefined,
        start_month: values.startMonth,
        end_month: values.endMonth || undefined,
        amount: Number(values.amount),
      };
      await spendingService.createBudget(payload);
    },
    mutationInvalidations.budget,
    {
      successMessage: 'Budget created successfully',
      onSuccess: () => {
        setIsBudgetModalOpen(false);
        budgetForm.reset();
      },
    },
  );

  const updateBudgetMutation = useInvalidatingMutation(
    async (values: BudgetFormValues) => {
      if (!editingBudget) return;
      const payload: BudgetUpdate = {
        amount: Number(values.amount),
        end_month: values.endMonth || undefined,
      };
      await spendingService.updateBudget(editingBudget.public_id, payload);
    },
    mutationInvalidations.budget,
    {
      successMessage: 'Budget updated successfully',
      onSuccess: () => {
        setIsBudgetModalOpen(false);
        setEditingBudget(null);
        budgetForm.reset();
      },
    },
  );

  const deleteBudgetMutation = useInvalidatingMutation(
    async (budgetId: string) => {
      await spendingService.updateBudget(budgetId, {
        end_month: budgetsMonth,
      });
    },
    mutationInvalidations.budget,
    {
      successMessage: 'Budget ended',
      onSuccess: () => {
        setIsBudgetModalOpen(false);
        setEditingBudget(null);
      },
    },
  );

  const createRecurringMutation = useInvalidatingMutation(
    async (values: RecurringFormValues) => {
      const payload: RecurringTransactionCreate = {
        category_id: values.categoryId,
        account_id: values.accountId || undefined,
        amount: Number(values.amount),
        type: values.type,
        description: values.description || undefined,
        frequency: values.frequency as RecurringFrequency,
        interval: Number(values.interval),
        anchor_date: values.anchor_date,
        end_date: values.end_date || undefined,
        monthly_mode: values.frequency === 'monthly' ? values.monthly_mode : undefined,
        by_weekday: values.by_weekday ? Number(values.by_weekday) : undefined,
        by_ordinal: values.by_ordinal ? Number(values.by_ordinal) : undefined,
      };
      await spendingService.createRecurring(payload);
    },
    mutationInvalidations.transaction,
    {
      successMessage: 'Recurring rule created',
      onSuccess: () => {
        setIsRecurringModalOpen(false);
        recurringForm.reset();
      },
    },
  );

  const updateRecurringMutation = useInvalidatingMutation(
    async (values: RecurringFormValues) => {
      if (!editingRecurring) return;
      const payload: RecurringTransactionUpdate = {
        account_id: values.accountId || null,
        amount: Number(values.amount),
        description: values.description || null,
        frequency: values.frequency as RecurringFrequency,
        interval: Number(values.interval),
        end_date: values.end_date || null,
        monthly_mode: values.frequency === 'monthly' ? values.monthly_mode : null,
        by_weekday: values.by_weekday ? Number(values.by_weekday) : null,
        by_ordinal: values.by_ordinal ? Number(values.by_ordinal) : null,
      };
      await spendingService.updateRecurring(editingRecurring.public_id, payload);
    },
    mutationInvalidations.transaction,
    {
      successMessage: 'Recurring rule updated',
      onSuccess: () => {
        setIsRecurringModalOpen(false);
        setEditingRecurring(null);
        recurringForm.reset();
      },
    },
  );

  const deactivateRecurringMutation = useInvalidatingMutation(
    async (ruleId: string) => {
      await spendingService.deleteRecurring(ruleId);
    },
    mutationInvalidations.transaction,
    {
      successMessage: 'Recurring rule deactivated',
      onSuccess: () => {
        setRecurringPendingDeactivate(null);
      },
    },
  );

  // Category mutations
  const createCategoryMutation = useInvalidatingMutation(
    async () => {
      if (!newCatName.trim()) throw new Error('Name is required');
      const cat = await spendingService.createCategory({
        name: newCatName.trim(),
        color: newCatColor || '#22c55e',
        icon: newCatIcon || undefined,
      });
      if (newCatGroupId) {
        await spendingService.updateCategory(cat.public_id, {
          category_group_id: newCatGroupId,
        });
      }
    },
    mutationInvalidations.transaction,
    {
      successMessage: 'Category created',
      onSuccess: () => {
        setNewCatName('');
        setNewCatIcon('');
        setNewCatGroupId('');
      },
    },
  );

  // Tag mutations
  const createTagMutation = useInvalidatingMutation(
    async () => {
      if (!newTagName.trim()) throw new Error('Tag name is required');
      await spendingService.createTag({
        name: newTagName.trim(),
        color: newTagColor,
      });
    },
    mutationInvalidations.transaction,
    {
      successMessage: 'Tag created',
      onSuccess: () => {
        setNewTagName('');
      },
    },
  );

  const deleteTagMutation = useInvalidatingMutation(
    async (tagId: string) => {
      await spendingService.deleteTag(tagId);
    },
    mutationInvalidations.transaction,
    {
      successMessage: 'Tag deleted',
    },
  );

  const openRecurringModalForNew = () => {
    setEditingRecurring(null);
    recurringForm.reset({
      categoryId: categories[0]?.public_id ?? '',
      accountId: spendingAccounts[0]?.public_id ?? '',
      amount: '',
      type: 'expense',
      description: '',
      frequency: 'monthly',
      interval: '1',
      anchor_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      monthly_mode: 'day_of_month',
      by_weekday: '',
      by_ordinal: '',
    });
    setIsRecurringModalOpen(true);
  };

  const openRecurringModalForEdit = (r: RecurringTransaction) => {
    setEditingRecurring(r);
    recurringForm.reset({
      categoryId: r.category_id,
      accountId: r.account_id ?? '',
      amount: String(r.amount),
      type: r.type,
      description: r.description ?? '',
      frequency: (r.frequency as RecurringFrequency) || 'monthly',
      interval: String(r.interval),
      anchor_date: r.anchor_date,
      end_date: r.end_date ?? '',
      monthly_mode: r.monthly_mode ?? 'day_of_month',
      by_weekday: r.by_weekday !== null ? String(r.by_weekday) : '',
      by_ordinal: r.by_ordinal !== null ? String(r.by_ordinal) : '',
    });
    setIsRecurringModalOpen(true);
  };

  const openBudgetModalForNew = () => {
    setEditingBudget(null);
    budgetForm.reset({
      scope: 'category',
      categoryId: categories[0]?.public_id ?? '',
      groupId: categoryGroups[0]?.public_id ?? '',
      startMonth: budgetsMonth,
      endMonth: '',
      amount: '',
    });
    setIsBudgetModalOpen(true);
  };

  const openBudgetModalForEdit = (b: Budget) => {
    setEditingBudget(b);
    budgetForm.reset({
      scope: b.category_group_id ? 'group' : 'category',
      categoryId: b.category_id ?? '',
      groupId: b.category_group_id ?? '',
      startMonth: b.start_month,
      endMonth: b.end_month ?? '',
      amount: String(b.amount),
    });
    setIsBudgetModalOpen(true);
  };

  const tabStripRef = useRef<HTMLDivElement>(null);
  const [tabOverflow, setTabOverflow] = useState({ start: false, end: false });

  useEffect(() => {
    const el = tabStripRef.current;
    if (!el) return;
    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setTabOverflow({
        start: el.scrollLeft > 4,
        end: maxScroll - el.scrollLeft > 4,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [activeTab]);

  const monthSpent = summaryQuery.data?.expense_total ?? 0;
  const monthIncome = summaryQuery.data?.income_total ?? 0;
  const activeRecurringCount = useMemo(
    () => recurringItems.filter((r) => r.is_active).length,
    [recurringItems],
  );

  return (
    <PageShell>
      <PageHero
        title="Spending Command Center"
        subtitle="Manage recurring rules, budget planning, spend pacing, and custom KPIs"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCategoriesModalOpen(true)}
              className="border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Categories
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsTagsModalOpen(true)}
              className="border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <Tag className="mr-1.5 h-3.5 w-3.5" />
              Tags
            </Button>
            {activeTab === 'recurring' && (
              <Button
                size="sm"
                onClick={openRecurringModalForNew}
                className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New Rule
              </Button>
            )}
            {activeTab === 'budgets' && (
              <Button
                size="sm"
                onClick={openBudgetModalForNew}
                className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New Budget
              </Button>
            )}
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Month Spent ({currentMonthValue})
            </span>
            <div className="rounded-xl bg-red-500/10 p-2 text-red-400">
              <ArrowDownCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-white">
            {formatCurrency(monthSpent, displayCurrency, currencyDisplayPreference, displayLocale, decimalPlaces)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Income: {formatCurrency(monthIncome, displayCurrency, currencyDisplayPreference, displayLocale, decimalPlaces)}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Recurring Rules
            </span>
            <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400">
              <Clock3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-white">
            {activeRecurringCount} <span className="text-sm font-normal text-slate-400">rules</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {recurringItems.length} total registered rules
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Budgets
            </span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-white">
            {budgets.length} <span className="text-sm font-normal text-slate-400">targets</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {categories.length} categories available
          </p>
        </div>
      </div>

      {/* 4-Tab Navigation Bar */}
      <div className="relative mb-6 sticky top-0 z-20 bg-slate-950/95 backdrop-blur">
        {tabOverflow.start && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-slate-950 to-transparent"
          />
        )}
        {tabOverflow.end && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-gradient-to-l from-slate-950 to-transparent pb-px"
          >
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </div>
        )}
        <div
          ref={tabStripRef}
          className="flex gap-2 overflow-x-auto border-b border-slate-700/50 pb-px py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            data-testid="spending-tab-recurring"
            onClick={() => setActiveTab('recurring')}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'recurring'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Recurring rules
          </button>
          <button
            data-testid="spending-tab-budgets"
            onClick={() => setActiveTab('budgets')}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'budgets'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Budgets
          </button>
          <button
            data-testid="spending-tab-kpis"
            onClick={() => setActiveTab('kpis')}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'kpis'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            KPIs
          </button>
          <button
            data-testid="spending-tab-analytics"
            onClick={() => setActiveTab('analytics')}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'analytics'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {recurringQuery.isLoading && activeTab === 'recurring' ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-cyan-500" />
        </div>
      ) : activeTab === 'budgets' &&
        ((budgetsDuration === 1 && budgetsQuery.isLoading) ||
          (budgetsDuration > 1 && budgetPerformanceQuery.isLoading)) ? (
        <SkeletonList rows={4} />
      ) : activeTab === 'recurring' ? (
        <RecurringTab
          recurringItems={recurringItems}
          recurringResponse={recurringResponse}
          displayCurrency={displayCurrency}
          currencyDisplayPreference={currencyDisplayPreference}
          getCategoryTheme={getCategoryTheme}
          onOpenNew={openRecurringModalForNew}
          onEdit={openRecurringModalForEdit}
          onRequestDeactivate={(rule) => setRecurringPendingDeactivate(rule)}
          deactivateMutationPending={deactivateRecurringMutation.isPending}
          pendingDeactivate={recurringPendingDeactivate}
          onCancelDeactivate={() => setRecurringPendingDeactivate(null)}
          onConfirmDeactivate={() => {
            if (recurringPendingDeactivate) {
              deactivateRecurringMutation.mutate(recurringPendingDeactivate.publicId);
            }
          }}
          onPageChange={setRecurringOffset}
        />
      ) : activeTab === 'budgets' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-700/50 bg-slate-800/20 p-4 animate-in fade-in duration-200">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Month
              </label>
              <div className="min-w-[220px] max-w-[260px]">
                <DropdownSelect
                  testId="spending-budgets-month"
                  value={budgetsMonth}
                  onChange={(value) => {
                    setBudgetsMonth(value);
                    setBudgetOffset(0);
                  }}
                  options={monthFilterOptions}
                  placeholder="Select month"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 sm:items-end">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Duration
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {[1, 3, 6, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => setBudgetsDuration(m)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      budgetsDuration === m
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-slate-800/40 text-slate-400 border border-transparent hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    {m === 1 ? '1 Month' : `${m} Months`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <BudgetsTab
            budgets={budgets}
            budgetsResponse={budgetsResponse}
            monthLabel={budgetsRange.label}
            spentByCategory={spentByCategory}
            spentByGroup={spentByGroup}
            displayCurrency={displayCurrency}
            currencyDisplayPreference={currencyDisplayPreference}
            getCategoryTheme={getCategoryTheme}
            getGroupTheme={getGroupTheme}
            onEdit={openBudgetModalForEdit}
            onPageChange={setBudgetOffset}
            onAddFirst={openBudgetModalForNew}
            isMultiMonth={budgetsDuration > 1}
            multiMonthBudgets={periodBudgets}
          />
        </div>
      ) : activeTab === 'kpis' ? (
        <KpisTab
          categoryOptions={categoryFilterOptions}
          categoryGroupOptions={categoryGroupOptions}
          accountOptions={accountOptions}
          currencyDisplayPreference={currencyDisplayPreference}
        />
      ) : activeTab === 'analytics' ? (
        <AnalyticsTab
          selectedMonth={analyticsMonth}
          onMonthChange={setAnalyticsMonth}
          monthOptions={monthFilterOptions}
          displayCurrency={displayCurrency}
          currencyDisplayPreference={currencyDisplayPreference}
        />
      ) : null}

      {/* Recurring Modal */}
      <Dialog
        open={isRecurringModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsRecurringModalOpen(false);
            setEditingRecurring(null);
            recurringForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecurring ? 'Edit Recurring Rule' : 'New Recurring Rule'}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 pt-2"
            onSubmit={recurringForm.handleSubmit((data) => {
              if (editingRecurring) {
                updateRecurringMutation.mutate(data);
              } else {
                createRecurringMutation.mutate(data);
              }
            })}
          >
            <div>
              <Label className="text-slate-300 text-xs mb-1 block">Category *</Label>
              <Controller
                control={recurringForm.control}
                name="categoryId"
                render={({ field }) => (
                  <DropdownSelect
                    options={categoryFilterOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select category"
                  />
                )}
              />
              {recurringForm.formState.errors.categoryId && (
                <p className="mt-1 text-xs text-red-400">
                  {recurringForm.formState.errors.categoryId.message}
                </p>
              )}
            </div>

            <div>
              <Label className="text-slate-300 text-xs mb-1 block">Account (Optional)</Label>
              <Controller
                control={recurringForm.control}
                name="accountId"
                render={({ field }) => (
                  <DropdownSelect
                    options={accountOptions}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Select account"
                    clearLabel="No specific account"
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Amount *</Label>
                <Controller
                  control={recurringForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormattedNumberInput
                      min="0.01"
                      step="0.01"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="0.00"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  )}
                />
                {recurringForm.formState.errors.amount && (
                  <p className="mt-1 text-xs text-red-400">
                    {recurringForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Type</Label>
                <Controller
                  control={recurringForm.control}
                  name="type"
                  render={({ field }) => (
                    <DropdownSelect
                      options={[
                        { value: 'expense', label: 'Expense' },
                        { value: 'income', label: 'Income' },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select type"
                    />
                  )}
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300 text-xs mb-1 block">Description</Label>
              <Input
                {...recurringForm.register('description')}
                placeholder="e.g. Netflix Subscription, Gym Membership"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Frequency</Label>
                <Controller
                  control={recurringForm.control}
                  name="frequency"
                  render={({ field }) => (
                    <DropdownSelect
                      options={[
                        { value: 'daily', label: 'Daily' },
                        { value: 'weekly', label: 'Weekly' },
                        { value: 'monthly', label: 'Monthly' },
                        { value: 'yearly', label: 'Yearly' },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select frequency"
                    />
                  )}
                />
              </div>

              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Interval</Label>
                <Input
                  type="number"
                  min="1"
                  {...recurringForm.register('interval')}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Start Date *</Label>
                <Controller
                  control={recurringForm.control}
                  name="anchor_date"
                  render={({ field }) => (
                    <DatePicker value={field.value} onChange={field.onChange} required />
                  )}
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1 block">End Date (Optional)</Label>
                <Controller
                  control={recurringForm.control}
                  name="end_date"
                  render={({ field }) => (
                    <DatePicker value={field.value || ''} onChange={field.onChange} />
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setIsRecurringModalOpen(false);
                  setEditingRecurring(null);
                  recurringForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white"
                disabled={
                  createRecurringMutation.isPending || updateRecurringMutation.isPending
                }
              >
                {createRecurringMutation.isPending || updateRecurringMutation.isPending
                  ? 'Saving...'
                  : editingRecurring
                  ? 'Update Rule'
                  : 'Create Rule'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Budget Modal */}
      <Dialog
        open={isBudgetModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsBudgetModalOpen(false);
            setEditingBudget(null);
            budgetForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Edit Budget' : 'New Budget'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 pt-2"
            onSubmit={budgetForm.handleSubmit((data) => {
              if (editingBudget) {
                updateBudgetMutation.mutate(data);
              } else {
                createBudgetMutation.mutate(data);
              }
            })}
          >
            <div>
              <Label className="text-slate-300 text-xs mb-1 block">Budget Scope</Label>
              <Controller
                control={budgetForm.control}
                name="scope"
                render={({ field }) => (
                  <DropdownSelect
                    options={[
                      { value: 'category', label: 'Single Category' },
                      { value: 'group', label: 'Category Group' },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!!editingBudget}
                    placeholder="Select scope"
                  />
                )}
              />
            </div>

            {budgetForm.watch('scope') === 'category' ? (
              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Category *</Label>
                <Controller
                  control={budgetForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <DropdownSelect
                      options={categoryFilterOptions}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Select category"
                      disabled={!!editingBudget}
                    />
                  )}
                />
                {budgetForm.formState.errors.categoryId && (
                  <p className="mt-1 text-xs text-red-400">
                    {budgetForm.formState.errors.categoryId.message}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Category Group *</Label>
                <Controller
                  control={budgetForm.control}
                  name="groupId"
                  render={({ field }) => (
                    <DropdownSelect
                      options={categoryGroupOptions}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Select category group"
                      disabled={!!editingBudget}
                    />
                  )}
                />
                {budgetForm.formState.errors.groupId && (
                  <p className="mt-1 text-xs text-red-400">
                    {budgetForm.formState.errors.groupId.message}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs mb-1 block">Start Month *</Label>
                <Controller
                  control={budgetForm.control}
                  name="startMonth"
                  render={({ field }) => (
                    <DropdownSelect
                      options={monthFilterOptions}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={!!editingBudget}
                      placeholder="Select start month"
                    />
                  )}
                />
              </div>

              <div>
                <Label className="text-slate-300 text-xs mb-1 block">End Month</Label>
                <Controller
                  control={budgetForm.control}
                  name="endMonth"
                  render={({ field }) => (
                    <DropdownSelect
                      options={[{ value: '', label: 'Ongoing (no end)' }, ...monthFilterOptions]}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Ongoing"
                    />
                  )}
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300 text-xs mb-1 block">Budget Amount ({displayCurrency}) *</Label>
              <Controller
                control={budgetForm.control}
                name="amount"
                render={({ field }) => (
                  <FormattedNumberInput
                    min="0.01"
                    step="0.01"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0.00"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                )}
              />
              {budgetForm.formState.errors.amount && (
                <p className="mt-1 text-xs text-red-400">
                  {budgetForm.formState.errors.amount.message}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-3">
              {editingBudget && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => deleteBudgetMutation.mutate(editingBudget.public_id)}
                  disabled={deleteBudgetMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setIsBudgetModalOpen(false);
                  setEditingBudget(null);
                  budgetForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white"
                disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
              >
                {createBudgetMutation.isPending || updateBudgetMutation.isPending
                  ? 'Saving...'
                  : editingBudget
                  ? 'Update Budget'
                  : 'Create Budget'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={isCategoriesModalOpen} onOpenChange={setIsCategoriesModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Create Category
              </h4>
              <Input
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-slate-400 text-xs mb-1 block">Color</Label>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="h-9 w-full rounded border border-slate-700 bg-slate-800 cursor-pointer"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs mb-1 block">Group (optional)</Label>
                  <DropdownSelect
                    options={categoryGroupOptions}
                    value={newCatGroupId}
                    onChange={setNewCatGroupId}
                    placeholder="No group"
                    clearLabel="No group"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => createCategoryMutation.mutate()}
                disabled={!newCatName.trim() || createCategoryMutation.isPending}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Add Category
              </Button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Existing Categories ({categories.length})
              </h4>
              {categories.map((cat) => (
                <div
                  key={cat.public_id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color ?? '#22c55e' }}
                    />
                    <span>{cat.name}</span>
                  </div>
                  {cat.category_group_id && (
                    <span className="text-xs text-slate-500">
                      {getGroupTheme(cat.category_group_id).name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tags Management Dialog */}
      <Dialog open={isTagsModalOpen} onOpenChange={setIsTagsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Create Tag
              </h4>
              <Input
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-sm"
              />
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Color</Label>
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-9 w-full rounded border border-slate-700 bg-slate-800 cursor-pointer"
                />
              </div>
              <Button
                size="sm"
                onClick={() => createTagMutation.mutate()}
                disabled={!newTagName.trim() || createTagMutation.isPending}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Add Tag
              </Button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Existing Tags ({tags.length})
              </h4>
              {tags.map((tag) => (
                <div
                  key={tag.public_id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{tag.name}</span>
                  </div>
                  <button
                    onClick={() => deleteTagMutation.mutate(tag.public_id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default SpendingPage;
