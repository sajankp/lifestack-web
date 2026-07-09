import React from 'react';
import { CheckCircle2, Circle, Edit2, Plus, Trash2 } from 'lucide-react';
import type { Todo } from '../../services/todo';
import { isOverdueTodo, priorityLabel, priorityTone } from './priorityDisplay';

// Row actions (edit/delete/add-subtask) must never rely on hover as their
// only reveal path — on touch/coarse-pointer devices (including the
// installed PWA) hover never fires, so the icons render always-visible
// there at reduced emphasis; on fine-pointer devices the hover-reveal
// stays as polish (spec-068 owner requirement, 2026-07-09).
const rowActionsClassName =
  'ml-3 flex shrink-0 items-center gap-1 opacity-100 pointer-coarse:opacity-100 sm:opacity-0 sm:transition-all sm:group-hover:opacity-100';

export interface TaskRowProps {
  todo: Todo;
  formatDueDateTime: (value: string | null | undefined) => string | null;
  isSubtask?: boolean;
  subtasks?: Todo[];
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDeleteRequest: (todo: Todo) => void;
  onAddSubtask?: (parent: Todo) => void;
  isToggling?: boolean;
  isDeleting?: boolean;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  todo,
  formatDueDateTime,
  isSubtask = false,
  subtasks = [],
  onToggle,
  onEdit,
  onDeleteRequest,
  onAddSubtask,
  isToggling = false,
  isDeleting = false,
}) => {
  const dueLabel = formatDueDateTime(todo.due_date);

  return (
    <div className={isSubtask ? 'pl-8' : ''}>
      <div
        key={todo.public_id}
        data-testid={`todo-item-${todo.public_id}`}
        className={`group flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/45 px-4 py-3 transition-all hover:border-slate-600 ${todo.completed ? 'opacity-60' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            data-testid={`todo-toggle-${todo.public_id}`}
            aria-label={todo.completed ? `Mark todo as incomplete: ${todo.title}` : `Mark todo as complete: ${todo.title}`}
            onClick={() => onToggle(todo)}
            disabled={isToggling}
            className="shrink-0 text-slate-400 transition-colors hover:text-cyan-500 disabled:opacity-50"
          >
            {todo.completed ? <CheckCircle2 className="h-5 w-5 text-cyan-400" /> : <Circle className="h-5 w-5" />}
          </button>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className={`truncate text-sm font-semibold text-white ${todo.completed ? 'line-through text-slate-400' : ''}`}>
                {todo.title}
              </h3>
              {!isSubtask && todo.subtask_count > 0 ? (
                <span
                  data-testid={`todo-subtask-progress-${todo.public_id}`}
                  className="rounded border border-slate-600/70 bg-slate-900/60 px-1.5 py-0.5 text-xs text-slate-300"
                >
                  {/* The open-todos fetch excludes completed=true rows, so a
                      completed subtask isn't among `subtasks` — done count is
                      derived from the server's total minus what's still open,
                      not from subtasks.length (spec-068). */}
                  {todo.subtask_count - subtasks.length}/{todo.subtask_count}
                </span>
              ) : null}
              <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${priorityTone(todo.priority)}`}>
                {priorityLabel(todo.priority)}
              </span>
              {dueLabel ? (
                <span className={`text-xs ${isOverdueTodo(todo) ? 'text-rose-400 font-semibold flex items-center gap-1 bg-rose-950/40 border border-rose-900/50 rounded px-1.5 py-0.5' : 'text-slate-400'}`}>
                  {isOverdueTodo(todo) && <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />}
                  {isOverdueTodo(todo) ? 'Overdue: ' : 'Due: '}{dueLabel}
                </span>
              ) : null}
            </div>
            {todo.description ? (
              <p className="mt-0.5 truncate text-sm text-slate-300">{todo.description}</p>
            ) : null}
          </div>
        </div>

        <div className={rowActionsClassName}>
          {!isSubtask && onAddSubtask ? (
            <button
              type="button"
              data-testid={`todo-add-subtask-${todo.public_id}`}
              onClick={() => onAddSubtask(todo)}
              className="rounded p-2 text-slate-500 hover:bg-slate-700/60 hover:text-slate-100"
              title="Add subtask"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            data-testid={`todo-edit-${todo.public_id}`}
            onClick={() => onEdit(todo)}
            className="rounded p-2 text-slate-500 hover:bg-slate-700/60 hover:text-slate-100"
            title="Edit task"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-testid={`todo-delete-${todo.public_id}`}
            disabled={isDeleting}
            onClick={() => onDeleteRequest(todo)}
            className="rounded p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isSubtask && subtasks.length > 0 ? (
        <div className="mt-2 space-y-2">
          {subtasks.map((child) => (
            <TaskRow
              key={child.public_id}
              todo={child}
              formatDueDateTime={formatDueDateTime}
              isSubtask
              onToggle={onToggle}
              onEdit={onEdit}
              onDeleteRequest={onDeleteRequest}
              isToggling={isToggling}
              isDeleting={isDeleting}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
