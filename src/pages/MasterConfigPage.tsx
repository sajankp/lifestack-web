import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financeService } from '../services/finance';
import { spendingService } from '../services/spending';
import { DropdownSelect } from '../components/DropdownSelect';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';

export const MasterConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card'>('wallet');
  const [newAccountCurrency, setNewAccountCurrency] = useState('');
  const [reportingCurrency, setReportingCurrency] = useState('');

  const { data: currencies = [] } = useQuery({
    queryKey: ['finance', 'currencies', 'master-config'],
    queryFn: () => financeService.getCurrencies(),
  });
  const { data: accountsResponse } = useQuery({
    queryKey: ['finance', 'accounts', 'master-config'],
    queryFn: () => financeService.getAccounts(200, 0),
  });
  const { data: settings } = useQuery({
    queryKey: ['finance', 'settings', 'master-config'],
    queryFn: () => financeService.getSettings(),
  });
  const { data: categoriesResponse } = useQuery({
    queryKey: ['categories', 'master-config'],
    queryFn: () => spendingService.getCategories(200, 0),
  });

  const accounts = accountsResponse?.items ?? [];
  const categories = categoriesResponse?.items ?? [];

  React.useEffect(() => {
    setReportingCurrency(settings?.reporting_currency_code ?? '');
  }, [settings?.reporting_currency_code]);

  const currencyOptions = useMemo(
    () => currencies.map((currency) => ({ value: currency.code, label: `${currency.code} ${currency.symbol ?? ''}`.trim() })),
    [currencies]
  );

  const accountTypeOptions = [
    { value: 'wallet', label: 'Wallet' },
    { value: 'bank', label: 'Bank' },
    { value: 'card', label: 'Card' },
    { value: 'gift_card', label: 'Gift Card' },
    { value: 'brokerage', label: 'Brokerage' },
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
      queryClient.invalidateQueries({ queryKey: ['finance', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'accounts', 'master-config'] });
    },
  });

  const toggleAccountActiveMutation = useMutation({
    mutationFn: (payload: { publicId: string; isActive: boolean }) =>
      financeService.updateAccount(payload.publicId, { is_active: payload.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'accounts', 'master-config'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: () =>
      financeService.updateSettings({
        reporting_currency_code: reportingCurrency || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'settings', 'master-config'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-summary'] });
    },
  });

  return (
    <div className="w-full px-8 py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Master Configuration</h1>
        <p className="mt-2 text-slate-400">
          Manage shared setup for spending/investing: currencies, accounts, categories, and recurrence anchors.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Workspace Currency</h2>
        <p className="mt-1 text-sm text-slate-400">
          This reporting currency drives default display in dashboard and spending. Investing still supports native multi-currency holdings.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr,auto]">
          <DropdownSelect
            value={reportingCurrency}
            onChange={setReportingCurrency}
            options={currencyOptions}
            placeholder="Select reporting currency"
            clearLabel="Unset reporting currency"
          />
          <Button type="button" onClick={() => updateSettingsMutation.mutate()} disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Accounts and Wallets</h2>
        <p className="mt-1 text-sm text-slate-400">
          Use these for spending source selection, transfer flows, and investing account linkage.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <Input
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="Account name"
          />
          <DropdownSelect
            value={newAccountType}
            onChange={(value) => setNewAccountType(value as 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card')}
            options={[...accountTypeOptions]}
            placeholder="Account type"
          />
          <DropdownSelect
            value={newAccountCurrency}
            onChange={setNewAccountCurrency}
            options={currencyOptions}
            placeholder="Default currency"
          />
          <Button
            type="button"
            onClick={() => createAccountMutation.mutate()}
            disabled={
              createAccountMutation.isPending || !newAccountName.trim() || !newAccountCurrency
            }
          >
            {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
          </Button>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm text-slate-300">
            <thead className="bg-slate-800/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Currency</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {accounts.map((account) => (
                <tr key={account.public_id}>
                  <td className="px-4 py-3">{account.name}</td>
                  <td className="px-4 py-3 capitalize">{account.account_type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{account.default_currency_code}</td>
                  <td className="px-4 py-3 text-right">
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
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Button>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-400" colSpan={4}>
                    No accounts configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Categories and Recurrence</h2>
        <p className="mt-1 text-sm text-slate-400">
          Categories and recurring rule operations stay in Spending for now; this section gives quick visibility.
        </p>
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
      </section>
    </div>
  );
};
