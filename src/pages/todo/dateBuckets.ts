import type { Todo } from '../../services/todo';

export type TodoBucketLabel = 'Overdue' | 'Today' | 'Upcoming' | 'Later' | 'No due date';

export interface TodoBucket {
  label: TodoBucketLabel;
  todos: Todo[];
}

const UPCOMING_WINDOW_DAYS = 7;

const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Buckets a due date against "today" in the browser's local timezone
 * (spec-068 owner decision: the briefing keeps a server-side UTC boundary —
 * the two can differ overnight, accepted for v1). */
export function bucketForDueDate(dueDate: string | null, now: Date): TodoBucketLabel {
  if (!dueDate) return 'No due date';
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'No due date';

  const today = startOfLocalDay(now);
  const dueDay = startOfLocalDay(due);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays <= UPCOMING_WINDOW_DAYS) return 'Upcoming';
  return 'Later';
}

const BUCKET_ORDER: TodoBucketLabel[] = ['Overdue', 'Today', 'Upcoming', 'Later', 'No due date'];

/** Groups top-level (non-subtask) todos into date buckets, preserving the
 * server-provided order (due_date asc, priority, created_at) within each
 * bucket. Empty buckets are omitted. */
export function groupTodosByDueDate(topLevelTodos: Todo[], now: Date): TodoBucket[] {
  const byLabel = new Map<TodoBucketLabel, Todo[]>();
  for (const todo of topLevelTodos) {
    const label = bucketForDueDate(todo.due_date, now);
    const list = byLabel.get(label);
    if (list) {
      list.push(todo);
    } else {
      byLabel.set(label, [todo]);
    }
  }
  return BUCKET_ORDER.map((label) => ({ label, todos: byLabel.get(label) ?? [] })).filter(
    (bucket) => bucket.todos.length > 0,
  );
}

/** Splits a flat, globally-sorted todo list into top-level todos and a
 * parent-id -> children lookup, for one-level subtask nesting. */
export function splitParentsAndChildren(todos: Todo[]): {
  topLevel: Todo[];
  childrenByParentId: Map<string, Todo[]>;
} {
  const todoIds = new Set(todos.map((t) => t.public_id));
  const topLevel: Todo[] = [];
  const childrenByParentId = new Map<string, Todo[]>();
  for (const todo of todos) {
    // A subtask whose parent isn't in this fetch (completed, deleted, or on
    // a later page) would otherwise be silently hidden — render it as
    // top-level instead so it never disappears from the view.
    if (!todo.parent_public_id || !todoIds.has(todo.parent_public_id)) {
      topLevel.push(todo);
      continue;
    }
    const list = childrenByParentId.get(todo.parent_public_id);
    if (list) {
      list.push(todo);
    } else {
      childrenByParentId.set(todo.parent_public_id, [todo]);
    }
  }
  return { topLevel, childrenByParentId };
}
