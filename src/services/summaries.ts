import type { z } from 'zod';
import api from './api';
import { paginatedSchema } from '../types/common';
import {
  MonthlySummarySchema,
  WeeklySummarySchema,
  WorkspaceSummarySettingSchema,
} from '../types/summaries';
import type { MonthlySummary, WeeklySummary, WorkspaceSummarySetting } from '../types/summaries';

export type { MonthlySummary, WeeklySummary, WorkspaceSummarySetting } from '../types/summaries';

const PaginatedWeeklySummariesSchema = paginatedSchema(WeeklySummarySchema);
const PaginatedMonthlySummariesSchema = paginatedSchema(MonthlySummarySchema);

export const summariesService = {
  listWeekly: async (
    limit = 20,
    offset = 0,
  ): Promise<z.infer<typeof PaginatedWeeklySummariesSchema>> => {
    const res = await api.get('/summaries/weekly', { params: { limit, offset } });
    return PaginatedWeeklySummariesSchema.parse(res.data);
  },
  latestWeekly: async (): Promise<WeeklySummary> => {
    const res = await api.get('/summaries/weekly/latest');
    return WeeklySummarySchema.parse(res.data);
  },
  markRead: async (summaryId: string): Promise<WeeklySummary> => {
    const res = await api.post(`/summaries/weekly/${summaryId}/read`);
    return WeeklySummarySchema.parse(res.data);
  },
  regenerate: async (summaryId: string, reason?: string): Promise<WeeklySummary> => {
    const res = await api.post(`/summaries/weekly/${summaryId}/regenerate`, {
      reason: reason || null,
    });
    return WeeklySummarySchema.parse(res.data);
  },
  listMonthly: async (
    limit = 20,
    offset = 0,
  ): Promise<z.infer<typeof PaginatedMonthlySummariesSchema>> => {
    const res = await api.get('/summaries/monthly', { params: { limit, offset } });
    return PaginatedMonthlySummariesSchema.parse(res.data);
  },
  latestMonthly: async (): Promise<MonthlySummary> => {
    const res = await api.get('/summaries/monthly/latest');
    return MonthlySummarySchema.parse(res.data);
  },
  getMonthlyById: async (summaryId: string): Promise<MonthlySummary> => {
    const res = await api.get(`/summaries/monthly/${summaryId}`);
    return MonthlySummarySchema.parse(res.data);
  },
  markMonthlyRead: async (summaryId: string): Promise<MonthlySummary> => {
    const res = await api.post(`/summaries/monthly/${summaryId}/read`);
    return MonthlySummarySchema.parse(res.data);
  },
  regenerateMonthly: async (summaryId: string, reason?: string): Promise<MonthlySummary> => {
    const res = await api.post(`/summaries/monthly/${summaryId}/regenerate`, {
      reason: reason || null,
    });
    return MonthlySummarySchema.parse(res.data);
  },
  generateMonthly: async (year: number, month: number): Promise<MonthlySummary> => {
    const res = await api.post('/summaries/monthly/generate', { year, month });
    return MonthlySummarySchema.parse(res.data);
  },
  getCadenceSettings: async (): Promise<WorkspaceSummarySetting> => {
    const res = await api.get('/summaries/weekly/settings');
    return WorkspaceSummarySettingSchema.parse(res.data);
  },
  updateCadenceSettings: async (data: {
    cadence_day_of_week: number;
    cadence_hour_utc: number;
  }): Promise<WorkspaceSummarySetting> => {
    const res = await api.put('/summaries/weekly/settings', data);
    return WorkspaceSummarySettingSchema.parse(res.data);
  },
};

