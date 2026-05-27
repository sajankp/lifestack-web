import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { captureService } from '../services/capture';

export const CapturePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [module, setModule] = useState<'todo' | 'spending' | ''>('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);

  const captureMutation = useMutation({
    mutationFn: () =>
      captureService.capture({
        text,
        module: module || null,
        hints: {
          amount: amount || null,
          category: category || null,
          due_date: dueDate || null,
        },
      }),
    onSuccess: (res) => {
      setLastResult(res as Record<string, unknown>);
      setText('');
      setAmount('');
      setCategory('');
      setDueDate('');
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">Quick Capture</h1>
        <p className="mt-1 text-slate-400">Single input for todo or spending capture.</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim() || captureMutation.isPending) return;
          captureMutation.mutate();
        }}
        className="rounded-xl border border-slate-800 bg-slate-800/30 p-5"
      >
        <label className="mb-2 block text-sm text-slate-300">Capture text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buy milk tomorrow or Spent $42 on groceries"
          className="mb-4 h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          required
        />

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Module hint</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value as 'todo' | 'spending' | '')}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            >
              <option value="">Auto route</option>
              <option value="todo">Todo</option>
              <option value="spending">Spending</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Amount hint (optional)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Category hint (optional)</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Due date hint (optional)</label>
            <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="today / tomorrow / YYYY-MM-DD" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          </div>
        </div>

        <button
          type="submit"
          disabled={captureMutation.isPending || !text.trim()}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {captureMutation.isPending ? 'Capturing...' : 'Capture'}
        </button>
      </form>

      {captureMutation.isError ? (
        <div className="mt-4 rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-rose-300">Capture failed. Check hints and try again.</div>
      ) : null}

      {lastResult ? (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Last capture result</h2>
          <pre className="mt-2 overflow-auto text-sm text-slate-200">{JSON.stringify(lastResult, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
};
