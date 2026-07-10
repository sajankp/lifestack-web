import { z } from 'zod';

// ─── Zod schemas for API responses (defaults for test resiliency, matching
//     the spending/investing service convention). Request payload types stay
//     plain interfaces — they are inputs we construct, not data we validate.

export const AccountTypeSchema = z.enum(['bank', 'brokerage', 'wallet', 'card', 'gift_card']);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const CurrencySchema = z.object({
  code: z.string().default(''),
  name: z.string().default(''),
  symbol: z.string().nullable().default(null),
  minor_unit: z.number().default(2),
  is_active: z.boolean().default(true),
});
export type Currency = z.infer<typeof CurrencySchema>;

export const AccountSchema = z.object({
  public_id: z.string().default(''),
  name: z.string().default(''),
  account_type: AccountTypeSchema.default('bank'),
  default_currency_code: z.string().default(''),
  is_active: z.boolean().default(true),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});
export type Account = z.infer<typeof AccountSchema>;

export interface AccountCreate {
  name: string;
  account_type: AccountType;
  default_currency_code: string;
}

export interface AccountUpdate {
  name?: string;
  account_type?: AccountType;
  default_currency_code?: string;
  is_active?: boolean;
}

export const WorkspaceFinanceSettingSchema = z.object({
  reporting_currency_code: z.string().nullable().default(null),
  currency_display_preference: z.enum(['symbol', 'code']).optional(),
  lookthrough_min_weight_pct: z.union([z.number(), z.string()]).default(0),
  default_spending_account_id: z.string().nullable().optional(),
  updated_at: z.string().default(''),
});
export type WorkspaceFinanceSetting = z.infer<typeof WorkspaceFinanceSettingSchema>;

export interface WorkspaceFinanceSettingUpdate {
  reporting_currency_code?: string | null;
  currency_display_preference?: 'symbol' | 'code' | null;
  lookthrough_min_weight_pct?: number | string;
  default_spending_account_id?: string | null;
}

export const UserFinanceSettingSchema = z.object({
  reporting_currency_override_code: z.string().nullable().default(null),
  currency_display_preference_override: z.enum(['symbol', 'code']).nullable().default(null),
  workspace_reporting_currency_code: z.string().nullable().default(null),
  workspace_currency_display_preference: z.enum(['symbol', 'code']).default('symbol'),
  effective_reporting_currency_code: z.string().nullable().default(null),
  effective_currency_display_preference: z.enum(['symbol', 'code']).default('symbol'),
  updated_at: z.string().default(''),
});
export type UserFinanceSetting = z.infer<typeof UserFinanceSettingSchema>;

export interface UserFinanceSettingUpdate {
  reporting_currency_override_code?: string | null;
  currency_display_preference_override?: 'symbol' | 'code' | null;
}

export interface CapitalTransferCreate {
  from_module: 'spending' | 'investing';
  to_module: 'spending' | 'investing';
  from_account_id: string;
  to_account_id: string;
  from_currency_code: string;
  to_currency_code: string;
  gross_amount: string;
  fx_rate_used?: string | null;
  fx_fee_amount: string;
  platform_fee_amount: string;
  tax_amount: string;
  net_amount_received: string;
  occurred_at: string;
  notes?: string | null;
}

export interface CapitalTransferUpdate {
  from_account_id?: string;
  to_account_id?: string;
  from_currency_code?: string;
  to_currency_code?: string;
  gross_amount?: string;
  fx_rate_used?: string | null;
  fx_fee_amount?: string;
  platform_fee_amount?: string;
  tax_amount?: string;
  net_amount_received?: string;
  occurred_at?: string;
  notes?: string | null;
}

export const CapitalTransferSchema = z.object({
  public_id: z.string().default(''),
  from_module: z.enum(['spending', 'investing']).default('spending'),
  to_module: z.enum(['spending', 'investing']).default('investing'),
  from_account_id: z.number().default(0),
  to_account_id: z.number().default(0),
  from_account_public_id: z.string().nullable().default(null),
  to_account_public_id: z.string().nullable().default(null),
  from_account_name: z.string().nullable().default(null),
  to_account_name: z.string().nullable().default(null),
  from_account_type: AccountTypeSchema.nullable().default(null),
  to_account_type: AccountTypeSchema.nullable().default(null),
  from_currency_code: z.string().default(''),
  to_currency_code: z.string().default(''),
  gross_amount: z.string().default('0'),
  fx_rate_used: z.string().nullable().default(null),
  fx_fee_amount: z.string().default('0'),
  platform_fee_amount: z.string().default('0'),
  tax_amount: z.string().default('0'),
  net_amount_received: z.string().default('0'),
  occurred_at: z.string().default(''),
  notes: z.string().nullable().default(null),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});
export type CapitalTransfer = z.infer<typeof CapitalTransferSchema>;

export const AccountBalanceResponseSchema = z.object({
  account_public_id: z.string().default(''),
  account_name: z.string().default(''),
  account_type: AccountTypeSchema.default('bank'),
  currency_code: z.string().default(''),
  // (income - expenses) + (transfer_in - transfer_out)
  spending_balance: z.string().default('0'),
  transaction_count: z.number().default(0),
  transfer_count: z.number().default(0),
  first_transaction_at: z.string().nullable().default(null),
  last_transaction_at: z.string().nullable().default(null),
});
export type AccountBalanceResponse = z.infer<typeof AccountBalanceResponseSchema>;

