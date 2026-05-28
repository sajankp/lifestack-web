import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Plus, Trash2, X } from 'lucide-react';

import { DatePicker } from '../components/DatePicker';
import { Pagination } from '../components/Pagination';
import { todoService } from '../services/todo';
import type { RecurringTodoCreate, Todo, TodoCreate } from '../services/todo';

const toIsoStartOfDay = (yyyyMmDd: string): string | null => {
  if (!yyyyMmDd) return null;
  return `${yyyyMmDd}T00:00:00Z`;
};

const formatUtcDate = (value: string | null | undefined): string | null => {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' });
};

export const TodoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleAnchorDate, setRuleAnchorDate] = useState('');
  const [ruleEndDate, setRuleEndDate] = useState('');
  const [ruleFrequency, setRuleFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [ruleInterval, setRuleInterval] = useState(1);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);

  const { data: todosResponse, isLoading } = useQuery({
    queryKey: ['todos', offset],
    queryFn: () => todoService.getTodos(undefined, limit, offset),
  });

  const { data: recurringResponse, isLoading: isRecurringLoading } = useQuery({
    queryKey: ['todo-recurring'],
    queryFn: () => todoService.getRecurringRules(true, 100, 0),
  });

  const createMutation = useMutation({
    mutationFn: (newTodo: TodoCreate) => todoService.createTodo(newTodo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setNewTodoTitle('');
      setNewTodoDueDate('');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (todo: Todo) => todoService.updateTodo(todo.public_id, { completed: !todo.completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => todoService.deleteTodo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: (payload: RecurringTodoCreate) => todoService.createRecurringRule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo-recurring'] });
      setRuleTitle('');
      setRuleDescription('');
      setRuleAnchorDate('');
      setRuleEndDate('');
      setRuleFrequency('weekly');
      setRuleInterval(1);
      setIsRecurringModalOpen(false);
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => todoService.deleteRecurringRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo-recurring'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    createMutation.mutate({
      title: newTodoTitle.trim(),
      due_date: toIsoStartOfDay(newTodoDueDate),
    });
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || !ruleAnchorDate) return;
    createRuleMutation.mutate({
      title: ruleTitle.trim(),
      description: ruleDescription || undefined,
      frequency: ruleFrequency,
      interval: Math.max(1, ruleInterval),
      anchor_date: ruleAnchorDate,
      end_date: ruleEndDate || null,
    });
  };

  return (
    <div className="w-full px-8 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Todos</h1>
        <p className="mt-2 text-slate-400">Manage your tasks and recurring task rules for this workspace.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">New task</h2>
          <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
            <input
              type="text"
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-white placeholder-slate-400"
              disabled={createMutation.isPending}
            />
            <div>
              <label className="mb-1 block text-sm text-slate-300">Due date (optional)</label>
              <DatePicker
                value={newTodoDueDate}
                onChange={setNewTodoDueDate}
                placeholder="Select due date"
                disabled={createMutation.isPending}
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending || !newTodoTitle.trim()}
              className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Add Task
            </button>
          </form>

          {isLoading ? (
            <div className="text-center text-slate-400">Loading tasks...</div>
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
                      className={`group flex items-center justify-between rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 transition-all hover:border-slate-600 ${todo.completed ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleMutation.mutate(todo)}
                          className="text-slate-400 hover:text-blue-500 transition-colors"
                        >
                          {todo.completed ? <CheckCircle2 className="h-6 w-6 text-blue-500" /> : <Circle className="h-6 w-6" />}
                        </button>
                        <div>
                          <h3 className={`font-medium text-white ${todo.completed ? 'line-through text-slate-400' : ''}`}>
                            {todo.title}
                          </h3>
                          {formatUtcDate(todo.due_date) ? (
                            <p className="text-xs text-slate-400">
                              Due: {formatUtcDate(todo.due_date)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <button
                        onClick={() => deleteMutation.mutate(todo.public_id)}
                        className="rounded p-2 text-slate-500 opacity-0 hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
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
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recurring rules</h2>
            <button
              type="button"
              onClick={() => setIsRecurringModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" />
              New rule
            </button>
          </div>

          {isRecurringLoading ? (
            <div className="text-center text-slate-400">Loading recurring rules...</div>
          ) : (
            <div className="space-y-3">
              {(recurringResponse?.items ?? []).length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-8 text-center">
                  <p className="text-slate-300">No recurring rules yet.</p>
                  <p className="mt-1 text-sm text-slate-500">Create one to auto-generate routine tasks.</p>
                  <button
                    type="button"
                    onClick={() => setIsRecurringModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    <Plus className="h-4 w-4" />
                    Create first rule
                  </button>
                </div>
              ) : (
                recurringResponse?.items.map((rule) => (
                  <div key={rule.public_id} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{rule.title}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Every {rule.interval} {rule.frequency} | Next:{' '}
                          {formatUtcDate(rule.next_due_date) ?? 'N/A'}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteRuleMutation.mutate(rule.public_id)}
                        className="rounded p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {isRecurringModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsRecurringModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-lg font-semibold text-white">Create recurring rule</h3>
              <button
                type="button"
                onClick={() => setIsRecurringModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRule} className="space-y-4 p-5">
              <input
                type="text"
                value={ruleTitle}
                onChange={(e) => setRuleTitle(e.target.value)}
                placeholder="Rule title (e.g. Weekly grocery planning)"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-white placeholder-slate-400"
                required
              />
              <input
                type="text"
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-white placeholder-slate-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={ruleFrequency}
                  onChange={(e) => setRuleFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                  className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={ruleInterval}
                  onChange={(e) => setRuleInterval(Number(e.target.value) || 1)}
                  className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  value={ruleAnchorDate}
                  onChange={setRuleAnchorDate}
                  placeholder="Start date"
                  required
                />
                <DatePicker
                  value={ruleEndDate}
                  onChange={setRuleEndDate}
                  placeholder="End date (optional)"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsRecurringModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRuleMutation.isPending || !ruleTitle.trim() || !ruleAnchorDate}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {createRuleMutation.isPending ? 'Creating...' : 'Create rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
