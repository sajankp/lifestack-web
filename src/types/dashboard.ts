import { z } from 'zod';
import { BudgetSpotlightItemSchema } from './spending';

export const DashboardTodoItemSchema = z.object({
  public_id: z.string().optional(),
  title: z.string().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});
export type DashboardTodoItem = z.infer<typeof DashboardTodoItemSchema>;

// Mirrors the API's `top_overspent_categories` rows (app/application/workflows.py):
// Decimal fields serialise as strings, `category_id` is the integer category id.
const DecimalLikeSchema = z.union([z.number(), z.string()]);

export const DashboardOverspentCategorySchema = z.object({
  category_id: z.number().optional(),
  spent: DecimalLikeSchema.optional(),
  budget: DecimalLikeSchema.nullable().optional(),
  overspend: DecimalLikeSchema.optional(),
  ratio: DecimalLikeSchema.optional(),
});
export type DashboardOverspentCategory = z.infer<typeof DashboardOverspentCategorySchema>;

export const BriefingSourceSchema = z.object({
  entity_type: z.string().nullable().optional(),
  entity_public_id: z.string().nullable().optional(),
  route: z.string(),
});
export type BriefingSource = z.infer<typeof BriefingSourceSchema>;

export const BriefingLineSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']),
  text: z.string(),
  // true = the owner can act on it; info lines are shown but never push (spec-115 §2.2)
  actionable: z.boolean().default(false),
  source: BriefingSourceSchema,
});
export type BriefingLine = z.infer<typeof BriefingLineSchema>;

export const BriefingResponseSchema = z.object({
  generated_at: z.string(),
  all_clear: z.boolean(),
  reporting_currency: z.string(),
  lines: z.array(BriefingLineSchema).default([]),
});
export type BriefingResponse = z.infer<typeof BriefingResponseSchema>;

export const DashboardSummarySchema = z.object({
  todos: z.object({
    status: z.string().default(''),
    open_count: z.number().default(0),
    overdue_count: z.number().default(0),
    next_due_items: z.array(DashboardTodoItemSchema).default([]),
    active_guardrail_todo_count: z.number().default(0),
  }),
  spending: z.object({
    status: z.string().default(''),
    month_spent: z.union([z.number(), z.string()]).default(0),
    budget_spotlight: z.array(BudgetSpotlightItemSchema).default([]),
    budgets_tracked: z.number().default(0),
    uncovered_spend: z.union([z.number(), z.string()]).default(0),
    top_overspent_categories: z.array(DashboardOverspentCategorySchema).default([]),
  }),
  investing: z.object({
    status: z.string().default(''),
    portfolio_value: z.union([z.number(), z.string()]).nullable().default(null),
    invested_value: z.union([z.number(), z.string()]).nullable().default(null),
    total_gain_loss: z.union([z.number(), z.string()]).nullable().default(null),
    total_gain_loss_pct: z.union([z.number(), z.string()]).nullable().default(null),
    daily_change: z.union([z.number(), z.string()]).nullable().default(null),
    daily_change_pct: z.union([z.number(), z.string()]).nullable().default(null),
    snapshot_date: z.string().nullable().default(null),
    previous_snapshot_date: z.string().nullable().default(null),
    valuation_status: z.string().default(''),
    holdings_count: z.number().default(0),
    cash_total: z.union([z.number(), z.string()]).nullable().default(null),
  }),
  system: z.object({
    generated_at: z.string().default(''),
  }),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
