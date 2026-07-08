import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, Edit2 } from 'lucide-react';
import { financeService } from '../services/finance';
import { spendingService } from '../services/spending';
import { platformService } from '../services/platform';
import { AccountTypeBadge, CurrencyBadge, StatusBadge } from '../components/finance/Badges';
import { DropdownSelect } from '../components/DropdownSelect';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { queryKeys } from '../lib/queryKeys';

export const MasterConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card'>('wallet');
  const [newAccountCurrency, setNewAccountCurrency] = useState('');
  const [reportingCurrency, setReportingCurrency] = useState('');
  const [defaultSpendingAccountId, setDefaultSpendingAccountId] = useState('');
  const [lookthroughMinWeightPct, setLookthroughMinWeightPct] = useState('0.5');
  const [currencyDisplayPreference, setCurrencyDisplayPreference] = useState<'symbol' | 'code'>('symbol');
  const [userReportingCurrencyOverride, setUserReportingCurrencyOverride] = useState('');
  const [userDisplayPreferenceOverride, setUserDisplayPreferenceOverride] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountName, setEditingAccountName] = useState('');
  const [editingAccountType, setEditingAccountType] = useState<'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card'>('wallet');
  const [editingAccountCurrency, setEditingAccountCurrency] = useState('');
  const [editingAccountIsActive, setEditingAccountIsActive] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState('');
  const [editingCategoryIcon, setEditingCategoryIcon] = useState('');
  const [editingCategoryGroupId, setEditingCategoryGroupId] = useState('');
  const [accountPendingDelete, setAccountPendingDelete] = useState<{ publicId: string; name: string } | null>(null);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<{ publicId: string; name: string } | null>(null);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#64748b');
  const [newGroupIcon, setNewGroupIcon] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupColor, setEditingGroupColor] = useState('');
  const [editingGroupIcon, setEditingGroupIcon] = useState('');
  const [groupPendingDelete, setGroupPendingDelete] = useState<{ publicId: string; name: string } | null>(null);
  const [deleteGroupError, setDeleteGroupError] = useState<string | null>(null);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');

  const { activeWorkspace: currentWorkspace } = useActiveWorkspace(true);
  const activeWorkspaceId = currentWorkspace?.public_id;

  React.useEffect(() => {
    setEditingAccountId(null);
    setEditingAccountName('');
    setEditingAccountType('wallet');
    setEditingAccountCurrency('');
    setEditingAccountIsActive(true);
    setEditingCategoryId(null);
    setEditingCategoryName('');
    setEditingCategoryColor('');
    setEditingCategoryIcon('');
    setEditingCategoryGroupId('');
    setAccountPendingDelete(null);
    setCategoryPendingDelete(null);
    setDeleteCategoryError(null);
    setNewAccountName('');
    setResetStatus('idle');
    setIsConfirmResetOpen(false);
    setResetConfirmationText('');
    setEditingGroupId(null);
    setGroupPendingDelete(null);
    setDeleteGroupError(null);
    setIsMergeDialogOpen(false);
    setMergeTargetId('');
    setMergeSourceIds([]);
    setMergeError(null);
  }, [activeWorkspaceId]);

  const { data: demoResetStatus, isLoading: isDemoResetStatusLoading } = useQuery({
    queryKey: ['platform', 'demo-reset-status', activeWorkspaceId],
    queryFn: () => {
      if (!activeWorkspaceId) {
        throw new Error('Active workspace is required before loading demo reset status');
      }
      return platformService.getDemoResetStatus(activeWorkspaceId);
    },
    enabled: Boolean(activeWorkspaceId),
  });

  const { data: currencies = [] } = useQuery({
    queryKey: queryKeys.finance.currencies('master-config'),
    queryFn: () => financeService.getCurrencies(),
  });
  const { data: accountsResponse } = useQuery({
    queryKey: queryKeys.finance.accounts('master-config'),
    queryFn: () => financeService.getAccounts(200, 0),
  });
  const { data: settings } = useQuery({
    queryKey: queryKeys.finance.settings('master-config'),
    queryFn: () => financeService.getSettings(),
  });
  const { data: userSettings } = useQuery({
    queryKey: queryKeys.finance.settings('user'),
    queryFn: () => financeService.getUserSettings(),
  });
  const { data: categoriesResponse } = useQuery({
    queryKey: queryKeys.masterConfig.categories(),
    queryFn: () => spendingService.getCategories(200, 0),
  });
  const { data: groupsResponse } = useQuery({
    queryKey: queryKeys.masterConfig.categoryGroups(),
    queryFn: () => spendingService.getCategoryGroups(200, 0),
  });

  const accounts = accountsResponse?.items ?? [];
  const categories = categoriesResponse?.items ?? [];
  const categoryGroups = groupsResponse?.items ?? [];
  const groupById = useMemo(() => new Map(categoryGroups.map((g) => [g.public_id, g])), [categoryGroups]);
  const categoryGroupOptions = useMemo(
    () => categoryGroups.map((g) => ({ value: g.public_id, label: g.name })),
    [categoryGroups]
  );
  const categoryOptionsForMerge = useMemo(
    () => categories.map((c) => ({ value: c.public_id, label: c.name })),
    [categories]
  );

  React.useEffect(() => {
    setReportingCurrency(settings?.reporting_currency_code ?? '');
    setCurrencyDisplayPreference(settings?.currency_display_preference ?? 'symbol');
    setLookthroughMinWeightPct(String(settings?.lookthrough_min_weight_pct ?? '0.5'));
    setDefaultSpendingAccountId(settings?.default_spending_account_id ?? '');
  }, [
    settings?.reporting_currency_code,
    settings?.currency_display_preference,
    settings?.lookthrough_min_weight_pct,
    settings?.default_spending_account_id,
  ]);
  React.useEffect(() => {
    setUserReportingCurrencyOverride(userSettings?.reporting_currency_override_code ?? '');
    setUserDisplayPreferenceOverride(userSettings?.currency_display_preference_override ?? '');
  }, [userSettings?.reporting_currency_override_code, userSettings?.currency_display_preference_override]);

  const currencyOptions = useMemo(
    () => currencies.map((currency) => ({ value: currency.code, label: `${currency.code} ${currency.symbol ?? ''}`.trim() })),
    [currencies]
  );

  // The default spending account can't be a brokerage account (mirrors the
  // backend's InvestingOrderService brokerage-only check, inverted) and
  // deactivated accounts aren't eligible either (spec-054). Keyed off
  // accountsResponse?.items (not the derived `accounts`) so the memo is
  // stable across this page's frequent form-input re-renders.
  const defaultSpendingAccountOptions = useMemo(
    () =>
      (accountsResponse?.items ?? [])
        .filter((account) => account.is_active && account.account_type !== 'brokerage')
        .map((account) => ({
          value: account.public_id,
          label: `${account.name} (${account.account_type.replace('_', ' ')})`,
        })),
    [accountsResponse?.items]
  );

  const accountTypeOptions = [
    { value: 'wallet', label: 'Wallet' },
    { value: 'bank', label: 'Bank' },
    { value: 'card', label: 'Card' },
    { value: 'gift_card', label: 'Gift Card' },
    { value: 'brokerage', label: 'Brokerage' },
  ] as const;
  const currencyDisplayPreferenceOptions = [
    { value: 'symbol', label: 'Symbol first ($1,250.00)' },
    { value: 'code', label: 'Code first (USD 1,250.00)' },
  ] as const;
  const userDisplayPreferenceOptions = [
    { value: 'symbol', label: 'Override: Symbol first' },
    { value: 'code', label: 'Override: Code first' },
  ] as const;

  const createAccountMutation = useMutation({
    mutationFn: () =>
      financeService.createAccount({
        name: newAccountName.trim(),
        account_type: newAccountType,
        default_currency_code: newAccountCurrency,
      }),
    onSuccess: () => {
      setNewAccountName('');
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts('master-config') });
    },
  });

  const toggleAccountActiveMutation = useMutation({
    mutationFn: (payload: { publicId: string; isActive: boolean }) =>
      financeService.updateAccount(payload.publicId, { is_active: payload.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts('master-config') });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: () =>
      financeService.updateAccount(editingAccountId!, {
        name: editingAccountName.trim(),
        account_type: editingAccountType,
        default_currency_code: editingAccountCurrency,
        is_active: editingAccountIsActive,
      }),
    onSuccess: () => {
      setEditingAccountId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts('master-config') });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.settings() });
    },
  });
  const deleteAccountMutation = useMutation({
    mutationFn: (publicId: string) => financeService.deleteAccount(publicId),
    onSuccess: (_, publicId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.accounts('master-config') });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.settings() });
      if (editingAccountId === publicId) {
        setEditingAccountId(null);
      }
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: () =>
      spendingService.updateCategory(editingCategoryId!, {
        name: editingCategoryName.trim() || undefined,
        color: editingCategoryColor.trim() || null,
        icon: editingCategoryIcon.trim() || null,
        category_group_id: editingCategoryGroupId || null,
      }),
    onSuccess: () => {
      setEditingCategoryId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.masterConfig.categories() });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (publicId: string) => spendingService.deleteCategory(publicId),
    onSuccess: (_, publicId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.masterConfig.categories() });
      if (editingCategoryId === publicId) {
        setEditingCategoryId(null);
      }
      setCategoryPendingDelete(null);
      setDeleteCategoryError(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to delete category');
      setDeleteCategoryError(msg);
    },
  });

  const mergeCategoriesMutation = useMutation({
    mutationFn: () =>
      spendingService.mergeCategories(mergeTargetId, { source_public_ids: mergeSourceIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.masterConfig.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.budgets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.recurring() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      setIsMergeDialogOpen(false);
      setMergeTargetId('');
      setMergeSourceIds([]);
      setMergeError(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to merge categories');
      setMergeError(msg);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: () =>
      spendingService.createCategoryGroup({
        name: newGroupName.trim(),
        color: newGroupColor.trim() || null,
        icon: newGroupIcon.trim() || null,
      }),
    onSuccess: () => {
      setNewGroupName('');
      setNewGroupIcon('');
      queryClient.invalidateQueries({ queryKey: queryKeys.masterConfig.categoryGroups() });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: () =>
      spendingService.updateCategoryGroup(editingGroupId!, {
        name: editingGroupName.trim() || undefined,
        color: editingGroupColor.trim() || null,
        icon: editingGroupIcon.trim() || null,
      }),
    onSuccess: () => {
      setEditingGroupId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.masterConfig.categoryGroups() });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (publicId: string) => spendingService.deleteCategoryGroup(publicId),
    onSuccess: (_, publicId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masterConfig.categoryGroups() });
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.masterConfig.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.budgets() });
      if (editingGroupId === publicId) {
        setEditingGroupId(null);
      }
      setGroupPendingDelete(null);
      setDeleteGroupError(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to delete group');
      setDeleteGroupError(msg);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: () =>
      financeService.updateSettings({
        reporting_currency_code: reportingCurrency || null,
        lookthrough_min_weight_pct: lookthroughMinWeightPct,
        currency_display_preference: currencyDisplayPreference,
        default_spending_account_id: defaultSpendingAccountId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.settings() });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.settings('master-config') });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.settings('workspace') });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.summary() });
    },
  });
  const updateUserSettingsMutation = useMutation({
    mutationFn: () =>
      financeService.updateUserSettings({
        reporting_currency_override_code: userReportingCurrencyOverride || null,
        currency_display_preference_override:
          userDisplayPreferenceOverride === ''
            ? null
            : (userDisplayPreferenceOverride as 'symbol' | 'code'),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.settings('user') });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.spending.summary() });
      queryClient.invalidateQueries({ queryKey: queryKeys.investing.all });
    },
  });

  const openAccountEditor = (account: typeof accounts[number]) => {
    setEditingAccountId(account.public_id);
    setEditingAccountName(account.name);
    setEditingAccountType(account.account_type);
    setEditingAccountCurrency(account.default_currency_code);
    setEditingAccountIsActive(account.is_active);
  };

  const openCategoryEditor = (category: typeof categories[number]) => {
    setEditingCategoryId(category.public_id);
    setEditingCategoryName(category.name);
    setEditingCategoryColor(category.color ?? '#64748b');
    setEditingCategoryIcon(category.icon ?? '');
    setEditingCategoryGroupId(category.category_group_id ?? '');
  };

  const openGroupEditor = (group: typeof categoryGroups[number]) => {
    setEditingGroupId(group.public_id);
    setEditingGroupName(group.name);
    setEditingGroupColor(group.color ?? '#64748b');
    setEditingGroupIcon(group.icon ?? '');
  };

  const toggleMergeSource = (publicId: string) => {
    setMergeSourceIds((prev) =>
      prev.includes(publicId) ? prev.filter((id) => id !== publicId) : [...prev, publicId]
    );
  };

  const confirmDeleteGroup = () => {
    if (!groupPendingDelete) return;
    deleteGroupMutation.mutate(groupPendingDelete.publicId);
  };

  const confirmDeleteAccount = () => {
    if (!accountPendingDelete) return;
    deleteAccountMutation.mutate(accountPendingDelete.publicId, {
      onSuccess: () => setAccountPendingDelete(null),
    });
  };

  const confirmDeleteCategory = () => {
    if (!categoryPendingDelete) return;
    deleteCategoryMutation.mutate(categoryPendingDelete.publicId);
  };

  const performResetDemoData = async () => {
    if (!currentWorkspace || !demoResetStatus?.allowed) return;
    setIsResetting(true);
    setResetStatus('idle');
    try {
      await platformService.resetDemoData(currentWorkspace.public_id);
      setResetStatus('success');
      setResetConfirmationText('');
      void queryClient.invalidateQueries();
    } catch (err) {
      console.error(err);
      setResetStatus('error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <PageShell className="space-y-6">
      <PageHero
        title="Settings"
        subtitle="Manage shared setup for spending and investing: currencies, accounts, categories, and recurrence anchors."
      />

      <Tabs defaultValue="currency">
        <TabsList>
          <TabsTrigger value="currency" data-testid="settings-tab-currency">Currency & Display</TabsTrigger>
          <TabsTrigger value="accounts" data-testid="settings-tab-accounts">Accounts</TabsTrigger>
          <TabsTrigger value="categories" data-testid="settings-tab-categories">Categories & Groups</TabsTrigger>
          <TabsTrigger value="danger" data-testid="settings-tab-danger">Danger zone</TabsTrigger>
        </TabsList>

        <TabsContent value="currency" className="space-y-6">
      <section data-testid="master-workspace-settings" className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Workspace Currency</h2>
        <p className="mt-1 text-sm text-slate-400">
          This reporting currency drives default display in dashboard and spending. Investing still supports native multi-currency holdings.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
          <DropdownSelect
            testId="master-workspace-currency"
            value={reportingCurrency}
            onChange={setReportingCurrency}
            options={currencyOptions}
            placeholder="Select reporting currency"
            clearLabel="Unset reporting currency"
          />
          <DropdownSelect
            testId="master-workspace-display-preference"
            value={currencyDisplayPreference}
            onChange={(value) => setCurrencyDisplayPreference(value as 'symbol' | 'code')}
            options={[...currencyDisplayPreferenceOptions]}
            placeholder="Display preference"
          />
          <Button
            data-testid="master-workspace-save"
            type="button"
            onClick={() => updateSettingsMutation.mutate()}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <div className="mt-4 border-t border-slate-800 pt-4">
          <Label className="text-sm text-slate-300">Default spending account</Label>
          <p className="mt-1 text-xs text-slate-500">
            New spending transactions use this account when none is picked on the form.
          </p>
          <div className="mt-2 max-w-sm">
            <DropdownSelect
              testId="master-default-spending-account"
              value={defaultSpendingAccountId}
              onChange={setDefaultSpendingAccountId}
              options={defaultSpendingAccountOptions}
              placeholder="No default"
              clearLabel="No default"
              showSearch
            />
          </div>
        </div>
      </section>

      <section data-testid="master-investing-settings" className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Investing</h2>
        <p className="mt-1 text-sm text-slate-400">
          Constituents below this portfolio weight are hidden from detail lists only. Totals,
          concentration, and overlap calculations still use every constituent.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,auto] max-w-md">
          <label className="space-y-1 text-sm text-slate-300">
            <span>Minimum constituent weight (%)</span>
            <input
              data-testid="master-lookthrough-threshold"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={lookthroughMinWeightPct}
              onChange={(event) => setLookthroughMinWeightPct(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
            />
          </label>
          <Button
            type="button"
            className="self-end"
            onClick={() => updateSettingsMutation.mutate()}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </section>

      <section data-testid="master-user-overrides" className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">My Display Overrides</h2>
        <p className="mt-1 text-sm text-slate-400">
          Optional per-user overrides. Leave blank to inherit workspace defaults.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,1fr,auto]">
          <DropdownSelect
            testId="master-user-currency-override"
            value={userReportingCurrencyOverride}
            onChange={setUserReportingCurrencyOverride}
            options={currencyOptions}
            placeholder="Inherit workspace currency"
            clearLabel="Inherit workspace currency"
          />
          <DropdownSelect
            testId="master-user-display-override"
            value={userDisplayPreferenceOverride}
            onChange={setUserDisplayPreferenceOverride}
            options={[...userDisplayPreferenceOptions]}
            placeholder="Inherit workspace display style"
            clearLabel="Inherit workspace display style"
          />
          <Button
            data-testid="master-user-save-override"
            type="button"
            onClick={() => updateUserSettingsMutation.mutate()}
            disabled={updateUserSettingsMutation.isPending}
          >
            {updateUserSettingsMutation.isPending ? 'Saving...' : 'Save Override'}
          </Button>
        </div>
        {userSettings ? (
          <p className="mt-3 text-xs text-slate-500">
            Effective now: {(userSettings.effective_reporting_currency_code ?? 'Unconfigured')} / {userSettings.effective_currency_display_preference}
          </p>
        ) : null}
      </section>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
      <section data-testid="master-accounts-section" className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Accounts and Wallets</h2>
        <p className="mt-1 text-sm text-slate-400">
          Use these for spending source selection, transfer flows, and investing account linkage.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <Input
            data-testid="master-account-name"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="Account name"
          />
          <DropdownSelect
            testId="master-account-type"
            value={newAccountType}
            onChange={(value) => setNewAccountType(value as 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card')}
            options={[...accountTypeOptions]}
            placeholder="Account type"
          />
          <DropdownSelect
            testId="master-account-currency"
            value={newAccountCurrency}
            onChange={setNewAccountCurrency}
            options={currencyOptions}
            placeholder="Default currency"
          />
          <Button
            data-testid="master-account-create"
            type="button"
            onClick={() => createAccountMutation.mutate()}
            disabled={
              createAccountMutation.isPending || !newAccountName.trim() || !newAccountCurrency
            }
          >
            {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
          </Button>
        </div>

        {editingAccountId ? (
          <div data-testid="master-account-editor" className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Edit account</h3>
              <button
                type="button"
                onClick={() => setEditingAccountId(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-5">
              <Input
                data-testid="master-account-edit-name"
                value={editingAccountName}
                onChange={(e) => setEditingAccountName(e.target.value)}
                placeholder="Account name"
              />
              <DropdownSelect
                testId="master-account-edit-type"
                value={editingAccountType}
                onChange={(value) => setEditingAccountType(value as 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card')}
                options={[...accountTypeOptions]}
                placeholder="Account type"
              />
              <DropdownSelect
                testId="master-account-edit-currency"
                value={editingAccountCurrency}
                onChange={setEditingAccountCurrency}
                options={currencyOptions}
                placeholder="Default currency"
              />
              <DropdownSelect
                testId="master-account-edit-status"
                value={editingAccountIsActive ? 'active' : 'inactive'}
                onChange={(value) => setEditingAccountIsActive(value === 'active')}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                placeholder="Status"
              />
              <Button
                data-testid="master-account-save"
                type="button"
                onClick={() => updateAccountMutation.mutate()}
                disabled={
                  updateAccountMutation.isPending ||
                  !editingAccountName.trim() ||
                  !editingAccountCurrency
                }
              >
                {updateAccountMutation.isPending ? 'Saving...' : 'Save Account'}
              </Button>
              {updateAccountMutation.isError ? (
                <p className="text-sm text-rose-400">Failed to save account. Please try again.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-slate-300 min-w-[800px]">
            <thead className="bg-slate-800/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Currency</th>
                <th className="px-4 py-3 text-right font-medium">Edit</th>
                <th className="px-4 py-3 text-right font-medium">Delete</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {accounts.map((account) => (
                <tr key={account.public_id} data-testid={`master-account-row-${account.public_id}`}>
                  <td className="px-4 py-3">{account.name}</td>
                  <td className="px-4 py-3">
                    <AccountTypeBadge type={account.account_type} />
                  </td>
                  <td className="px-4 py-3">
                    <CurrencyBadge code={account.default_currency_code} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openAccountEditor(account)}
                      data-testid={`master-account-edit-${account.public_id}`}
                      className="inline-flex items-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                      title="Edit account"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 px-3 text-rose-300 hover:text-rose-200"
                      onClick={() =>
                        setAccountPendingDelete({ publicId: account.public_id, name: account.name })
                      }
                      disabled={deleteAccountMutation.isPending}
                    >
                      Delete
                    </Button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <StatusBadge active={account.is_active} />
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 px-3"
                        onClick={() =>
                          toggleAccountActiveMutation.mutate({
                            publicId: account.public_id,
                            isActive: !account.is_active,
                          })
                        }
                        disabled={toggleAccountActiveMutation.isPending}
                      >
                        {account.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-400" colSpan={6}>
                    No accounts configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
      <section data-testid="master-categories-section" className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Categories</h2>
            <p className="mt-1 text-sm text-slate-400">
              Rename, recolor, regroup, and merge spending categories. Recurring rules are managed in Spending.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            data-testid="master-category-merge-open"
            onClick={() => {
              setMergeError(null);
              setMergeTargetId('');
              setMergeSourceIds([]);
              setIsMergeDialogOpen(true);
            }}
            disabled={categories.length < 2}
          >
            Merge Categories
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <Label className="text-slate-400">Total categories</Label>
            <p className="mt-2 text-2xl font-semibold text-white">{categories.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <Label className="text-slate-400">System categories</Label>
            <p className="mt-2 text-2xl font-semibold text-white">
              {categories.filter((category) => category.is_system).length}
            </p>
          </div>
        </div>

        {editingCategoryId ? (
          <div data-testid="master-category-editor" className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Edit category</h3>
              <button
                type="button"
                onClick={() => setEditingCategoryId(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              <Input
                data-testid="master-category-edit-name"
                value={editingCategoryName}
                onChange={(e) => setEditingCategoryName(e.target.value)}
                placeholder="Category name"
              />
              <Input
                data-testid="master-category-edit-color"
                type="color"
                value={editingCategoryColor}
                onChange={(e) => setEditingCategoryColor(e.target.value)}
              />
              <Input
                data-testid="master-category-edit-icon"
                value={editingCategoryIcon}
                onChange={(e) => setEditingCategoryIcon(e.target.value)}
                placeholder="e.g. 🛒"
              />
              <DropdownSelect
                testId="master-category-edit-group"
                value={editingCategoryGroupId}
                onChange={setEditingCategoryGroupId}
                options={categoryGroupOptions}
                placeholder="No group"
                clearLabel="No group"
              />
              <Button
                data-testid="master-category-save"
                type="button"
                onClick={() => updateCategoryMutation.mutate()}
                disabled={updateCategoryMutation.isPending || !editingCategoryName.trim()}
              >
                {updateCategoryMutation.isPending ? 'Saving...' : 'Save Category'}
              </Button>
              {updateCategoryMutation.isError ? (
                <p className="text-sm text-rose-400">Failed to save category. Please try again.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-slate-300 min-w-[700px]">
            <thead className="bg-slate-800/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Color</th>
                <th className="px-4 py-3 text-left font-medium">Icon</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Group</th>
                <th className="px-4 py-3 text-right font-medium">Edit</th>
                <th className="px-4 py-3 text-right font-medium">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {categories.map((category) => (
                <tr key={category.public_id} data-testid={`master-category-row-${category.public_id}`}>
                  <td className="px-4 py-3">{category.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: category.color ?? '#64748b' }} />
                      <span className="text-slate-400">{category.color ?? '-'}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{category.icon ?? '-'}</td>
                  <td className="px-4 py-3">{category.is_system ? 'System' : 'Custom'}</td>
                  <td className="px-4 py-3">
                    {category.category_group_id
                      ? groupById.get(category.category_group_id)?.name ?? '-'
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openCategoryEditor(category)}
                      data-testid={`master-category-edit-${category.public_id}`}
                      className="inline-flex items-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                      title="Edit category"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 px-3 text-rose-300 hover:text-rose-200"
                      onClick={() => {
                        setDeleteCategoryError(null);
                        setCategoryPendingDelete({ publicId: category.public_id, name: category.name });
                      }}
                      disabled={deleteCategoryMutation.isPending}
                      title="Delete category"
                      data-testid={`master-category-delete-${category.public_id}`}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-400" colSpan={7}>
                    No categories configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section data-testid="master-category-groups-section" className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Category Groups</h2>
        <p className="mt-1 text-sm text-slate-400">
          Group related categories together for combined budgets and dashboard rollups. Deleting a
          group un-groups its categories rather than deleting them.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <Input
            data-testid="master-group-name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name"
          />
          <Input
            data-testid="master-group-color"
            type="color"
            value={newGroupColor}
            onChange={(e) => setNewGroupColor(e.target.value)}
          />
          <Input
            data-testid="master-group-icon"
            value={newGroupIcon}
            onChange={(e) => setNewGroupIcon(e.target.value)}
            placeholder="e.g. 🏠"
          />
          <Button
            data-testid="master-group-create"
            type="button"
            onClick={() => createGroupMutation.mutate()}
            disabled={createGroupMutation.isPending || !newGroupName.trim()}
          >
            {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
        {createGroupMutation.isError ? (
          <p className="mt-2 text-sm text-rose-400">Failed to create group. Please try again.</p>
        ) : null}

        {editingGroupId ? (
          <div data-testid="master-group-editor" className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Edit group</h3>
              <button
                type="button"
                onClick={() => setEditingGroupId(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                data-testid="master-group-edit-name"
                value={editingGroupName}
                onChange={(e) => setEditingGroupName(e.target.value)}
                placeholder="Group name"
              />
              <Input
                data-testid="master-group-edit-color"
                type="color"
                value={editingGroupColor}
                onChange={(e) => setEditingGroupColor(e.target.value)}
              />
              <Input
                data-testid="master-group-edit-icon"
                value={editingGroupIcon}
                onChange={(e) => setEditingGroupIcon(e.target.value)}
                placeholder="e.g. 🏠"
              />
              <Button
                data-testid="master-group-save"
                type="button"
                onClick={() => updateGroupMutation.mutate()}
                disabled={updateGroupMutation.isPending || !editingGroupName.trim()}
              >
                {updateGroupMutation.isPending ? 'Saving...' : 'Save Group'}
              </Button>
              {updateGroupMutation.isError ? (
                <p className="text-sm text-rose-400">Failed to save group. Please try again.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-slate-300 min-w-[600px]">
            <thead className="bg-slate-800/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Color</th>
                <th className="px-4 py-3 text-left font-medium">Icon</th>
                <th className="px-4 py-3 text-left font-medium">Categories</th>
                <th className="px-4 py-3 text-right font-medium">Edit</th>
                <th className="px-4 py-3 text-right font-medium">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {categoryGroups.map((group) => (
                <tr key={group.public_id} data-testid={`master-group-row-${group.public_id}`}>
                  <td className="px-4 py-3">{group.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: group.color ?? '#64748b' }} />
                      <span className="text-slate-400">{group.color ?? '-'}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{group.icon ?? '-'}</td>
                  <td className="px-4 py-3">
                    {categories.filter((c) => c.category_group_id === group.public_id).length}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openGroupEditor(group)}
                      data-testid={`master-group-edit-${group.public_id}`}
                      className="inline-flex items-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                      title="Edit group"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 px-3 text-rose-300 hover:text-rose-200"
                      onClick={() => {
                        setDeleteGroupError(null);
                        setGroupPendingDelete({ publicId: group.public_id, name: group.name });
                      }}
                      disabled={deleteGroupMutation.isPending}
                      title="Delete group"
                      data-testid={`master-group-delete-${group.public_id}`}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {categoryGroups.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-400" colSpan={6}>
                    No category groups yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
        </TabsContent>

        <TabsContent value="danger" className="space-y-6">
      {currentWorkspace ? (
        <details
          data-testid="master-demo-reset-section"
          className="group rounded-2xl border border-rose-900/50 bg-rose-950/10 p-6"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-lg font-semibold text-rose-200">
              <AlertTriangle className="h-5 w-5" />
              Demo Data & Reset
            </span>
            <ChevronDown className="h-4 w-4 text-rose-300 transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-3 text-sm text-rose-200/80">
            Reset <strong>{currentWorkspace.name}</strong> to seed a clean, deterministic mock dataset (including demo transactions, budgets, instruments, holdings, and notifications). <strong>Warning:</strong> This will delete all current accounts, transactions, and holdings in this workspace.
          </p>
          <div className="mt-4">
            <Button
              data-testid="master-demo-reset-button"
              type="button"
              className="bg-rose-600 hover:bg-rose-500 hover:shadow-rose-500/40 shadow-rose-500/20 text-white"
              onClick={() => {
                setResetConfirmationText('');
                setIsConfirmResetOpen(true);
              }}
              disabled={isResetting || !demoResetStatus?.allowed}
            >
              {isResetting ? 'Resetting Workspace...' : 'Reset & Seed Demo Data'}
            </Button>
            {isDemoResetStatusLoading ? (
              <p className="mt-2 text-xs text-slate-500">Loading reset status...</p>
            ) : null}
            {demoResetStatus && !demoResetStatus.allowed ? (
              <p className="mt-2 text-xs text-rose-400">
                {demoResetStatus.reason ?? 'You do not have permission to reset this workspace.'}
              </p>
            ) : null}
            {resetStatus === 'success' && (
              <div className="mt-3 rounded-lg border border-emerald-600/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                Workspace successfully reset and seeded with demo data!
              </div>
            )}
            {resetStatus === 'error' && (
              <div className="mt-3 rounded-lg border border-rose-600/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                Failed to reset workspace. Please try again.
              </div>
            )}
          </div>
        </details>
      ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={!!accountPendingDelete} onOpenChange={(open) => !open && setAccountPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              {accountPendingDelete
                ? `Delete account "${accountPendingDelete.name}"? This cannot be undone.`
                : 'This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAccountPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-rose-300 hover:text-rose-200"
              onClick={confirmDeleteAccount}
              disabled={deleteAccountMutation.isPending}
            >
              {deleteAccountMutation.isPending ? 'Deleting...' : 'Delete account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!categoryPendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setCategoryPendingDelete(null);
            setDeleteCategoryError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              {categoryPendingDelete
                ? `Delete category "${categoryPendingDelete.name}"? This cannot be undone.`
                : 'This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          {deleteCategoryError ? (
            <p className="text-sm text-rose-400" data-testid="master-category-delete-error">
              {deleteCategoryError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCategoryPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-rose-300 hover:text-rose-200"
              onClick={confirmDeleteCategory}
              disabled={deleteCategoryMutation.isPending}
              data-testid="master-category-delete-confirm"
            >
              {deleteCategoryMutation.isPending ? 'Deleting...' : 'Delete category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!groupPendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setGroupPendingDelete(null);
            setDeleteGroupError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete group?</DialogTitle>
            <DialogDescription>
              {groupPendingDelete
                ? `Delete group "${groupPendingDelete.name}"? Its categories will be un-grouped, not deleted.`
                : 'Its categories will be un-grouped, not deleted.'}
            </DialogDescription>
          </DialogHeader>
          {deleteGroupError ? (
            <p className="text-sm text-rose-400" data-testid="master-group-delete-error">
              {deleteGroupError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setGroupPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-rose-300 hover:text-rose-200"
              onClick={confirmDeleteGroup}
              disabled={deleteGroupMutation.isPending}
              data-testid="master-group-delete-confirm"
            >
              {deleteGroupMutation.isPending ? 'Deleting...' : 'Delete group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isMergeDialogOpen}
        onOpenChange={(open) => {
          setIsMergeDialogOpen(open);
          if (!open) {
            setMergeTargetId('');
            setMergeSourceIds([]);
            setMergeError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge categories</DialogTitle>
            <DialogDescription>
              Pick a target category and one or more source categories. All transactions, budgets,
              and recurring rules on the sources move onto the target; overlapping budgets are
              summed; the sources are then deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Merge into</Label>
              <DropdownSelect
                testId="master-merge-target"
                value={mergeTargetId}
                onChange={(value) => {
                  setMergeTargetId(value);
                  setMergeSourceIds((prev) => prev.filter((id) => id !== value));
                }}
                options={categoryOptionsForMerge}
                placeholder="Select target category"
                showSearch
              />
            </div>
            <div>
              <Label className="mb-2 block">Sources to merge (and delete)</Label>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-800 p-3">
                {categories
                  .filter((category) => category.public_id !== mergeTargetId)
                  .map((category) => (
                    <label
                      key={category.public_id}
                      className="flex items-center gap-2 text-sm text-slate-300"
                      data-testid={`master-merge-source-${category.public_id}`}
                    >
                      <input
                        type="checkbox"
                        checked={mergeSourceIds.includes(category.public_id)}
                        onChange={() => toggleMergeSource(category.public_id)}
                      />
                      {category.name}
                    </label>
                  ))}
                {categories.length < 2 ? (
                  <p className="text-sm text-slate-500">Need at least two categories to merge.</p>
                ) : null}
              </div>
            </div>
            {mergeError ? (
              <p className="text-sm text-rose-400" data-testid="master-merge-error">
                {mergeError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-500 hover:shadow-rose-500/40 shadow-rose-500/20 text-white"
              onClick={() => mergeCategoriesMutation.mutate()}
              disabled={mergeCategoriesMutation.isPending || !mergeTargetId || mergeSourceIds.length === 0}
              data-testid="master-merge-confirm"
            >
              {mergeCategoriesMutation.isPending ? 'Merging...' : 'Merge categories'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmResetOpen} onOpenChange={setIsConfirmResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset {currentWorkspace?.name ?? 'workspace'}?</DialogTitle>
            <DialogDescription>
              This action will permanently delete all accounts, transactions, budgets, holdings, cash balances, and tasks in {currentWorkspace?.name ?? 'this workspace'}. It will seed deterministic demo data in their place. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="demo-reset-confirmation">Type the workspace name to confirm</Label>
            <Input
              id="demo-reset-confirmation"
              data-testid="master-demo-reset-confirmation"
              value={resetConfirmationText}
              onChange={(event) => setResetConfirmationText(event.target.value)}
              placeholder={currentWorkspace?.name ?? 'Workspace name'}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsConfirmResetOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-500 hover:shadow-rose-500/40 shadow-rose-500/20 text-white"
              onClick={() => {
                setIsConfirmResetOpen(false);
                void performResetDemoData();
              }}
              disabled={
                isResetting ||
                !currentWorkspace ||
                !demoResetStatus?.allowed ||
                resetConfirmationText !== currentWorkspace.name
              }
            >
              {isResetting ? 'Resetting...' : 'Reset & Seed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};
