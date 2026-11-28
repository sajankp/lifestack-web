import { z } from 'zod';

// spec-113 §5.4 / §5.5: the planning half of the tax tab. These mirror
// app/investing/tax_whatif_views.py (opportunities, dates, simulate-sale). Money is a
// Decimal *string*; dates are ISO calendar days in the owner's timezone.

const money = z.string().default('0');

// ── Ways to pay less: GET /investing/tax/opportunities ───────────────────

export const TaxOpportunityLotSchema = z.object({
  symbol: z.string().default(''),
  account_name: z.string().default(''),
  quantity: z.string().default('0'),
  gain_inr: money,
  tax_avoided_later_inr: money,
});
export type TaxOpportunityLot = z.infer<typeof TaxOpportunityLotSchema>;

export const TaxOpportunitySchema = z.object({
  /** harvest_loss | wait_for_long_term | use_exemption */
  kind: z.string().default(''),
  /** this_fy: saves tax this financial year. later_years: saves tax in later years. */
  timing: z.string().default('this_fy'),
  saves_inr: money,
  symbol: z.string().default(''),
  account_name: z.string().default(''),
  quantity: z.string().default('0'),
  headline: z.string().default(''),
  detail: z.string().default(''),
  act_by: z.string().nullable().catch(null).default(null),
  // wait_for_long_term
  wait_until: z.string().nullable().catch(null).default(null),
  days_to_long_term: z.number().nullable().catch(null).default(null),
  tax_if_sold_today_inr: z.string().nullable().catch(null).default(null),
  tax_if_sold_on_date_inr: z.string().nullable().catch(null).default(null),
  // use_exemption
  exemption_inr: z.string().nullable().catch(null).default(null),
  used_inr: z.string().nullable().catch(null).default(null),
  unused_inr: z.string().nullable().catch(null).default(null),
  fills_inr: z.string().nullable().catch(null).default(null),
  lots: z.array(TaxOpportunityLotSchema).default([]),
});
export type TaxOpportunity = z.infer<typeof TaxOpportunitySchema>;

export const TaxOpportunitiesResponseSchema = z.object({
  status: z.string().default('success'),
  as_of: z.string().default(''),
  fy: z.string().default(''),
  total_saves_this_fy_inr: money,
  opportunities: z.array(TaxOpportunitySchema).default([]),
  warnings: z.array(z.string()).default([]),
  disclaimer: z.string().default(''),
});
export type TaxOpportunitiesResponse = z.infer<typeof TaxOpportunitiesResponseSchema>;

// ── Dates: GET /investing/tax/dates ──────────────────────────────────────

export const TaxDateSchema = z.object({
  /** advance_tax | lrs_repatriation | long_term | lock_in_end */
  kind: z.string().default(''),
  date: z.string().default(''),
  days_until: z.number().default(0),
  headline: z.string().default(''),
  detail: z.string().default(''),
  /** True where the figure rests on the app's own estimate. */
  estimate: z.boolean().default(false),
});
export type TaxDate = z.infer<typeof TaxDateSchema>;

export const TaxDatesResponseSchema = z.object({
  status: z.string().default('success'),
  as_of: z.string().default(''),
  fy: z.string().default(''),
  horizon_days: z.number().default(90),
  estimated_tax_inr: z.string().nullable().catch(null).default(null),
  dates: z.array(TaxDateSchema).default([]),
  warnings: z.array(z.string()).default([]),
  disclaimer: z.string().default(''),
});
export type TaxDatesResponse = z.infer<typeof TaxDatesResponseSchema>;

// ── Before you sell: POST /investing/tax/simulate-sale ───────────────────

export const SimulatedLotSchema = z.object({
  fifo_position: z.number().default(0),
  acquired_date: z.string().default(''),
  quantity: z.string().default('0'),
  cost_per_unit: z.string().default('0'),
  gain_native: z.string().default('0'),
  gain_inr: z.string().nullable().catch(null).default(null),
  is_long_term: z.boolean().default(false),
  days_to_long_term: z.number().default(0),
  long_term_from: z.string().nullable().catch(null).default(null),
});
export type SimulatedLot = z.infer<typeof SimulatedLotSchema>;

export const SaleSimulationSchema = z.object({
  /** success | insufficient_quantity | missing_fx_rate | ... */
  status: z.string().default('success'),
  message: z.string().nullable().catch(null).default(null),
  sale: z
    .object({
      date: z.string().default(''),
      fy: z.string().default(''),
      quantity_requested: z.string().default('0'),
      quantity_consumed: z.string().default('0'),
      quantity_locked: z.string().default('0'),
      locked_until: z.string().nullable().catch(null).default(null),
      price_per_unit: z.string().default('0'),
      currency: z.string().default('INR'),
    })
    .default({
      date: '',
      fy: '',
      quantity_requested: '0',
      quantity_consumed: '0',
      quantity_locked: '0',
      locked_until: null,
      price_per_unit: '0',
      currency: 'INR',
    }),
  lots: z.array(SimulatedLotSchema).default([]),
  gains: z
    .object({
      gain_native: z.string().default('0'),
      gain_inr: z.string().nullable().catch(null).default(null),
    })
    .default({ gain_native: '0', gain_inr: null }),
  tax: z
    .object({ incremental_tax_inr: z.string().default('0') })
    .nullable()
    .catch(null)
    .default(null),
  assumptions: z.array(z.string()).default([]),
});
export type SaleSimulation = z.infer<typeof SaleSimulationSchema>;

export interface SimulateSaleRequest {
  holding_id: string;
  quantity: string;
  sale_date?: string;
  price?: string;
}
