import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Edit2, Plus, Trash2 } from 'lucide-react';

import { DropdownSelect } from '../components/DropdownSelect';
import { DatePicker } from '../components/DatePicker';
import { TimePicker } from '../components/TimePicker';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Pagination } from '../components/Pagination';
import { SkeletonList } from '../components/ui/FeedbackStates';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { useInvalidatingMutation } from '../hooks/useInvalidatingMutation';
import { queryKeys } from '../lib/queryKeys';
import { todoService } from '../services/todo';
import type { MonthlyMode, RecurringTodoCreate, RecurringTodoRule, Todo, TodoCreate } from '../services/todo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { describeRecurrence } from '../utils/recurrenceLabel';
import { groupTodosByDueDate, splitParentsAndChildren } from './todo/dateBuckets';
import { priorityLabel, priorityTone } from './todo/priorityDisplay';
import { TaskRow } from './todo/TaskRow';

const rowActionsClassName =
  'ml-3 flex shrink-0 items-center gap-1 opacity-100 pointer-coarse:opacity-100 sm:opacity-0 sm:transition-all sm:group-hover:opacity-100';

const OPEN_TASKS_PAGE_SIZE = 200;
const COMPLETED_PAGE_SIZE = 50;

type TodoPriority = 'low' | 'medium' | 'high';
type TodoFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

