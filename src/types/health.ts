import { z } from 'zod';

export type MedicationFrequency = 'daily' | 'weekly' | 'monthly';

export const MedicationSchema = z.object({
  public_id: z.string().default(''),
  name: z.string().default(''),
  dose_text: z.string().nullable().default(null),
  refill_note: z.string().nullable().default(null),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  interval: z.number().default(1),
  days_of_week: z.array(z.number()).nullable().default(null),
  anchor_date: z.string().default(''),
  end_date: z.string().nullable().default(null),
  timezone: z.string().default('UTC'),
  times: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  reminders_enabled: z.boolean().default(true),
  source_type: z.string().default('manual'),
  event_count: z.number().default(0),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Medication = z.infer<typeof MedicationSchema>;

export interface MedicationCreate {
  name: string;
  dose_text?: string | null;
  refill_note?: string | null;
  frequency: MedicationFrequency;
  interval?: number;
  days_of_week?: number[] | null;
  anchor_date: string;
  end_date?: string | null;
  timezone?: string;
  times: string[];
  is_active?: boolean;
  reminders_enabled?: boolean;
}

export type MedicationUpdate = Partial<MedicationCreate>;

export const DoseSlotSchema = z.object({
  medication_public_id: z.string().default(''),
  medication_name: z.string().default(''),
  dose_text: z.string().nullable().default(null),
  scheduled_for: z.string().default(''),
  status: z.enum(['pending', 'taken', 'skipped', 'missed']).default('pending'),
  event_public_id: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
});

export type DoseSlot = z.infer<typeof DoseSlotSchema>;

export const MedicationEventResponseSchema = z.object({
  public_id: z.string().default(''),
  medication_public_id: z.string().default(''),
  scheduled_for: z.string().default(''),
  status: z.enum(['taken', 'skipped']).default('taken'),
  logged_at: z.string().default(''),
  note: z.string().nullable().default(null),
  source_type: z.string().default('manual'),
});

export type MedicationEventResponse = z.infer<typeof MedicationEventResponseSchema>;

export interface MedicationEventUpsert {
  scheduled_for: string;
  status: 'taken' | 'skipped';
  note?: string | null;
}

export const WeightEntrySchema = z.object({
  public_id: z.string().default(''),
  measured_at: z.string().default(''),
  weight_kg: z.string().default('0'),
  note: z.string().nullable().default(null),
  source_type: z.string().default('manual'),
  created_at: z.string().default(''),
});

export type WeightEntry = z.infer<typeof WeightEntrySchema>;

export interface WeightEntryCreate {
  measured_at: string;
  weight_kg: string;
  note?: string | null;
}

export const WeightTrendSchema = z.object({
  entries: z.array(WeightEntrySchema).default([]),
  latest_kg: z.string().nullable().default(null),
  delta_7d_kg: z.string().nullable().default(null),
  delta_30d_kg: z.string().nullable().default(null),
  min_kg: z.string().nullable().default(null),
  max_kg: z.string().nullable().default(null),
});

export type WeightTrend = z.infer<typeof WeightTrendSchema>;
