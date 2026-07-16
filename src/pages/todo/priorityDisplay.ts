import type { Todo } from '../../services/todo';

export type TodoPriority = 'low' | 'medium' | 'high';

const isDateOnlyYyyyMmDd = (value: string): boolean => {
  if (value.length !== 10) return false;
  if (value[4] !== '-' || value[7] !== '-') return false;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day);
};

const isDateOnlyDueDate = (value: string): boolean =>
  value.endsWith('T00:00:00Z') || isDateOnlyYyyyMmDd(value);

const endOfLocalDayForDateOnlyDueDate = (value: string): number => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
};

export const isOverdueTodo = (todo: Pick<Todo, 'completed' | 'due_date'>): boolean => {
  if (todo.completed || !todo.due_date) return false;

  const dueDate = todo.due_date;
  const dueTime = isDateOnlyDueDate(dueDate)
    ? endOfLocalDayForDateOnlyDueDate(dueDate)
    : new Date(dueDate).getTime();

  if (Number.isNaN(dueTime)) return false;
  return dueTime < Date.now();
};

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
