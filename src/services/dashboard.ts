import api from './api';
import { BriefingResponseSchema, DashboardSummarySchema } from '../types/dashboard';
import type { BriefingResponse, DashboardSummary } from '../types/dashboard';

export type {
  BriefingLine,
  BriefingResponse,
  BriefingSource,
  DashboardOverspentCategory,
  DashboardSummary,
  DashboardTodoItem,
} from '../types/dashboard';

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get('/dashboard/summary');
    return DashboardSummarySchema.parse(response.data);
  },
  getBriefing: async (): Promise<BriefingResponse> => {
    const response = await api.get('/dashboard/briefing');
    return BriefingResponseSchema.parse(response.data);
  },
};
