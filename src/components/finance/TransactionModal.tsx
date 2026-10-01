import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DropdownSelect } from '../DropdownSelect';
import { DatePicker } from '../DatePicker';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormattedNumberInput } from '../ui/formatted-number-input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { TagPicker } from '../../pages/spending/TagPicker';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { mutationInvalidations, queryKeys } from '../../lib/queryKeys';
import { spendingService } from '../../services/spending';
import { formatDateInputValue } from '../../utils/dateFormat';
import { useToast } from '../ui/toast';
import type { Account } from '../../types/finance';
import type { ActivityFeedItem } from '../../types/finance';
import type { Transaction, TransactionCreate, TransactionType, TransactionUpdate } from '../../types/spending';

export interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  /** Pre-select an account (e.g. from account detail view) */
  defaultAccountId?: string;
  /** Full transaction to edit if available */
  transactionToEdit?: Transaction | null;
  /** ActivityFeedItem to edit (modal will load full details if needed) */
  initialFeedItem?: ActivityFeedItem | null;
  /** Optional escape hatch to a "create account" flow */
  onCreateAccount?: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  open,
  onClose,
  accounts,
  defaultAccountId,
  transactionToEdit,
  initialFeedItem,
  onCreateAccount,
}) => {
  const { showToast } = useToast();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(formatDateInputValue(new Date()));
  const [description, setDescription] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  // Fetch categories
  const categoriesRes = useQuery({
    queryKey: queryKeys.spending.categories(),
    queryFn: () => spendingService.getCategories(200, 0),
    enabled: open,
  });
  // Stable category items
  const categories = useMemo(() => categoriesRes.data?.items ?? [], [categoriesRes.data]);

  // Fetch tags
  const tagsRes = useQuery({
    queryKey: queryKeys.spending.tags(),
    queryFn: () => spendingService.getTags(100, 0),
    enabled: open,
  });
  const spendingTags = useMemo(() => tagsRes.data?.items ?? [], [tagsRes.data]);

  // If editing an activity feed item without a full Transaction object, fetch full transaction details
  const shouldFetchDetail = Boolean(
    open && initialFeedItem && initialFeedItem.event_type === 'spend' && !transactionToEdit,
  );
  const transactionDetailRes = useQuery({
    queryKey: ['spending', 'transaction', initialFeedItem?.id],
    queryFn: () => (initialFeedItem ? spendingService.getTransaction(initialFeedItem.id) : null),
    enabled: shouldFetchDetail,
  });

  // Track the ID we have initialized for
  const [initializedForId, setInitializedForId] = useState<string | null>(null);

  // Initialize form state when modal opens or detail data resolves
  useEffect(() => {
    if (!open) {
      setInitializedForId(null);
      return;
    }

    if (transactionToEdit) {
      if (initializedForId === transactionToEdit.public_id) return;
      setEditingTransactionId(transactionToEdit.public_id);
      setType(transactionToEdit.type);
      setAmount(String(transactionToEdit.amount));
      setCategoryId(transactionToEdit.category_id || categories[0]?.public_id || '');
      setAccountId(transactionToEdit.account_id || defaultAccountId || accounts[0]?.public_id || '');
      setDate(
        transactionToEdit.occurred_at
          ? formatDateInputValue(new Date(transactionToEdit.occurred_at))
          : formatDateInputValue(new Date()),
      );
      setDescription(transactionToEdit.description || '');
      setSelectedTagIds(transactionToEdit.tags?.map((t) => t.public_id) ?? []);
      setInitializedForId(transactionToEdit.public_id);
    } else if (initialFeedItem && initialFeedItem.event_type === 'spend') {
      const detail = transactionDetailRes.data;
      if (detail && detail.public_id === initialFeedItem.id) {
        if (initializedForId === `detail_${detail.public_id}`) return;
        setEditingTransactionId(detail.public_id);
        setType(detail.type);
        setAmount(String(detail.amount));
        setCategoryId(detail.category_id || categories[0]?.public_id || '');
        setAccountId(detail.account_id || initialFeedItem.account_id || defaultAccountId || accounts[0]?.public_id || '');
        setDate(
          detail.occurred_at
            ? formatDateInputValue(new Date(detail.occurred_at))
            : formatDateInputValue(new Date()),
        );
        setDescription(detail.description || '');
        setSelectedTagIds(detail.tags?.map((t) => t.public_id) ?? []);
        setInitializedForId(`detail_${detail.public_id}`);
      } else if (!initializedForId) {
        setEditingTransactionId(initialFeedItem.id);
        const rawAmt = initialFeedItem.amount.replace('+', '').replace('-', '');
        const isIncome = initialFeedItem.amount.startsWith('+');
        setType(isIncome ? 'income' : 'expense');
        setAmount(rawAmt || '');
        setAccountId(initialFeedItem.account_id || defaultAccountId || accounts[0]?.public_id || '');
        setDate(
          initialFeedItem.date
            ? formatDateInputValue(new Date(initialFeedItem.date))
            : formatDateInputValue(new Date()),
        );
        setDescription(initialFeedItem.description || '');

        const matched = categories.find((c) => c.name === initialFeedItem.category_name);
        if (matched) {
          setCategoryId(matched.public_id);
        } else if (categories.length > 0) {
          setCategoryId(categories[0].public_id);
        }
        setInitializedForId(`initial_${initialFeedItem.id}`);
      }
    } else if (!initializedForId) {
      // New Transaction
      setEditingTransactionId(null);
      setType('expense');
      setAmount('');
      setCategoryId(categories[0]?.public_id || '');
      setAccountId(defaultAccountId || accounts[0]?.public_id || '');
      setDate(formatDateInputValue(new Date()));
      setDescription('');
      setSelectedTagIds([]);
      setInitializedForId('__new__');
    }
  }, [
    open,
    transactionToEdit,
    initialFeedItem,
    transactionDetailRes.data,
    defaultAccountId,
    accounts,
    categories,
    initializedForId,
  ]);

  // Pre-select first category / account when they resolve if not yet chosen
  useEffect(() => {
    if (!open) return;
    if (!categoryId && categories.length > 0) {
      if (initialFeedItem?.category_name) {
        const matched = categories.find((c) => c.name === initialFeedItem.category_name);
        if (matched) {
          setCategoryId(matched.public_id);
          return;
        }
      }
      setCategoryId(categories[0].public_id);
    }
  }, [open, categoryId, categories, initialFeedItem]);

  useEffect(() => {
    if (!open) return;
    if (!accountId && accounts.length > 0) {
      setAccountId(defaultAccountId || accounts[0].public_id);
    }
  }, [open, accountId, accounts, defaultAccountId]);

  const isEditing = Boolean(editingTransactionId);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.public_id,
        label: `${a.name} (${a.account_type.replace('_', ' ')})`,
      })),
    [accounts],
  );

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.public_id,
        label: c.name,
      })),
    [categories],
  );

  const createMutation = useInvalidatingMutation(
    (newTx: TransactionCreate) => spendingService.createTransaction(newTx),
    mutationInvalidations.transaction,
    {
      successMessage: 'Transaction created',
      onSuccess: () => {
        onClose();
      },
    },
  );

  const updateMutation = useInvalidatingMutation(
    ({ id, data }: { id: string; data: TransactionUpdate }) =>
      spendingService.updateTransaction(id, data),
    mutationInvalidations.transaction,
    {
      successMessage: 'Transaction updated',
      onSuccess: () => {
        onClose();
      },
    },
  );

  const createTagMutation = useInvalidatingMutation(
    (data: { name: string }) => spendingService.createTag(data),
    [queryKeys.spending.tags()],
    { successMessage: false },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !categoryId || !type || !date || (!isEditing && !accountId)) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (Number.isNaN(parsedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast('Please enter a valid positive amount.', 'error');
      return;
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      showToast('Please enter a valid transaction date.', 'error');
      return;
    }

    const payload: TransactionCreate = {
      amount: parsedAmount,
      category_id: categoryId,
      account_id: accountId || null,
      type,
      occurred_at: parsedDate.toISOString(),
      description: description.trim() || null,
      tag_ids: selectedTagIds,
    };

    if (isEditing && editingTransactionId) {
      updateMutation.mutate({
        id: editingTransactionId,
        data: payload,
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader className="border-b border-slate-800 px-6 py-4 sticky top-0 bg-slate-900 z-10 rounded-t-2xl">
          <DialogTitle className="text-lg font-bold text-white">
            {isEditing ? 'Edit Transaction' : 'New Transaction'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? 'Edit existing transaction details' : 'Create a new spending or income transaction'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Expense / Income Selector */}
          <div className="flex gap-2 rounded-xl bg-slate-800/60 p-1 border border-slate-700/50">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                type === 'income'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Income
            </button>
          </div>

          {/* Amount */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-300">Amount</Label>
            <FormattedNumberInput
              data-testid="transaction-amount-input"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-slate-800 border-slate-700 text-white font-mono"
            />
          </div>

          {/* Category */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-300">Category</Label>
            <DropdownSelect
              testId="transaction-category-select"
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="Select category"
              showSearch
              sortByLabel
            />
          </div>

          {/* Account */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-300">
              Account / Wallet{isEditing ? ' (Optional)' : ''}
            </Label>
            <DropdownSelect
              testId="transaction-account-select"
              value={accountId}
              onChange={setAccountId}
              options={accountOptions}
              placeholder={isEditing ? 'Unassigned' : 'Select account'}
              clearLabel={isEditing ? 'Unassigned' : undefined}
              showSearch
              sortByLabel
            />
            {onCreateAccount && !isEditing && (
              <button
                type="button"
                onClick={onCreateAccount}
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
              >
                + Create new account
              </button>
            )}
          </div>

          {/* Date */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-300">Date</Label>
            <DatePicker
              testId="transaction-date-picker"
              value={date}
              onChange={setDate}
              placeholder="Select date"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-300">
              Description (Optional)
            </Label>
            <Input
              data-testid="transaction-description-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Groceries, Coffee with team, Taxi"
              className="bg-slate-800 border-slate-700 text-white text-xs"
            />
          </div>

          {/* Tags */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-slate-300">Tags</Label>
            <TagPicker
              tags={spendingTags}
              selectedIds={selectedTagIds}
              onChange={setSelectedTagIds}
              onCreateTag={(name) => createTagMutation.mutateAsync({ name })}
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="transaction-submit-btn"
              disabled={
                isPending ||
                !amount ||
                !categoryId ||
                !type ||
                !date ||
                (!isEditing && !accountId)
              }
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20"
            >
              {isPending
                ? isEditing
                  ? 'Updating…'
                  : 'Creating…'
                : isEditing
                  ? 'Save Changes'
                  : 'Add Transaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
