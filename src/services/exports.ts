import api from './api';
import { ExportRecordSchema } from '../types/exports';
import type { ExportCreate, ExportDownload, ExportRecord } from '../types/exports';

const filenameFromDisposition = (contentDisposition: unknown): string | null => {
  if (typeof contentDisposition !== 'string') return null;
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
};

export const exportsService = {
  createExport: async (payload: ExportCreate): Promise<ExportRecord> => {
    const response = await api.post('/exports', payload);
    return ExportRecordSchema.parse(response.data);
  },

  getExport: async (exportPublicId: string): Promise<ExportRecord> => {
    const response = await api.get(`/exports/${exportPublicId}`);
    return ExportRecordSchema.parse(response.data);
  },

  downloadExport: async (exportPublicId: string): Promise<ExportDownload> => {
    const response = await api.get(`/exports/${exportPublicId}/download`, {
      responseType: 'blob',
    });
    return {
      blob: response.data as Blob,
      filename:
        filenameFromDisposition(response.headers?.['content-disposition']) ??
        'lifestack-export',
    };
  },

  deleteExport: async (exportPublicId: string): Promise<void> => {
    await api.delete(`/exports/${exportPublicId}`);
  },
};
