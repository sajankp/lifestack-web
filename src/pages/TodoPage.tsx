import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Edit2, Plus, Trash2, X } from 'lucide-react';

import { DropdownSelect } from '../components/DropdownSelect';
import { CompactFilterBar, CompactFilterField } from '../components/filters/CompactFilterBar';
import { DatePicker } from '../components/DatePicker';
import { TimePicker } from '../components/TimePicker';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Pagination } from '../components/Pagination';
import { SkeletonList } from '../components/ui/FeedbackStates';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { useInvalidatingMutation } from '../hooks/useInvalidatingMutation';
import { queryKeys } from '../lib/queryKeys';
import { todoService } from '../services/todo';
import type { MonthlyMode, RecurringTodoCreate, RecurringTodoRule, Todo, TodoCreate } from '../services/todo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { describeRecurrence } from '../utils/recurrenceLabel';

type TodoPriority = 'low' | 'medium' | 'high';
type TodoFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

const priorityOptions: Array<{ value: TodoPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const statusOptions = [
  { value: 'all', label: 'All tasks' },
  { value: 'open', label: 'Open tasks' },
  { value: 'completed', label: 'Completed tasks' },
] as const;

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

const priorityLabel = (priority: TodoPriority | undefined): string => {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    default:
      return 'Low';
  }
};