const priorityOptions: Array<{ value: TodoPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const frequencyOptions: Array<{ value: TodoFrequency; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const monthlyModeOptions: Array<{ value: MonthlyMode; label: string }> = [
  { value: 'day_of_month', label: 'On day N' },
  { value: 'last_day', label: 'On the last day' },
  { value: 'nth_weekday', label: 'On the Nth weekday' },
];

const weekdayOptions = [
  { value: '0', label: 'Monday' },
  { value: '1', label: 'Tuesday' },
  { value: '2', label: 'Wednesday' },
  { value: '3', label: 'Thursday' },
  { value: '4', label: 'Friday' },
  { value: '5', label: 'Saturday' },
  { value: '6', label: 'Sunday' },
];

const ordinalOptions = [
  { value: '1', label: 'First' },
  { value: '2', label: 'Second' },
  { value: '3', label: 'Third' },
  { value: '4', label: 'Fourth' },
  { value: '-1', label: 'Last' },
];

const isUtcMidnight = (value: string): boolean =>
  /T00:00:00(?:\.\d+)?Z$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value);

const toLocalDateInput = (value: string | null | undefined): string => {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  if (isUtcMidnight(value)) return value.slice(0, 10);
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const toLocalTimeInput = (value: string | null | undefined): string => {
  if (!value || Number.isNaN(Date.parse(value)) || isUtcMidnight(value)) return '';
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const toIsoDueDate = (yyyyMmDd: string, hhMm: string): string | null => {
  if (!yyyyMmDd) return null;
  if (!hhMm) return `${yyyyMmDd}T00:00:00Z`;
  const localDateTime = new Date(`${yyyyMmDd}T${hhMm}:00`);
  if (Number.isNaN(localDateTime.getTime())) return null;
  return localDateTime.toISOString();
};

const formatDueDateTime = (value: string | null | undefined): string | null => {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  if (isUtcMidnight(value)) {
    return formatDate(value);
  }
  return formatDateTime(value, { utc: false });
};

const formatUtcDate = (value: string | null | undefined): string | null => {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return formatDate(value);
};

export const TodoPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    priority: 'low' as TodoPriority,
  });
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [subtaskParent, setSubtaskParent] = useState<Todo | null>(null);
  const [removeFromParent, setRemoveFromParent] = useState(false);
  const [pendingDeleteTodo, setPendingDeleteTodo] = useState<Todo | null>(null);
  const [pendingDeleteRuleId, setPendingDeleteRuleId] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [openLimit, setOpenLimit] = useState(OPEN_TASKS_PAGE_SIZE);
  const [completedOffset, setCompletedOffset] = useState(0);
  const [isCompletedOpen, setIsCompletedOpen] = useState(
    () => new URLSearchParams(window.location.search).get('status') === 'completed',
  );
  const [isClearCompletedOpen, setIsClearCompletedOpen] = useState(false);

  // Deep links using ?status=completed must expand the section even when
  // they're followed via in-app navigation (not just the initial mount).
  useEffect(() => {
    if (searchParams.get('status') === 'completed') {
      setIsCompletedOpen(true);
    }
  }, [searchParams]);

  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [rulePriority, setRulePriority] = useState<TodoPriority>('low');
  const [ruleAnchorDate, setRuleAnchorDate] = useState('');
  const [ruleDueTime, setRuleDueTime] = useState('');
  const [ruleEndDate, setRuleEndDate] = useState('');
  const [ruleFrequency, setRuleFrequency] = useState<TodoFrequency>('weekly');
  const [ruleInterval, setRuleInterval] = useState(1);
  const [ruleMonthlyMode, setRuleMonthlyMode] = useState<MonthlyMode>('day_of_month');
  const [ruleByWeekday, setRuleByWeekday] = useState(0);
  const [ruleByOrdinal, setRuleByOrdinal] = useState(1);
  const [editingRecurringRule, setEditingRecurringRule] = useState<RecurringTodoRule | null>(null);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);

  const { data: openTodosResponse, isLoading } = useQuery({
    queryKey: queryKeys.todo.list('open', openLimit),
    queryFn: () => todoService.getTodos(false, openLimit, 0, 'due_date'),
  });

  const { data: completedTodosResponse, isLoading: isCompletedLoading } = useQuery({
    queryKey: queryKeys.todo.list('completed', completedOffset),
    queryFn: () => todoService.getTodos(true, COMPLETED_PAGE_SIZE, completedOffset),
    enabled: isCompletedOpen,
  });

  const { data: recurringResponse, isLoading: isRecurringLoading } = useQuery({
    queryKey: queryKeys.todo.recurring(),
    queryFn: () => todoService.getRecurringRules(true, 100, 0),
  });

  const { topLevel: topLevelTodos, childrenByParentId } = splitParentsAndChildren(
    openTodosResponse?.items ?? [],
  );
  const dateBuckets = groupTodosByDueDate(topLevelTodos, new Date());
  const parentTitleById = new Map(
    [...(openTodosResponse?.items ?? []), ...(completedTodosResponse?.items ?? [])].map((t) => [
      t.public_id,
      t.title,
    ]),
  );
  const editingParentTitle = editingTodo?.parent_public_id
    ? parentTitleById.get(editingTodo.parent_public_id)
    : undefined;

  // Header "+ Todo" quick-add navigates here with ?new=1; open the create
  // modal once, then strip the param so back/refresh doesn't reopen it.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openNewTaskModal();
      setSearchParams((params) => {
        params.delete('new');
        return params;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const createMutation = useInvalidatingMutation(
    (newTodo: TodoCreate) => todoService.createTodo(newTodo),
    [queryKeys.todo.list(), queryKeys.dashboard.all],
    { onSuccess: closeTaskModal },
  );

  const updateMutation = useInvalidatingMutation(
    (payload: { id: string; data: TodoCreate }) => todoService.updateTodo(payload.id, payload.data),
    [queryKeys.todo.list(), queryKeys.dashboard.all],
    { onSuccess: closeTaskModal },
  );

  const toggleMutation = useInvalidatingMutation(
    (todo: Todo) => todoService.updateTodo(todo.public_id, { completed: !todo.completed }),
    [queryKeys.todo.list(), queryKeys.dashboard.all],
    { successMessage: false, errorMessage: 'Could not update that task. Please try again.' },
  );

  const deleteMutation = useInvalidatingMutation(
    (id: string) => todoService.deleteTodo(id),
    [queryKeys.todo.list(), queryKeys.dashboard.all],
    {
      successMessage: 'Task deleted',
      errorMessage: 'Could not delete that task. Please try again.',
      onSuccess: () => setPendingDeleteTodo(null),
    },
  );

  const { showToast } = useToast();
  const clearCompletedMutation = useInvalidatingMutation(
    () => todoService.clearCompletedTodos(),
    [queryKeys.todo.list(), queryKeys.dashboard.all],
    {
      successMessage: false,
      errorMessage: 'Could not clear completed tasks. Please try again.',
      onSuccess: (result) => {
        setIsClearCompletedOpen(false);
        showToast(`Cleared ${result.deleted} completed task${result.deleted === 1 ? '' : 's'}`, 'success');
      },
    },
  );

  const createRuleMutation = useInvalidatingMutation(
    (payload: RecurringTodoCreate) => todoService.createRecurringRule(payload),
    [queryKeys.todo.recurring()],
    { successMessage: 'Recurring todo created', onSuccess: closeRecurringModal },
  );

  const updateRuleMutation = useInvalidatingMutation(
    (payload: { id: string; data: Omit<RecurringTodoCreate, 'anchor_date'> }) =>
      todoService.updateRecurringRule(payload.id, payload.data),
    [queryKeys.todo.recurring()],
    { successMessage: 'Recurring todo updated', onSuccess: closeRecurringModal },
  );

  const deleteRuleMutation = useInvalidatingMutation(
    (id: string) => todoService.deleteRecurringRule(id),
    [queryKeys.todo.recurring()],
    {
      successMessage: 'Recurring todo deleted',
      errorMessage: 'Could not delete that recurring todo. Please try again.',
      onSuccess: () => setPendingDeleteRuleId(null),
    },
  );

  function closeTaskModal() {
    setTaskForm({
      title: '',
      description: '',
      due_date: '',
      due_time: '',
      priority: 'low',
    });
    setEditingTodo(null);
    setSubtaskParent(null);
    setRemoveFromParent(false);
    setIsTaskModalOpen(false);
  }

  function openNewTaskModal() {
    setTaskForm({
      title: '',
      description: '',
      due_date: '',
      due_time: '',
      priority: 'low',
    });
    setEditingTodo(null);
    setSubtaskParent(null);
    setRemoveFromParent(false);
    setIsTaskModalOpen(true);
  }

  function openNewSubtaskModal(parent: Todo) {
    setTaskForm({
      title: '',
      description: '',
      due_date: '',
      due_time: '',
      priority: 'low',
    });
    setEditingTodo(null);
    setSubtaskParent(parent);
    setRemoveFromParent(false);
    setIsTaskModalOpen(true);
  }

  function openEditTaskModal(todo: Todo) {
    setTaskForm({
      title: todo.title,
      description: todo.description ?? '',
      due_date: toLocalDateInput(todo.due_date),
      due_time: toLocalTimeInput(todo.due_date),
      priority: todo.priority ?? 'low',
    });
    setEditingTodo(todo);
    setSubtaskParent(null);
    setRemoveFromParent(false);
    setIsTaskModalOpen(true);
  }

  function closeRecurringModal() {
    setRuleTitle('');
    setRuleDescription('');
    setRulePriority('low');
    setRuleAnchorDate('');
    setRuleDueTime('');
    setRuleEndDate('');
    setRuleFrequency('weekly');
    setRuleInterval(1);
    setEditingRecurringRule(null);
    setIsRecurringModalOpen(false);
  }

  function openNewRecurringModal() {
    setRuleTitle('');
    setRuleDescription('');
    setRulePriority('low');
    setRuleAnchorDate('');
    setRuleDueTime('');
    setRuleEndDate('');
    setRuleFrequency('weekly');
    setRuleInterval(1);
    setRuleMonthlyMode('day_of_month');
    setRuleByWeekday(0);
    setRuleByOrdinal(1);
    setEditingRecurringRule(null);
    setIsRecurringModalOpen(true);
  }

  function openEditRecurringModal(rule: RecurringTodoRule) {
    setRuleTitle(rule.title);
    setRuleDescription(rule.description ?? '');
    setRulePriority(rule.priority ?? 'low');
    setRuleAnchorDate(rule.anchor_date);
    setRuleDueTime(rule.due_time?.slice(0, 5) ?? '');
    setRuleEndDate(rule.end_date ?? '');
    setRuleFrequency(rule.frequency);
    setRuleInterval(rule.interval);
    setRuleMonthlyMode(rule.monthly_mode ?? 'day_of_month');
    setRuleByWeekday(rule.by_weekday ?? 0);
    setRuleByOrdinal(rule.by_ordinal ?? 1);
    setEditingRecurringRule(rule);
    setIsRecurringModalOpen(true);
  }

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    const payload: TodoCreate = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      due_date: toIsoDueDate(taskForm.due_date, taskForm.due_time),
      priority: taskForm.priority,
    };
    if (editingTodo) {
      if (removeFromParent) {
        payload.parent_public_id = null;
      }
      updateMutation.mutate({ id: editingTodo.public_id, data: payload });
      return;
    }
    if (subtaskParent) {
      payload.parent_public_id = subtaskParent.public_id;
    }
    createMutation.mutate(payload);
  };

  const isNthWeekdayMode = ruleFrequency === 'monthly' && ruleMonthlyMode === 'nth_weekday';

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || !ruleAnchorDate) return;
    createRuleMutation.mutate({
      title: ruleTitle.trim(),
      description: ruleDescription || undefined,
      priority: rulePriority,
      frequency: ruleFrequency,
      interval: Math.max(1, ruleInterval),
      anchor_date: ruleAnchorDate,
      due_time: ruleDueTime || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      end_date: ruleEndDate || null,
      monthly_mode: ruleFrequency === 'monthly' ? ruleMonthlyMode : 'day_of_month',
      by_weekday: isNthWeekdayMode ? ruleByWeekday : null,
      by_ordinal: isNthWeekdayMode ? ruleByOrdinal : null,
    });
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || (!editingRecurringRule && !ruleAnchorDate)) return;
    if (editingRecurringRule) {
      updateRuleMutation.mutate({
        id: editingRecurringRule.public_id,
        data: {
          title: ruleTitle.trim(),
          description: ruleDescription || undefined,
          priority: rulePriority,
          frequency: ruleFrequency,
          interval: Math.max(1, ruleInterval),
          due_time: ruleDueTime || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          end_date: ruleEndDate || null,
          monthly_mode: ruleFrequency === 'monthly' ? ruleMonthlyMode : 'day_of_month',
          by_weekday: isNthWeekdayMode ? ruleByWeekday : null,
          by_ordinal: isNthWeekdayMode ? ruleByOrdinal : null,
        },
      });
      return;
    }
    handleCreateRule(e);
  };

  return (
    <PageShell>
      <PageHero
        title="Todos"
        subtitle="Manage your tasks and recurring todos for this workspace."
        actions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="todo-add-task"
              onClick={openNewTaskModal}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
            <button
              type="button"
              onClick={openNewRecurringModal}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" />
              New recurring todo
            </button>
          </div>
        )}
      />

      <Dialog open={isTaskModalOpen} onOpenChange={(open) => !open && closeTaskModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-slate-800 pb-4 mb-4">
            <DialogTitle>
              {subtaskParent
                ? `New subtask for "${subtaskParent.title}"`
                : editingTodo ? 'Edit task' : 'New task'}
            </DialogTitle>
          </DialogHeader>
          {isTaskModalOpen && (
            <form onSubmit={handleSaveTask} className="space-y-4">
              {editingTodo?.parent_public_id && !removeFromParent ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
                  <span data-testid="todo-edit-parent-chip">
                    Subtask of: <span className="font-semibold text-slate-100">{editingParentTitle ?? 'parent task'}</span>
                  </span>
                  <button
                    type="button"
                    data-testid="todo-remove-from-parent"
                    onClick={() => setRemoveFromParent(true)}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    Remove from parent
                  </button>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <label htmlFor="todo-new-title" className="text-sm font-semibold text-slate-300">What needs to be done?</label>
                <input
                  id="todo-new-title"
                  data-testid="todo-new-title"
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((s) => ({ ...s, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-white placeholder-slate-400 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="todo-new-description" className="text-sm font-semibold text-slate-300">Description (optional)</label>
                <textarea
                  id="todo-new-description"
                  data-testid="todo-new-description"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Add useful context"
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="todo-new-priority" className="text-sm font-semibold text-slate-300">Priority</label>
                  <DropdownSelect
                    id="todo-new-priority"
                    testId="todo-new-priority"
                    value={taskForm.priority}
                    onChange={(value) => setTaskForm((s) => ({ ...s, priority: value as TodoPriority }))}
                    options={priorityOptions}
                    placeholder="Priority"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-300">Due date (optional)</label>
                  <DatePicker
                    testId="todo-new-due-date"
                    value={taskForm.due_date}
                    onChange={(value) =>
                      setTaskForm((s) => ({
                        ...s,
                        due_date: value,
                        due_time: value ? s.due_time : '',
                      }))
                    }
                    placeholder="Select due date"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-300">Due time (optional)</label>
                  <TimePicker
                    testId="todo-new-due-time"
                    value={taskForm.due_time}
                    onChange={(value) => setTaskForm((s) => ({ ...s, due_time: value }))}
                    disabled={!taskForm.due_date || createMutation.isPending || updateMutation.isPending}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  data-testid="todo-new-submit"
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || !taskForm.title.trim()}
                  className="flex-1 h-10 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingTodo ? 'Save Task' : 'Add Task'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Tabs
        value={searchParams.get('tab') || 'tasks'}
        onValueChange={(value) => {
          setSearchParams((params) => {
            const nextParams = new URLSearchParams(params);
            nextParams.set('tab', value);
            return nextParams;
          });
        }}
        className="w-full"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="tasks" data-testid="todo-tab-tasks">Tasks</TabsTrigger>
          <TabsTrigger value="recurring" data-testid="todo-tab-recurring">Recurring todos</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-6 focus-visible:outline-none">
          {isLoading ? (
            <SkeletonList rows={4} />
          ) : (
            <div className="space-y-6">
              {topLevelTodos.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-8 text-center">
                  <p className="text-slate-300">No tasks yet.</p>
                  <p className="mt-1 text-sm text-slate-500">Create your first task above to get started.</p>
                </div>
              ) : (
                dateBuckets.map((bucket) => (
                  <div key={bucket.label} data-testid={`todo-bucket-${bucket.label.replace(/\s+/g, '-').toLowerCase()}`}>
                    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                      {bucket.label}
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
                        {bucket.todos.length}
                      </span>
                    </h2>
                    <div className="space-y-3">
                      {bucket.todos.map((todo) => (
                        <TaskRow
                          key={todo.public_id}
                          todo={todo}
                          formatDueDateTime={formatDueDateTime}
                          subtasks={childrenByParentId.get(todo.public_id) ?? []}
                          onToggle={(t) => toggleMutation.mutate(t)}
                          onEdit={openEditTaskModal}
                          onDeleteRequest={setPendingDeleteTodo}
                          onAddSubtask={openNewSubtaskModal}
                          isToggling={toggleMutation.isPending}
                          isDeleting={deleteMutation.isPending}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}

              {openTodosResponse && openTodosResponse.total > openTodosResponse.items.length ? (
                <button
                  type="button"
                  data-testid="todo-load-more-open"
                  onClick={() => setOpenLimit((n) => n + OPEN_TASKS_PAGE_SIZE)}
                  className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  {openTodosResponse.total - openTodosResponse.items.length} more not shown — load more
                </button>
              ) : null}

              <div className="border-t border-slate-800 pt-4">
                <div className="flex w-full items-center gap-2 text-sm font-semibold text-slate-300">
                  <button
                    type="button"
                    data-testid="todo-completed-toggle"
                    onClick={() => setIsCompletedOpen((v) => !v)}
                    className="flex items-center gap-2 text-left hover:text-white"
                  >
                    {isCompletedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Completed
                    {completedTodosResponse ? (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
                        {completedTodosResponse.total}
                      </span>
                    ) : null}
                  </button>
                  {isCompletedOpen && completedTodosResponse && completedTodosResponse.total > 0 ? (
                    <button
                      type="button"
                      data-testid="todo-clear-completed"
                      onClick={() => setIsClearCompletedOpen(true)}
                      className="ml-auto rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      Clear completed
                    </button>
                  ) : null}
                </div>

                {isCompletedOpen ? (
                  isCompletedLoading ? (
                    <div className="mt-3">
                      <SkeletonList rows={2} />
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {(completedTodosResponse?.items.length ?? 0) === 0 ? (
                        <p className="text-sm text-slate-500">No completed tasks.</p>
                      ) : (
                        <>
                          {completedTodosResponse?.items.map((todo) => (
                            <div
                              key={todo.public_id}
                              data-testid={`todo-completed-item-${todo.public_id}`}
                              className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 opacity-70"
                            >
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="truncate text-sm text-slate-300 line-through">{todo.title}</span>
                                  {todo.parent_public_id && parentTitleById.get(todo.parent_public_id) ? (
                                    <span className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-500">
                                      ↳ {parentTitleById.get(todo.parent_public_id)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className={rowActionsClassName}>
                                <button
                                  type="button"
                                  data-testid={`todo-delete-${todo.public_id}`}
                                  disabled={deleteMutation.isPending}
                                  onClick={() => setPendingDeleteTodo(todo)}
                                  className="rounded p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                                  title="Delete task"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {completedTodosResponse && (
                            <Pagination
                              total={completedTodosResponse.total}
                              limit={completedTodosResponse.limit}
                              offset={completedTodosResponse.offset}
                              onPageChange={setCompletedOffset}
                            />
                          )}
                        </>
                      )}
                    </div>
                  )
                ) : null}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recurring" className="space-y-6 focus-visible:outline-none">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Recurring todos</h2>
          </div>

          {isRecurringLoading ? (
            <SkeletonList rows={2} />
          ) : (
            <div className="space-y-3">
              {(recurringResponse?.items ?? []).length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-8 text-center">
                  <p className="text-slate-300">No recurring todos yet.</p>
                  <p className="mt-1 text-sm text-slate-500">Create one to auto-generate routine tasks.</p>
                  <button
                    type="button"
                    onClick={openNewRecurringModal}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    <Plus className="h-4 w-4" />
                    Create first recurring todo
                  </button>
                </div>
              ) : (
                recurringResponse?.items.map((rule) => (
                  <div key={rule.public_id} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{rule.title}</h3>
                        {rule.description ? (
                          <p className="mt-1 text-sm text-slate-300">{rule.description}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${priorityTone(rule.priority)}`}>
                            {priorityLabel(rule.priority)}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border ${rule.is_active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${rule.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                            {rule.is_active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          {describeRecurrence(rule)} | Next:{' '}
                          {formatUtcDate(rule.next_due_date) ?? 'N/A'}
                          {rule.due_time ? ` at ${rule.due_time.slice(0, 5)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`todo-recurring-edit-${rule.public_id}`}
                          onClick={() => openEditRecurringModal(rule)}
                          className="rounded p-2 text-slate-500 hover:bg-slate-700/60 hover:text-slate-100"
                          title="Edit recurring todo"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          data-testid={`todo-recurring-delete-${rule.public_id}`}
                          disabled={deleteRuleMutation.isPending}
                          onClick={() => setPendingDeleteRuleId(rule.public_id)}
                          className="rounded p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                          title="Delete recurring todo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isRecurringModalOpen} onOpenChange={(open) => !open && closeRecurringModal()}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="border-b border-slate-800 px-5 py-4">
            <DialogTitle>{editingRecurringRule ? 'Edit recurring todo' : 'Create recurring todo'}</DialogTitle>
          </DialogHeader>
          {isRecurringModalOpen && (
            <form onSubmit={handleSaveRule} className="space-y-4 p-5">
              <input
                data-testid="todo-recurring-title"
                type="text"
                aria-label="Title"
                value={ruleTitle}
                onChange={(e) => setRuleTitle(e.target.value)}
                placeholder="Title (e.g. Weekly grocery planning)"
                className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                required
              />
              <input
                data-testid="todo-recurring-description"
                type="text"
                aria-label="Description"
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <DropdownSelect
                testId="todo-recurring-priority"
                aria-label="Priority"
                value={rulePriority}
                onChange={(value) => setRulePriority(value as TodoPriority)}
                options={priorityOptions}
                placeholder="Priority"
              />
              <div className="grid grid-cols-2 gap-3">
                <DropdownSelect
                  testId="todo-recurring-frequency"
                  aria-label="Frequency"
                  value={ruleFrequency}
                  onChange={(value) => setRuleFrequency(value as TodoFrequency)}
                  options={frequencyOptions}
                  placeholder="Frequency"
                />
                <input
                  data-testid="todo-recurring-interval"
                  type="number"
                  aria-label="Repeat interval"
                  min={1}
                  value={ruleInterval}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setRuleInterval(Number.isNaN(val) ? 1 : val);
                  }}
                  className="h-10 rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              {ruleFrequency === 'monthly' ? (
                <div className="space-y-3">
                  <DropdownSelect
                    testId="todo-recurring-monthly-mode"
                    value={ruleMonthlyMode}
                    onChange={(value) => setRuleMonthlyMode(value as MonthlyMode)}
                    options={monthlyModeOptions}
                    placeholder="Monthly mode"
                  />
                  {isNthWeekdayMode ? (
                    <div className="grid grid-cols-2 gap-3">
                      <DropdownSelect
                        testId="todo-recurring-ordinal"
                        value={String(ruleByOrdinal)}
                        onChange={(value) => setRuleByOrdinal(parseInt(value, 10))}
                        options={ordinalOptions}
                        placeholder="Occurrence"
                      />
                      <DropdownSelect
                        testId="todo-recurring-weekday"
                        value={String(ruleByWeekday)}
                        onChange={(value) => setRuleByWeekday(parseInt(value, 10))}
                        options={weekdayOptions}
                        placeholder="Weekday"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <TimePicker
                testId="todo-recurring-due-time"
                value={ruleDueTime}
                onChange={setRuleDueTime}
                placeholder="Recurring due time"
              />
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  value={ruleAnchorDate}
                  onChange={setRuleAnchorDate}
                  placeholder="Start date"
                  required
                  disabled={!!editingRecurringRule}
                  testId="todo-recurring-anchor-date"
                />
                <DatePicker
                  value={ruleEndDate}
                  onChange={setRuleEndDate}
                  placeholder="End date (optional)"
                  testId="todo-recurring-end-date"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeRecurringModal}
                  className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createRuleMutation.isPending ||
                    updateRuleMutation.isPending ||
                    !ruleTitle.trim() ||
                    (!editingRecurringRule && !ruleAnchorDate)
                  }
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {createRuleMutation.isPending || updateRuleMutation.isPending
                    ? 'Saving...'
                    : editingRecurringRule ? 'Save recurring todo' : 'Create recurring todo'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDeleteTodo}
        onOpenChange={(open) => !open && setPendingDeleteTodo(null)}
        title="Delete task?"
        description={(() => {
          if (!pendingDeleteTodo) return 'This cannot be undone.';
          const subtaskCount = pendingDeleteTodo.subtask_count;
          const suffix = subtaskCount > 0 ? ` This will also delete its ${subtaskCount} subtasks.` : '';
          return `Delete "${pendingDeleteTodo.title}"? This cannot be undone.${suffix}`;
        })()}
        isPending={deleteMutation.isPending}
        isError={deleteMutation.isError}
        errorMessage="Could not delete that task. Please try again."
        onConfirm={() => pendingDeleteTodo && deleteMutation.mutate(pendingDeleteTodo.public_id)}
      />

      <ConfirmDialog
        open={isClearCompletedOpen}
        onOpenChange={setIsClearCompletedOpen}
        title="Clear completed tasks?"
        description={`This will permanently delete all ${completedTodosResponse?.total ?? 0} completed tasks. This cannot be undone.`}
        confirmLabel="Clear completed"
        pendingLabel="Clearing…"
        isPending={clearCompletedMutation.isPending}
        isError={clearCompletedMutation.isError}
        errorMessage="Could not clear completed tasks. Please try again."
        onConfirm={() => clearCompletedMutation.mutate()}
      />

      <ConfirmDialog
        open={!!pendingDeleteRuleId}
        onOpenChange={(open) => !open && setPendingDeleteRuleId(null)}
        title="Delete recurring todo?"
        description={(() => {
          const rule = recurringResponse?.items.find((r) => r.public_id === pendingDeleteRuleId);
          return rule
            ? `Delete the recurring rule "${rule.title}"? Future occurrences will stop being generated.`
            : 'Future occurrences will stop being generated.';
        })()}
        isPending={deleteRuleMutation.isPending}
        isError={deleteRuleMutation.isError}
        errorMessage="Could not delete that recurring todo. Please try again."
        onConfirm={() => pendingDeleteRuleId && deleteRuleMutation.mutate(pendingDeleteRuleId)}
      />
    </PageShell>
  );
};
