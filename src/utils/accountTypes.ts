import type { AccountType } from '../types/finance';

export const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: 'bank', label: 'Bank' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'card', label: 'Card' },
  { value: 'gift_card', label: 'Gift Card' },
];
