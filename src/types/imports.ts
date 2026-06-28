// 'investing-holdings' is kept for backward-compat rendering of historic import_batches rows.
export type ImportModule = 'spending-transactions' | 'spending-budgets' | 'investing-holdings' | 'investing-constituents' | 'investing-orders';

export type ImportStatus =
  | 'uploaded'
  | 'validated'
  | 'failed_validation'
  | 'committing'
  | 'completed'
  | 'failed_commit';

export interface ImportBatch {
  public_id: string;
  module: ImportModule;
  status: ImportStatus;
  filename: string;
  content_type: string | null;
  file_size_bytes: number;
  file_sha256: string;
  storage_backend: string;
  storage_key: string | null;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  started_at: string;
  validated_at: string | null;
  committed_at: string | null;
}

export interface ImportErrorItem {
  row_number: number;
  field_name: string | null;
  error_code: string;
  message: string;
  raw_value: string | null;
}

export interface ImportErrorSummary {
  total_errors: number;
  returned_errors: number;
  by_code: Record<string, number>;
  by_field: Record<string, number>;
}

export interface ImportPreviewRow {
  row_number: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload_json: Record<string, any>;
}

export interface ImportValidateResponse {
  import_batch: ImportBatch;
  errors: ImportErrorItem[];
  error_summary?: ImportErrorSummary;
  preview_rows?: ImportPreviewRow[];
}

export interface ImportCommitResponse {
  import_batch: ImportBatch;
  inserted_rows: number;
}
