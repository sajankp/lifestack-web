import React, { useEffect, useState } from 'react';
import { Coins, HelpCircle } from 'lucide-react';
import { DropdownSelect } from '../DropdownSelect';
import { DatePicker } from '../DatePicker';
import { Button } from '../ui/button';
import { FormattedNumberInput } from '../ui/formatted-number-input';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { mutationInvalidations } from '../../lib/queryKeys';
import { investingService } from '../../services/investing';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDateInputValue } from '../../utils/dateFormat';
import { useDisplayProfile } from '../../hooks/useDisplayProfile';
import type { Account } from '../../types/finance';
import type { DividendIncomeType } from '../../types/investing';

interface DividendModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  defaultAccountId?: string;
  onSuccess?: () => void;
}

export const DividendModal: React.FC<DividendModalProps> = ({
  open,
  onClose,
  accounts,
  defaultAccountId,
  onSuccess,
}) => {
  const displayProfile = useDisplayProfile();
  const [holdingAccountId, setHoldingAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState<string>('same');
  const [symbol, setSymbol] = useState('');
  const [incomeType, setIncomeType] = useState<DividendIncomeType>('dividend');
  const [grossAmount, setGrossAmount] = useState('');
  const [taxWithheld, setTaxWithheld] = useState('0');
  const [currency, setCurrency] = useState('');
  const [payDate, setPayDate] = useState(formatDateInputValue(new Date()));
  const [notes, setNotes] = useState('');

  const brokerageAccounts = accounts.filter((a) => a.account_type === 'brokerage');
  const creditEligibleAccounts = accounts.filter(
    (a) => a.account_type === 'bank' || a.account_type === 'wallet' || a.account_type === 'brokerage',
  );

  const selectedHoldingAccount = accounts.find((a) => a.public_id === holdingAccountId);

  useEffect(() => {
    if (open) {
      const initialBrokerage = defaultAccountId
        ? brokerageAccounts.find((a) => a.public_id === defaultAccountId) ?? brokerageAccounts[0]
        : brokerageAccounts[0];
      setHoldingAccountId(initialBrokerage?.public_id ?? '');
      setCreditAccountId('same');
      setSymbol('');
      setIncomeType('dividend');
      setGrossAmount('');
      setTaxWithheld('0');
      setCurrency(initialBrokerage?.default_currency_code ?? 'INR');
      setPayDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [open, defaultAccountId, accounts]);

  useEffect(() => {
    if (selectedHoldingAccount) {
      setCurrency(selectedHoldingAccount.default_currency_code);
    }
  }, [selectedHoldingAccount]);

  const grossNum = Number(grossAmount) || 0;
  const taxNum = Number(taxWithheld) || 0;
  const netAmount = Math.max(0, grossNum - taxNum);

  const holdingAccountOptions = brokerageAccounts.map((a) => ({
    value: a.public_id,
    label: `${a.name} (${a.default_currency_code})`,
  }));

  const creditAccountOptions = [
    {
      value: 'same',
      label: `Brokerage Cash (${selectedHoldingAccount?.name ?? 'Same Account'})`,
    },
    ...creditEligibleAccounts
      .filter((a) => !selectedHoldingAccount || a.default_currency_code === selectedHoldingAccount.default_currency_code)
      .filter((a) => a.public_id !== holdingAccountId)
      .map((a) => ({
        value: a.public_id,
        label: `${a.name} (${a.account_type} - ${a.default_currency_code})`,
      })),
  ];

  const createDividendMutation = useInvalidatingMutation(
    async () => {
      if (!holdingAccountId) throw new Error('Holding account is required');
      if (grossNum <= 0) throw new Error('Gross amount must be positive');

      const resolvedCreditAccountId =
        creditAccountId === 'same' || !creditAccountId ? null : creditAccountId;

      await investingService.createDividend({
        account_id: holdingAccountId,
        credit_account_id: resolvedCreditAccountId,
        symbol: symbol.trim().toUpperCase() || null,
        income_type: incomeType,
        gross_amount: grossNum,
        tax_withheld: taxNum,
        currency: currency.toUpperCase(),
        pay_date: payDate,
        notes: notes.trim() || null,
      });
    },
    mutationInvalidations.dividend,
    {
      successMessage: 'Dividend recorded successfully',
      onSuccess: () => {
        onSuccess?.();
        onClose();
      },
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDividendMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-white">Record Dividend / Income</DialogTitle>
              <p className="text-xs text-slate-400">
                Record dividend or coupon distribution with optional direct bank credit
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-medium text-slate-300">Brokerage Account</Label>
            <div className="mt-1">
              <DropdownSelect
                options={holdingAccountOptions}
                value={holdingAccountId}
                onChange={setHoldingAccountId}
                placeholder="Select brokerage account"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-300">Symbol (Optional)</Label>
              <Input
                placeholder="e.g. AAPL, TATSILV"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="mt-1 font-mono uppercase bg-slate-800/80 border-slate-700"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-300">Income Type</Label>
              <div className="mt-1">
                <DropdownSelect
                  options={[
                    { value: 'dividend', label: 'Dividend' },
                    { value: 'interest', label: 'Interest' },
                    { value: 'coupon', label: 'Coupon' },
                  ]}
                  value={incomeType}
                  onChange={(val) => setIncomeType(val as DividendIncomeType)}
                  placeholder="Select type"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-300">Credited To (Destination)</Label>
              <span className="flex items-center gap-1 text-[11px] text-slate-400" title="Indian market dividends often credit the linked bank account directly instead of brokerage cash.">
                <HelpCircle className="h-3 w-3 text-slate-400" />
                Direct bank credit?
              </span>
            </div>
            <div className="mt-1">
              <DropdownSelect
                options={creditAccountOptions}
                value={creditAccountId}
                onChange={setCreditAccountId}
                placeholder="Select credited account"
              />
            </div>
            {creditAccountId !== 'same' && (
              <p className="mt-1 text-[11px] text-emerald-400">
                ✓ Will automatically credit bank ledger without affecting brokerage cash.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-300">Gross Amount ({currency})</Label>
              <FormattedNumberInput
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 bg-slate-800/80 border-slate-700"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-300">Tax Withheld ({currency})</Label>
              <FormattedNumberInput
                value={taxWithheld}
                onChange={(e) => setTaxWithheld(e.target.value)}
                placeholder="0.00"
                className="mt-1 bg-slate-800/80 border-slate-700"
              />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-300">Net Received:</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {formatCurrency(
                  netAmount,
                  currency,
                  displayProfile.currencyDisplay,
                  displayProfile.locale,
                  displayProfile.decimalPlaces,
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-300">Payment Date</Label>
              <DatePicker value={payDate} onChange={setPayDate} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-300">Notes (Optional)</Label>
              <Input
                placeholder="e.g. Q2 Interim"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 bg-slate-800/80 border-slate-700"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createDividendMutation.isPending || grossNum <= 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {createDividendMutation.isPending ? 'Recording...' : 'Record Dividend'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
