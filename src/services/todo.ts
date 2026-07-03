import { z } from 'zod';
import api from './api';

export const TodoSchema = z.object({
  public_id: z.string().default(''),
  title: z.string().default(''),
  description: z.string().catch(''),
  due_date: z.string().nullable().default(null),
  priority: z.enum(['low', 'medium', 'high']).default('low'),
  completed: z.boolean().default(false),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type Todo = z.infer<typeof TodoSchema>;

export interface TodoCreate {
  title: string;
  description?: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
}

export type TodoUpdate = Partial<TodoCreate>;

export type MonthlyMode = 'day_of_month' | 'last_day' | 'nth_weekday';

export const RecurringTodoRuleSchema = z.object({
  public_id: z.string().default(''),
  title: z.string().default(''),
  description: z.string().catch(''),
  priority: z.enum(['low', 'medium', 'high']).default('low'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('daily'),
  interval: z.number().default(1),
  anchor_date: z.string().default(''),
  due_time: z.string().nullable().default(null),
  timezone: z.string().default('UTC'),
  next_due_date: z.string().default(''),
  end_date: z.string().nullable().default(null),
  is_active: z.boolean().default(true),
  last_generated_at: z.string().nullable().default(null),
  monthly_mode: z.enum(['day_of_month', 'last_day', 'nth_weekday']).default('day_of_month'),
  by_weekday: z.number().nullable().default(null),
  by_ordinal: z.number().nullable().default(null),
  created_at: z.string().default(''),
  updated_at: z.string().default(''),
});

export type RecurringTodoRule = z.infer<typeof RecurringTodoRuleSchema>;

export interface RecurringTodoCreate {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  anchor_date: string;
  due_time?: string | null;
  timezone?: string;
  end_date?: string | null;
  monthly_mode?: MonthlyMode;
  by_weekday?: number | null;
  by_ordinal?: number | null;
}

export type RecurringTodoUpdate = Partial<Omit<RecurringTodoCreate, 'anchor_date'>> & {
  is_active?: boolean;
};

const PaginatedTodosSchema = z.object({
  items: z.array(TodoSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const PaginatedRecurringRulesSchema = z.object({
  items: z.array(RecurringTodoRuleSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

export const todoService = {
  getTodos: async (completed?: boolean, limit: number = 50, offset: number = 0): Promise<z.infer<typeof PaginatedTodosSchema>> => {
    const params: Record<string, string | number | boolean> = { limit, offset };
    if (completed !== undefined) {
      params.completed = completed;
    }
    const response = await api.get('/todo/', { params });
    return PaginatedTodosSchema.parse(response.data);
  },
  
  createTodo: async (todo: TodoCreate): Promise<Todo> => {
    const response = await api.post('/todo/', todo);
    return TodoSchema.parse(response.data);
  },
  
  updateTodo: async (publicId: string, todo: TodoUpdate): Promise<Todo> => {
    const response = await api.patch(`/todo/${publicId}`, todo);
    return TodoSchema.parse(response.data);
  },
  
  deleteTodo: async (publicId: string): Promise<void> => {
    await api.delete(`/todo/${publicId}`);
  },

  getRecurringRules: async (isActive: boolean = true, limit: number = 50, offset: number = 0): Promise<z.infer<typeof PaginatedRecurringRulesSchema>> => {
    const response = await api.get('/todo/recurring/', { params: { is_active: isActive, limit, offset } });
    return PaginatedRecurringRulesSchema.parse(response.data);
  },

  createRecurringRule: async (rule: RecurringTodoCreate): Promise<RecurringTodoRule> => {
    const response = await api.post('/todo/recurring/', rule);
    return RecurringTodoRuleSchema.parse(response.data);
  },

  updateRecurringRule: async (publicId: string, rule: RecurringTodoUpdate): Promise<RecurringTodoRule> => {
    const response = await api.patch(`/todo/recurring/${publicId}`, rule);
    return RecurringTodoRuleSchema.parse(response.data);
  },

  deleteRecurringRule: async (publicId: string): Promise<void> => {
    await api.delete(`/todo/recurring/${publicId}`);
  },
};
