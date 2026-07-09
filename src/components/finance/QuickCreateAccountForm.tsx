import React from 'react';
import { DropdownSelect } from '../DropdownSelect';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { accountTypeOptions } from '../../utils/accountTypes';
import type { AccountType } from '../../types/finance';

type QuickCreateAccountFormProps = {
  name: string;
  onNameChange: (value: string) => void;
  type: AccountType;
  onTypeChange: (value: AccountType) => void;
  currency?: string;
  onCurrencyChange?: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  isError?: boolean;
  errorMessage?: string;
  testIdPrefix?: string;
  /** Restrict selectable account types (e.g. Spending excludes 'brokerage', since those accounts wouldn't show up in its own account lists). Defaults to the full list. */
  allowedTypes?: AccountType[];
};

/**
 * Shared "create an account without leaving the current form" sub-form, used
 * inline (never as a stacked modal-on-modal) wherever a create flow needs to
 * spin up an account on the fly — e.g. the Spending transaction modal and
 * Investing's Add Cash Balance modal.
 */
export const QuickCreateAccountForm: React.FC<QuickCreateAccountFormProps> = ({
  name,
  onNameChange,
  type,
  onTypeChange,
  currency,
  onCurrencyChange,
  onSubmit,
  isPending,
  isError = false,
  errorMessage = 'Failed to create account. Check fields and try again.',
  testIdPrefix = 'quick-account',
  allowedTypes,
}) => {
  const showCurrency = currency !== undefined && onCurrencyChange !== undefined;
  const canSubmit = name.trim().length > 0 && (!showCurrency || (currency ?? '').trim().length === 3);
  const typeOptions = allowedTypes
    ? accountTypeOptions.filter((option) => allowedTypes.includes(option.value))
    : accountTypeOptions;

  return (
    <div className="mt-4 border-t border-slate-800 pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick Create Account</p>
      <div className={showCurrency ? 'space-y-4' : 'grid grid-cols-2 gap-4 items-end'}>
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Account Name</Label>
          <Input
            data-testid={`${testIdPrefix}-name`}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Main Wallet"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Type</Label>
          <DropdownSelect
            testId={`${testIdPrefix}-type`}
            value={type}
            onChange={(value) => onTypeChange(value as AccountType)}
            options={typeOptions}
            placeholder="Select account type"
          />
        </div>
        {showCurrency && (
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Default Currency</Label>
            <Input
              data-testid={`${testIdPrefix}-currency`}
              value={currency}
              onChange={(e) => onCurrencyChange?.(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
              placeholder="USD"
              maxLength={3}
            />
          </div>
        )}
      </div>
      {isError && <p className="mt-2 text-sm text-rose-400">{errorMessage}</p>}
      <Button
        type="button"
        variant="secondary"
        data-testid={`${testIdPrefix}-create`}
        disabled={!canSubmit || isPending}
        onClick={onSubmit}
        className="mt-3 w-full"
      >
        {isPending ? 'Creating...' : 'Create account'}
      </Button>
    </div>
  );
};
