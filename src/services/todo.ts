import { z } from 'zod';
import api from './api';
import { RecurringTodoRuleSchema, TodoSchema } from '../types/todo';
import type {
  RecurringTodoCreate,
  RecurringTodoRule,
  RecurringTodoUpdate,
  Todo,
  TodoCreate,
  TodoUpdate,
} from '../types/todo';

export { RecurringTodoRuleSchema, TodoSchema } from '../types/todo';
export type {
  MonthlyMode,
  RecurringTodoCreate,
  RecurringTodoRule,
  RecurringTodoUpdate,
  Todo,
  TodoCreate,
  TodoUpdate,
} from '../types/todo';

// Todo endpoints predate the shared envelope's required limit/offset, so these
// stay local schemas with optional limit/offset rather than paginatedSchema().
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
