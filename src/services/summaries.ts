import type { z } from 'zod';
import api from './api';
import { paginatedSchema } from '../types/common';
import { WeeklySummarySchema } from '../types/summaries';
import type { WeeklySummary } from '../types/summaries';

export type { WeeklySummary } from '../types/summaries';

const PaginatedWeeklySummariesSchema = paginatedSchema(WeeklySummarySchema);

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
};
