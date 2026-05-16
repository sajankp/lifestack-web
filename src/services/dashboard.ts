import api from './api';

export interface DashboardTodoItem {
  public_id?: string;
  title?: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
}

export interface DashboardOverspentCategory {
  category_id?: string;
  name?: string;
  budget?: number | null;
  amount?: number;
  overage?: number;
}

export interface DashboardSummary {
  todos: {
    open_count: number;
    overdue_count: number;
    next_due_items: DashboardTodoItem[];
    active_guardrail_todo_count: number;
  };
  spending: {
    month_spent: number;
    month_budget: number | null;
    top_overspent_categories: DashboardOverspentCategory[];
  };
  investing: {
    portfolio_value: number;
    daily_change: number | null;
    holdings_count: number;
  };
  system: {
    generated_at: string;
  };
}

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get('/dashboard/summary');
    return response.data;
  },
};