export const ReconciliationSummarySchema = z.object({
  account_public_id: z.string().default(''),
  account_name: z.string().default(''),
  currency_code: z.string().default(''),
  projected_balance: z.string().default('0'), // decimal as string
  snapshot_balance: z.string().nullable().default(null), // null when no cash snapshot exists
  snapshot_as_of: z.string().nullable().default(null),
  discrepancy: z.string().nullable().default(null), // projected - snapshot; null when no snapshot
  transaction_count: z.number().default(0),
  transfer_count: z.number().default(0),
  order_count: z.number().default(0),
});
export type ReconciliationSummary = z.infer<typeof ReconciliationSummarySchema>;

export const SpendingAccountBalanceSchema = z.object({
  account_public_id: z.string().default(''),
  account_name: z.string().default(''),
  account_type: z.string().default(''),
  currency_code: z.string().default(''),
  balance: z.string().default('0'), // decimal as string, native currency
  balance_in_reporting_currency: z.string().nullable().default(null), // null if FX rate unavailable
});
export type SpendingAccountBalance = z.infer<typeof SpendingAccountBalanceSchema>;

export const InvestingAccountBalanceSchema = z.object({
  account_public_id: z.string().default(''),
  account_name: z.string().default(''),
  currency_code: z.string().default(''),
  balance: z.string().default('0'), // decimal as string, native currency
  balance_in_reporting_currency: z.string().nullable().default(null), // null if FX rate unavailable
});
export type InvestingAccountBalance = z.infer<typeof InvestingAccountBalanceSchema>;

export const NetWorthDataSchema = z.object({
  reporting_currency: z.string().nullable().default(null),
  spending_accounts: z.array(SpendingAccountBalanceSchema).default([]),
  spending_total: z.string().nullable().default(null),
  investing_accounts: z.array(InvestingAccountBalanceSchema).default([]),
  investing_cash_total: z.string().nullable().default(null),
  holdings_value: z.string().nullable().default(null),
  investing_total: z.string().nullable().default(null),
  total_net_worth: z.string().nullable().default(null),
  // Known values today: 'ok' | 'partial' | 'no_reporting_currency' | 'empty'.
  // Kept as plain string so a new backend status degrades gracefully.
  valuation_status: z.string().default('empty'),
  fx_as_of: z.string().nullable().default(null),
});
export type NetWorthData = z.infer<typeof NetWorthDataSchema>;

export const NetWorthHistoryItemSchema = z.object({
  snapshot_date: z.string().default(''),
  reporting_currency: z.string().default(''),
  // Nullable: a user-provided backfill point (spec-072) may carry only a
  // total with no component split -- null, never zero, so the chart can
  // tell "no data" apart from "actually zero".
  holdings_value: z.string().nullable().default(null),
  investing_cash: z.string().nullable().default(null),
  spending_cash: z.string().nullable().default(null),
  total_net_worth: z.string().default('0'),
  source: z.string().default('live'),
});
export type NetWorthHistoryItem = z.infer<typeof NetWorthHistoryItemSchema>;

export interface FxRateHistoryImportRow {
  base_currency_code: string;
  quote_currency_code: string;
  rate: number;
  as_of_date: string;
}

export const FxRateImportResultSchema = z.object({
  imported: z.number().default(0),
  skipped: z.number().default(0),
  rejected: z.array(z.object({ row: z.number(), reason: z.string() })).default([]),
});
export type FxRateImportResult = z.infer<typeof FxRateImportResultSchema>;

export const UserFxRateSchema = z.object({
  id: z.number(),
  base_currency_code: z.string().default(''),
  quote_currency_code: z.string().default(''),
  rate: z.union([z.number(), z.string()]).default(0),
  as_of_date: z.string().default(''),
  created_at: z.string().default(''),
});
export type UserFxRate = z.infer<typeof UserFxRateSchema>;

export interface NetWorthHistoryImportRow {
  date: string;
  total_net_worth: number;
  holdings_value?: number | null;
  investing_cash?: number | null;
  spending_cash?: number | null;
  reporting_currency: string;
}

export const NetWorthImportResultSchema = z.object({
  imported: z.number().default(0),
  skipped: z.number().default(0),
  rejected: z.array(z.object({ row: z.number(), reason: z.string() })).default([]),
});
export type NetWorthImportResult = z.infer<typeof NetWorthImportResultSchema>;

export const UserNetWorthPointSchema = z.object({
  id: z.number(),
  snapshot_date: z.string().default(''),
  reporting_currency: z.string().default(''),
  holdings_value: z.union([z.number(), z.string()]).nullable().default(null),
  investing_cash: z.union([z.number(), z.string()]).nullable().default(null),
  spending_cash: z.union([z.number(), z.string()]).nullable().default(null),
  total_net_worth: z.union([z.number(), z.string()]).default(0),
  created_at: z.string().default(''),
});
export type UserNetWorthPoint = z.infer<typeof UserNetWorthPointSchema>;
