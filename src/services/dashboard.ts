import api from './api';
import { DashboardSummarySchema } from '../types/dashboard';
import type { DashboardSummary } from '../types/dashboard';

export type {
  DashboardOverspentCategory,
  DashboardSummary,
  DashboardTodoItem,
} from '../types/dashboard';

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get('/dashboard/summary');
    return DashboardSummarySchema.parse(response.data);
  },
};
