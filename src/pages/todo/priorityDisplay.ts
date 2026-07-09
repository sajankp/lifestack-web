import type { Todo } from '../../services/todo';

export type TodoPriority = 'low' | 'medium' | 'high';

export const isOverdueTodo = (todo: Pick<Todo, 'completed' | 'due_date'>): boolean =>
  !todo.completed && !!todo.due_date && new Date(todo.due_date).getTime() < Date.now();

export const priorityLabel = (priority: TodoPriority | undefined): string => {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    default:
      return 'Low';
  }
};

export const priorityTone = (priority: TodoPriority | undefined): string => {
  switch (priority) {
    case 'high':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
    case 'medium':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    default:
      return 'border-slate-600/70 bg-slate-900/60 text-slate-200';
  }
};
