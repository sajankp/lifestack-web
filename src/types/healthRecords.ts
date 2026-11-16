import { z } from 'zod';

// spec-110: the generic health measurement store. These schemas ARE the API contract
// (lifestack-api `app/health/measurements/schemas.py`): required fields have no defaults, so a
// contract mismatch fails loudly instead of rendering an empty state.

const DecimalString = z.string();

export const MetricLatestSchema = z.object({
  measured_on: z.string(),
  value: DecimalString.nullable(),
  value_text: z.string().nullable(),
  comparator: z.string().nullable(),
  unit: z.string().nullable(),
});

export const UnitConversionSchema = z.object({ factor: z.string(), offset: z.string() });

export const HealthMetricSchema = z.object({
  public_id: z.string(),
  code: z.string(),
  name: z.string(),
  category: z.string(),
  value_type: z.enum(['numeric', 'text']),
  canonical_unit: z.string().nullable(),
  unit_conversions: z.record(z.string(), UnitConversionSchema).nullable(),
  aliases: z.array(z.string()),
  min_value: DecimalString.nullable(),
  max_value: DecimalString.nullable(),
  measurement_count: z.number(),
  latest: MetricLatestSchema.nullable(),
});

export const MeasurementPointSchema = z.object({
  public_id: z.string(),
  measured_on: z.string(),
  measured_at: z.string().nullable(),
  value: DecimalString.nullable(),
  comparator: z.string().nullable(),
  value_text: z.string().nullable(),
  unit: z.string().nullable(),
  canonical_value: DecimalString.nullable(),
  converted: z.boolean(),
  ref_low: DecimalString.nullable(),
  ref_high: DecimalString.nullable(),
  ref_text: z.string().nullable(),
  in_range: z.enum(['low', 'normal', 'high']).nullable(),
  record_public_id: z.string().nullable(),
  note: z.string().nullable(),
  source_type: z.string(),
  source_ref: z.string().nullable(),
  metric_code: z.string().nullable(),
  metric_name: z.string().nullable(),
});

export const SeriesStatsSchema = z.object({
  count: z.number(),
  latest: DecimalString.nullable(),
  latest_on: z.string().nullable(),
  min: DecimalString.nullable(),
  max: DecimalString.nullable(),
  delta_7d: DecimalString.nullable(),
  delta_30d: DecimalString.nullable(),
});

export const HealthSeriesSchema = z.object({
  metric: HealthMetricSchema,
  points: z.array(MeasurementPointSchema),
  stats: SeriesStatsSchema,
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  has_more: z.boolean(),
});

export const HealthRecordSchema = z.object({
  public_id: z.string(),
  kind: z.string(),
  title: z.string(),
  recorded_on: z.string(),
  provider: z.string().nullable(),
  note: z.string().nullable(),
  source_type: z.string(),
  source_ref: z.string().nullable(),
  measurement_count: z.number(),
  created_at: z.string(),
});

export const HealthRecordDetailSchema = HealthRecordSchema.extend({
  measurements: z.array(MeasurementPointSchema),
});

export const HealthRecordsPageSchema = z.object({
  items: z.array(HealthRecordSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type HealthMetric = z.infer<typeof HealthMetricSchema>;
export type MeasurementPoint = z.infer<typeof MeasurementPointSchema>;
export type SeriesStats = z.infer<typeof SeriesStatsSchema>;
export type HealthSeries = z.infer<typeof HealthSeriesSchema>;
export type HealthRecord = z.infer<typeof HealthRecordSchema>;
export type HealthRecordDetail = z.infer<typeof HealthRecordDetailSchema>;
export type HealthRecordsPage = z.infer<typeof HealthRecordsPageSchema>;
