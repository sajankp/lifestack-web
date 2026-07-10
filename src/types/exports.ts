import { z } from 'zod';

export type ExportFormat = 'json' | 'csv';
// Mirrors the backend export module manifest (spec-070). Keep in sync with
// GET /v1/exports/modules / app/exports/schemas.py::EXPORT_MODULES.
export type ExportModule = 'todo' | 'spending' | 'investing' | 'finance' | 'health';

export const ExportStatusSchema = z.enum(['pending', 'ready', 'failed', 'expired']);
export type ExportStatus = z.infer<typeof ExportStatusSchema>;

export interface ExportCreate {
  format: ExportFormat;
  modules: ExportModule[];
}

export const ExportRecordSchema = z.object({
  public_id: z.string().default(''),
  workspace_id: z.number().default(0),
  requested_by: z.number().default(0),
  format: z.enum(['json', 'csv']).default('json'),
  schema_version: z.number().default(2),
  scope: z.record(z.string(), z.unknown()).default({}),
  status: ExportStatusSchema.default('pending'),
  storage_key: z.string().nullable().default(null),
  artifact_mime_type: z.string().nullable().default(null),
  artifact_filename: z.string().nullable().default(null),
  error_message: z.string().nullable().default(null),
  created_at: z.string().default(''),
  completed_at: z.string().nullable().default(null),
});
export type ExportRecord = z.infer<typeof ExportRecordSchema>;

// Client-side construct (blob + parsed filename), not an API response shape.
export interface ExportDownload {
  blob: Blob;
  filename: string;
}