const priorityTone = (priority: TodoPriority | undefined): string => {
  switch (priority) {
    case 'high':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
    case 'medium':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    default:
      return 'border-slate-600/70 bg-slate-900/60 text-slate-200';
  }
};

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
  const [pendingDeleteTodoId, setPendingDeleteTodoId] = useState<string | null>(null);
  const [pendingDeleteRuleId, setPendingDeleteRuleId] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('all');

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
  const completedFilterValue =
    statusFilter === 'all' ? undefined : statusFilter === 'completed';

  const { data: todosResponse, isLoading } = useQuery({
    queryKey: queryKeys.todo.list(offset, statusFilter),
    queryFn: () => todoService.getTodos(completedFilterValue, limit, offset),
  });

  const { data: recurringResponse, isLoading: isRecurringLoading } = useQuery({
    queryKey: queryKeys.todo.recurring(),
    queryFn: () => todoService.getRecurringRules(true, 100, 0),
  });

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
      onSuccess: () => setPendingDeleteTodoId(null),
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
      updateMutation.mutate({ id: editingTodo.public_id, data: payload });
      return;
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

      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={closeTaskModal}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-semibold text-white">{editingTodo ? 'Edit task' : 'New task'}</h2>
              <button
                type="button"
                onClick={closeTaskModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-300">What needs to be done?</label>
                <input
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
                <label className="text-sm font-semibold text-slate-300">Description (optional)</label>
                <textarea
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
                  <label className="text-sm font-semibold text-slate-300">Priority</label>
                  <DropdownSelect
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
          </div>
        </div>
      )}

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
          <CompactFilterBar
            className="mb-6"
            title="Task filters"
            onReset={() => {
              setStatusFilter('all');
              setOffset(0);
            }}
          >
            <CompactFilterField label="Status" className="max-w-[260px]">
              <DropdownSelect
                testId="todo-status-filter"
                value={statusFilter}
                options={[...statusOptions]}
                onChange={(value) => {
                  setStatusFilter(value as 'all' | 'open' | 'completed');
                  setOffset(0);
                }}
                placeholder="Status"
              />
            </CompactFilterField>
          </CompactFilterBar>

          {isLoading ? (
            <SkeletonList rows={4} />
          ) : (
            <div className="space-y-3">
              {todosResponse?.items.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-8 text-center">
                  <p className="text-slate-300">No tasks yet.</p>
                  <p className="mt-1 text-sm text-slate-500">Create your first task above to get started.</p>
                </div>
              ) : (
                <>
                  {todosResponse?.items.map((todo) => (
                    <div
                      key={todo.public_id}
                      data-testid={`todo-item-${todo.public_id}`}
                      className={`group flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/45 px-4 py-3 transition-all hover:border-slate-600 ${todo.completed ? 'opacity-60' : ''}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          data-testid={`todo-toggle-${todo.public_id}`}
                          aria-label={todo.completed ? `Mark todo as incomplete: ${todo.title}` : `Mark todo as complete: ${todo.title}`}
                          onClick={() => toggleMutation.mutate(todo)}
                          disabled={toggleMutation.isPending}
                          className="shrink-0 text-slate-400 transition-colors hover:text-cyan-500 disabled:opacity-50"
                        >
                          {todo.completed ? <CheckCircle2 className="h-5 w-5 text-cyan-400" /> : <Circle className="h-5 w-5" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className={`truncate text-sm font-semibold text-white ${todo.completed ? 'line-through text-slate-400' : ''}`}>
                              {todo.title}
                            </h3>
                            <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${priorityTone(todo.priority)}`}>
                              {priorityLabel(todo.priority)}
                            </span>
                            {formatDueDateTime(todo.due_date) ? (
                              (() => {
                                const isOverdue = !todo.completed && todo.due_date && new Date(todo.due_date).getTime() < Date.now();
                                return (
                                  <span className={`text-xs ${isOverdue ? 'text-rose-400 font-semibold flex items-center gap-1 bg-rose-950/40 border border-rose-900/50 rounded px-1.5 py-0.5' : 'text-slate-400'}`}>
                                    {isOverdue && <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />}
                                    {isOverdue ? 'Overdue: ' : 'Due: '}{formatDueDateTime(todo.due_date)}
                                  </span>
                                );
                              })()
                            ) : null}
                          </div>
                          {todo.description ? (
                            <p className="mt-0.5 truncate text-sm text-slate-300">{todo.description}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="ml-3 flex shrink-0 items-center gap-1 opacity-0 transition-all group-hover:opacity-100">
                        <button
                          type="button"
                          data-testid={`todo-edit-${todo.public_id}`}
                          onClick={() => openEditTaskModal(todo)}
                          className="rounded p-2 text-slate-500 hover:bg-slate-700/60 hover:text-slate-100"
                          title="Edit task"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          data-testid={`todo-delete-${todo.public_id}`}
                          disabled={deleteMutation.isPending}
                          onClick={() => setPendingDeleteTodoId(todo.public_id)}
                          className="rounded p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                          title="Delete task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {todosResponse && (
                    <Pagination
                      total={todosResponse.total}
                      limit={todosResponse.limit}
                      offset={todosResponse.offset}
                      onPageChange={setOffset}
                    />
                  )}
                </>
              )}
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

      {isRecurringModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={closeRecurringModal}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-lg font-semibold text-white">
                {editingRecurringRule ? 'Edit recurring todo' : 'Create recurring todo'}
              </h3>
              <button
                type="button"
                onClick={closeRecurringModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveRule} className="space-y-4 p-5">
              <input
                data-testid="todo-recurring-title"
                type="text"
                value={ruleTitle}
                onChange={(e) => setRuleTitle(e.target.value)}
                placeholder="Title (e.g. Weekly grocery planning)"
                className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                required
              />
              <input
                data-testid="todo-recurring-description"
                type="text"
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <DropdownSelect
                testId="todo-recurring-priority"
                value={rulePriority}
                onChange={(value) => setRulePriority(value as TodoPriority)}
                options={priorityOptions}
                placeholder="Priority"
              />
              <div className="grid grid-cols-2 gap-3">
                <DropdownSelect
                  testId="todo-recurring-frequency"
                  value={ruleFrequency}
                  onChange={(value) => setRuleFrequency(value as TodoFrequency)}
                  options={frequencyOptions}
                  placeholder="Frequency"
                />
                <input
                  data-testid="todo-recurring-interval"
                  type="number"
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
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!pendingDeleteTodoId}
        onOpenChange={(open) => !open && setPendingDeleteTodoId(null)}
        title="Delete task?"
        description={(() => {
          const todo = todosResponse?.items.find((t) => t.public_id === pendingDeleteTodoId);
          return todo ? `Delete "${todo.title}"? This cannot be undone.` : 'This cannot be undone.';
        })()}
        isPending={deleteMutation.isPending}
        isError={deleteMutation.isError}
        errorMessage="Could not delete that task. Please try again."
        onConfirm={() => pendingDeleteTodoId && deleteMutation.mutate(pendingDeleteTodoId)}
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
