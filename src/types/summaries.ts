import { z } from 'zod';

export const WeeklySummarySchema = z.object({
  public_id: z.string().default(''),
  week_start: z.string().default(''),
  week_end: z.string().default(''),
  generated_at: z.string().default(''),
  todo_summary: z.object({
    tasks_created: z.number().default(0),
    tasks_completed: z.number().default(0),
    tasks_overdue: z.number().optional(),
    completion_rate_pct: z.union([z.number(), z.string()]).nullable().optional(),
  }),
  spending_summary: z.object({
    status: z.enum(['complete', 'unavailable']).default('unavailable'),
    total_income: z.string().nullable().default(null),
    total_expense: z.string().nullable().default(null),
    net: z.string().nullable().default(null),
    currency: z.string().nullable().default(null),
    has_multiple_currencies: z.boolean().default(false),
    currency_breakdown: z
      .record(z.string(), z.object({ income: z.string(), expense: z.string() }))
      .optional(),
    top_categories: z
      .array(z.object({ name: z.string(), amount: z.string(), pct_of_total: z.string() }))
      .optional(),
    budget_utilization_pct: z.string().nullable().optional(),
    budgets_breached: z.number().optional(),
    recurring_generated_count: z.number().optional(),
  }),
  investing_summary: z.object({
    status: z.enum(['complete', 'unavailable']).default('unavailable'),
    portfolio_value_start: z.string().nullable().default(null),
    portfolio_value_end: z.string().nullable().default(null),
    cash_start: z.string().nullable().default(null),
    cash_end: z.string().nullable().default(null),
    week_change: z.string().nullable().default(null),
    week_change_pct: z.string().nullable().default(null),
    currency: z.string().nullable().default(null),
    start_snapshot_date: z.string().nullable().default(null),
    end_snapshot_date: z.string().nullable().default(null),
  }),
  health_summary: z
    .object({
      doses_scheduled: z.number().default(0),
      doses_taken: z.number().default(0),
      doses_skipped: z.number().default(0),
      doses_missed: z.number().default(0),
      adherence_pct: z.union([z.number(), z.string()]).nullable().default(null),
      weight_entries_logged: z.number().default(0),
      weight_delta_kg: z.union([z.number(), z.string()]).nullable().default(null),
    })
    .nullable()
    .default(null),
  // spec-076: additive sections.
  dividend_summary: z
    .object({
      status: z.enum(['complete', 'unavailable']).default('unavailable'),
      total_net: z.string().nullable().default(null),
      currency: z.string().nullable().default(null),
      count: z.number().default(0),
      by_symbol: z.array(z.object({ symbol: z.string(), net_amount: z.string() })).default([]),
      has_multiple_currencies: z.boolean().default(false),
    })
    .nullable()
    .default(null),
  net_worth_summary: z
    .object({
      status: z.enum(['complete', 'unavailable']).default('unavailable'),
      net_worth_start: z.string().nullable().default(null),
      net_worth_end: z.string().nullable().default(null),
      week_change: z.string().nullable().default(null),
      week_change_pct: z.string().nullable().default(null),
      currency: z.string().nullable().default(null),
      start_snapshot_date: z.string().nullable().default(null),
      end_snapshot_date: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  return_metrics_summary: z
    .object({
      status: z.enum(['complete', 'unavailable']).default('unavailable'),
      xirr: z.string().nullable().default(null),
      annualized_return_pct: z.string().nullable().default(null),
      max_drawdown_pct: z.string().nullable().default(null),
      notable: z.boolean().default(false),
    })
    .nullable()
    .default(null),
  highlights: z.object({
    flags: z.array(z.object({ type: z.string(), message: z.string() })).default([]),
  }),
  read_at: z.string().nullable().default(null),
  regenerated_at: z.string().nullable().default(null),
  regeneration_reason: z.string().nullable().default(null),
  is_superseded: z.boolean().default(false),
});
export type WeeklySummary = z.infer<typeof WeeklySummarySchema>;

export const WorkspaceSummarySettingSchema = z.object({
  cadence_day_of_week: z.number().default(0),
  cadence_hour_utc: z.number().default(1),
  updated_at: z.string().default(''),
});
export type WorkspaceSummarySetting = z.infer<typeof WorkspaceSummarySettingSchema>;
