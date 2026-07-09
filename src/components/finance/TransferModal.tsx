import React, { useEffect, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { DropdownSelect } from '../DropdownSelect';
import { DatePicker } from '../DatePicker';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { queryKeys } from '../../lib/queryKeys';
import { financeService } from '../../services/finance';
import { formatCurrency } from '../../utils/numberFormat';
import { computeTransferNet } from '../../utils/transferMath';
import type { Account } from '../../types/finance';

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  /** Pre-select the "From" account (e.g. the account the user was already viewing). */
  defaultFromAccountId?: string;
  /** Optional escape hatch to a "create account" flow, rendered as a link under the account pickers. */
  onCreateAccount?: () => void;
}

/**
 * Shared create-transfer modal — a transfer moves money between any two
 * accounts regardless of module (spending wallet/bank/card <-> investing
 * brokerage cash), so this is mounted from both SpendingPage and Investing's
 * CashTab rather than duplicated (UX-REVIEW: "Transfer" is a shared global
 * action, not a Spending-only one).
 */
export const TransferModal: React.FC<TransferModalProps> = ({
  open,
  onClose,
  accounts,
  defaultFromAccountId,
  onCreateAccount,
}) => {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [fxRate, setFxRate] = useState('');
  const [fxFee, setFxFee] = useState('0');
  const [platformFee, setPlatformFee] = useState('0');
  const [tax, setTax] = useState('0');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showFeesDisclosure, setShowFeesDisclosure] = useState(false);

  useEffect(() => {
    if (open) {
      setFromAccountId(defaultFromAccountId ?? '');
      setToAccountId('');
      setAmount('');
      setFxRate('');
      setFxFee('0');
      setPlatformFee('0');
      setTax('0');
      setNotes('');
      setDate(new Date().toISOString().split('T')[0]);
      setShowFeesDisclosure(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grossNum = Number(amount) || 0;
  const netPreview = computeTransferNet({
    gross: grossNum,
    fxRate: Number(fxRate) || null,
    fxFee: Number(fxFee) || 0,
    platformFee: Number(platformFee) || 0,
    tax: Number(tax) || 0,
  });
  const toAccountForPreview = accounts.find((account) => account.public_id === toAccountId);

  const accountOptions = accounts.map((account) => ({
    value: account.public_id,
    label: `${account.name} (${account.account_type.replace('_', ' ')})`,
  }));
  const accountById = new Map(accounts.map((account) => [account.public_id, account]));

  const createTransferMutation = useInvalidatingMutation(
    () => {
      const from = accountById.get(fromAccountId);
      const to = accountById.get(toAccountId);
      if (!from || !to) {
        throw new Error('Transfer accounts are required');
      }
      if (fromAccountId === toAccountId) {
        throw new Error('Source and destination accounts cannot be the same');
      }
      const fromModule = from.account_type === 'brokerage' ? 'investing' : 'spending';
      const toModule = to.account_type === 'brokerage' ? 'investing' : 'spending';
      const gross = Number(amount);
      if (Number.isNaN(gross) || !Number.isFinite(gross) || gross <= 0) {
        throw new Error('Gross amount must be a valid positive number');
      }
      const fxFeeNum = fxFee ? Number(fxFee) : 0;
      const platformFeeNum = platformFee ? Number(platformFee) : 0;
      const taxNum = tax ? Number(tax) : 0;

      if (Number.isNaN(fxFeeNum) || !Number.isFinite(fxFeeNum) || fxFeeNum < 0) {
        throw new Error('FX fee must be a valid non-negative number');
      }
      if (Number.isNaN(platformFeeNum) || !Number.isFinite(platformFeeNum) || platformFeeNum < 0) {
        throw new Error('Platform fee must be a valid non-negative number');
      }
      if (Number.isNaN(taxNum) || !Number.isFinite(taxNum) || taxNum < 0) {
        throw new Error('Tax must be a valid non-negative number');
      }

      let parsedFxRate: string | null = null;
      let rateNum = 1;
      if (fxRate) {
        const rate = Number(fxRate);
        if (Number.isNaN(rate) || !Number.isFinite(rate) || rate <= 0) {
          throw new Error('FX rate must be a valid positive number');
        }
        parsedFxRate = rate.toFixed(10);
        rateNum = rate;
      }

      const net = Math.max(0, gross * rateNum - fxFeeNum - platformFeeNum - taxNum);
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
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
        fx_fee_amount: fxFeeNum.toFixed(2),
        platform_fee_amount: platformFeeNum.toFixed(2),
        tax_amount: taxNum.toFixed(2),
        net_amount_received: net.toFixed(2),
        occurred_at: parsedDate.toISOString(),
        notes: notes || null,
      });
    },
    [queryKeys.finance.all, queryKeys.spending.all, queryKeys.investing.all, queryKeys.dashboard.all],
    {
      successMessage: 'Transfer created',
      onSuccess: () => onClose(),
    },
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
          <DialogTitle>Transfer Between Wallets/Accounts</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fromAccountId || !toAccountId || !amount || fromAccountId === toAccountId) return;
            createTransferMutation.mutate();
          }}
        >
          <div>
            <Label className="mb-2 block">From</Label>
            <DropdownSelect value={fromAccountId} onChange={setFromAccountId} options={accountOptions} placeholder="Select source account" showSearch sortByLabel />
          </div>
          <div>
            <Label className="mb-2 block">To</Label>
            <DropdownSelect value={toAccountId} onChange={setToAccountId} options={accountOptions} placeholder="Select destination account" showSearch sortByLabel />
          </div>
          {onCreateAccount ? (
            <div>
              <button
                type="button"
                onClick={onCreateAccount}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300"
              >
                Need another account? Create one now
              </button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">Amount</Label>
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div>
              <Label className="mb-2 block">Date</Label>
              <DatePicker value={date} onChange={setDate} required />
            </div>
          </div>
          <details
            className="group rounded-xl border border-slate-700/50 bg-slate-800/30 p-3"
            open={showFeesDisclosure}
            onToggle={(e) => setShowFeesDisclosure(e.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Add fees / cross-currency
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div>
                  <Label className="mb-2 block">FX Rate (optional)</Label>
                  <Input type="number" min="0" step="0.0000000001" value={fxRate} onChange={(e) => setFxRate(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">FX Fee</Label>
                  <Input type="number" min="0" step="0.01" value={fxFee} onChange={(e) => setFxFee(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">Platform Fee</Label>
                  <Input type="number" min="0" step="0.01" value={platformFee} onChange={(e) => setPlatformFee(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">Tax</Label>
                  <Input type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Same-currency transfer: FX rate can be empty. Cross-currency transfer: provide FX rate and optional fee/tax charges.
              </p>
            </div>
          </details>
          {grossNum > 0 && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Net received</span>
                <span data-testid="transfer-net-preview" className="font-semibold text-white">
                  {formatCurrency(netPreview, toAccountForPreview?.default_currency_code)}
                </span>
              </div>
            </div>
          )}
          <div>
            <Label className="mb-2 block">Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Top-up to wallet" />
          </div>
          <div className="mt-6 flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={
                createTransferMutation.isPending ||
                !fromAccountId ||
                !toAccountId ||
                !amount ||
                fromAccountId === toAccountId
              }
            >
              {createTransferMutation.isPending ? 'Transferring…' : 'Create Transfer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
