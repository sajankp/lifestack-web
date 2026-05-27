import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';

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
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Todos</h1>
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
              <input
                type="date"
                value={newTodoDueDate}
                onChange={(e) => setNewTodoDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-white"
                disabled={createMutation.isPending}
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending || !newTodoTitle.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Add Task
            </button>
          </form>

          {isLoading ? (
            <div className="text-center text-slate-400">Loading tasks...</div>
          ) : (
            <div className="space-y-3">
              {todosResponse?.items.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-6 text-center text-slate-400">
                  No tasks yet. Add one above.
                </div>
              ) : (
                <>
                  {todosResponse?.items.map((todo) => (
                    <div
                      key={todo.public_id}
                      className={`group flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all hover:border-slate-600 ${todo.completed ? 'opacity-60' : ''}`}
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
          <h2 className="mb-3 text-lg font-semibold text-white">Recurring rules</h2>
          <form onSubmit={handleCreateRule} className="mb-6 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
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
              <input
                type="date"
                value={ruleAnchorDate}
                onChange={(e) => setRuleAnchorDate(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-white"
                required
              />
              <input
                type="date"
                value={ruleEndDate}
                onChange={(e) => setRuleEndDate(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-white"
              />
            </div>
            <button
              type="submit"
              disabled={createRuleMutation.isPending || !ruleTitle.trim() || !ruleAnchorDate}
              className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Add recurring rule
            </button>
          </form>

          {isRecurringLoading ? (
            <div className="text-center text-slate-400">Loading recurring rules...</div>
          ) : (
            <div className="space-y-3">
              {(recurringResponse?.items ?? []).length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-6 text-center text-slate-400">
                  No recurring rules yet.
                </div>
              ) : (
                recurringResponse?.items.map((rule) => (
                  <div key={rule.public_id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
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
    </div>
  );
};
