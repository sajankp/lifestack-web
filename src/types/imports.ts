import { z } from 'zod';

// Request-side union: what the UI can ask for.
// 'investing-holdings' is kept for backward-compat rendering of historic import_batches rows.
// Response schemas below keep `module` as a plain string, not this enum, so
// a historic row from a module this union doesn't (yet) list still renders.
export type ImportModule = 'spending-transactions' | 'spending-budgets' | 'investing-holdings' | 'investing-constituents' | 'investing-orders' | 'finance-transfers' | 'investing-cams-cas' | 'investing-demat-cas';

export const ImportStatusSchema = z.enum([
  'uploaded',
  'validated',
  'failed_validation',
  'committing',
  'completed',
  'failed_commit',
]);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

export const ImportBatchSchema = z.object({
  public_id: z.string().default(''),
  // Plain string, not enum: new backend modules (e.g. 'investing-cams-cas')
  // must render in the history list, not fail response parsing.
  module: z.string().default(''),
  status: ImportStatusSchema.default('uploaded'),
  filename: z.string().default(''),
  content_type: z.string().nullable().default(null),
  file_size_bytes: z.number().default(0),
  file_sha256: z.string().default(''),
  storage_backend: z.string().default(''),
  storage_key: z.string().nullable().default(null),
  total_rows: z.number().default(0),
  valid_rows: z.number().default(0),
  error_rows: z.number().default(0),
  commit_error: z.string().nullable().default(null),
  started_at: z.string().default(''),
  validated_at: z.string().nullable().default(null),
  committed_at: z.string().nullable().default(null),
});
export type ImportBatch = z.infer<typeof ImportBatchSchema>;

export const ImportErrorItemSchema = z.object({
  row_number: z.number().default(0),
  field_name: z.string().nullable().default(null),
  error_code: z.string().default(''),
  message: z.string().default(''),
  raw_value: z.string().nullable().default(null),
});
export type ImportErrorItem = z.infer<typeof ImportErrorItemSchema>;

export const ImportErrorSummarySchema = z.object({
  total_errors: z.number().default(0),
  returned_errors: z.number().default(0),
  by_code: z.record(z.string(), z.number()).default({}),
  by_field: z.record(z.string(), z.number()).default({}),
});
export type ImportErrorSummary = z.infer<typeof ImportErrorSummarySchema>;

export const ImportPreviewRowSchema = z.object({
  row_number: z.number().default(0),
  // z.any() (not z.unknown()): preview payloads are module-specific free-form
  // rows rendered directly by ImportsPage.
  payload_json: z.record(z.string(), z.any()).default({}),
});
export type ImportPreviewRow = z.infer<typeof ImportPreviewRowSchema>;

export const ImportValidateResponseSchema = z.object({
  import_batch: ImportBatchSchema,
  errors: z.array(ImportErrorItemSchema).default([]),
  error_summary: ImportErrorSummarySchema.optional(),
  preview_rows: z.array(ImportPreviewRowSchema).optional(),
  // PDF-parser advisory metadata (CAMS CAS spec-056, Demat CAS spec-060):
  // rows the parser recognized but didn't turn into a preview row (with a
  // reason), and price/quantity discontinuities that look like an
  // un-applied corporate action.
  skipped: z.array(z.record(z.string(), z.unknown())).default([]),
  corporate_action_suspected: z.array(z.record(z.string(), z.unknown())).default([]),
});
export type ImportValidateResponse = z.infer<typeof ImportValidateResponseSchema>;

export const ImportCommitResponseSchema = z.object({
  import_batch: ImportBatchSchema,
  inserted_rows: z.number().default(0),
});
export type ImportCommitResponse = z.infer<typeof ImportCommitResponseSchema>;
