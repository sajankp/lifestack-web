import type { z } from 'zod';
import api from './api';
import { paginatedSchema } from '../types/common';
import {
  ImportBatchSchema,
  ImportCommitResponseSchema,
  ImportValidateResponseSchema,
} from '../types/imports';
import type {
  ImportCommitResponse,
  ImportModule,
  ImportValidateResponse,
} from '../types/imports';

const PaginatedImportsSchema = paginatedSchema(ImportBatchSchema);

export const importsService = {
  downloadTemplate: async (module: ImportModule): Promise<string> => {
    const response = await api.get(`/imports/templates/${module}`, { responseType: 'text' });
    return response.data as string;
  },

  uploadAndValidate: async (
    module: ImportModule,
    file: File,
    targetAccountId?: string
  ): Promise<ImportValidateResponse> => {
    const form = new FormData();
    form.append('module', module);
    form.append('file', file);
    if (targetAccountId) {
      form.append('target_account_id', targetAccountId);
    }
    const response = await api.post('/imports', form);
    return ImportValidateResponseSchema.parse(response.data);
  },

  commitImport: async (importPublicId: string): Promise<ImportCommitResponse> => {
    const response = await api.post(`/imports/${importPublicId}/commit`);
    return ImportCommitResponseSchema.parse(response.data);
  },

  listImports: async (limit: number = 20, offset: number = 0): Promise<z.infer<typeof PaginatedImportsSchema>> => {
    const response = await api.get('/imports', { params: { limit, offset } });
    return PaginatedImportsSchema.parse(response.data);
  },

  getImportDetail: async (importPublicId: string): Promise<ImportValidateResponse> => {
    const response = await api.get(`/imports/${importPublicId}`);
    return ImportValidateResponseSchema.parse(response.data);
  },

  deleteImport: async (importPublicId: string): Promise<void> => {
    await api.delete(`/imports/${importPublicId}`);
  },
};
