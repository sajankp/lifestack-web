import api from './api';
import type { PaginatedResponse } from '../types/common';

export interface WeeklySummary {
  public_id: string;
  week_start: string;
  week_end: string;
  generated_at: string;
  todo_summary: Record<string, unknown>;
  spending_summary: Record<string, unknown>;
  investing_summary: Record<string, unknown>;
  highlights: Record<string, unknown>;
}

export const summariesService = {
  listWeekly: async (limit = 20, offset = 0): Promise<PaginatedResponse<WeeklySummary>> => {
    const res = await api.get('/summaries/weekly', { params: { limit, offset } });
    return res.data;
  },
  latestWeekly: async (): Promise<WeeklySummary> => {
    const res = await api.get('/summaries/weekly/latest');
    return res.data;
  },
};
