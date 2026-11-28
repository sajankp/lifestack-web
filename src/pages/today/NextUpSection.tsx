import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Circle, CheckCircle2 } from 'lucide-react';
import { healthService } from '../../services/health';
import { todoService } from '../../services/todo';
import { queryKeys } from '../../lib/queryKeys';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { formatDateInputValue, formatDateTime } from '../../utils/dateFormat';
import type { DashboardTodoItem } from '../../types/dashboard';

// spec-113 §3.4. Up to three upcoming tasks and doses, soonest first, each with an inline tick-off
// that reuses the existing todo and health mutations. Overdue things are not here: they are the
// briefing's actionable lines, in "Needs you". Tasks come from the dashboard summary; today's doses
// come from the (light) dose schedule. If that fails, the tasks still show.

const MAX_ITEMS = 3;

type NextUpItem = {
  key: string;
  kind: 'task' | 'dose';
  title: string;
  detail: string | null;
  when: string | null;
  to: string;
  complete: () => void;
};

interface NextUpSectionProps {
  todos: DashboardTodoItem[];
}

const timeOf = (when: string | null): number => {
  if (!when) return Number.POSITIVE_INFINITY;
  const t = new Date(when).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

export const NextUpSection: React.FC<NextUpSectionProps> = ({ todos }) => {
  const today = formatDateInputValue(new Date());
  // Items ticked off here. The dashboard summary is cached for a short while on the server, so a
  // refetch can still return a task that was just completed; this keeps it from reappearing.
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const markDone = (key: string) => setDone((prev) => new Set(prev).add(key));

  const scheduleQuery = useQuery({
    queryKey: queryKeys.health.schedule(today),
    queryFn: () => healthService.getSchedule(today),
  });

  const completeTodo = useInvalidatingMutation(
    (args: { id: string; key: string }) => todoService.updateTodo(args.id, { completed: true }),
    [queryKeys.todo.list(), queryKeys.dashboard.all],
    {
      successMessage: false,
      errorMessage: 'Could not mark that task done. Please try again.',
      onSuccess: (_result, args) => markDone(args.key),
    },
  );

  const takeDose = useInvalidatingMutation(
    (args: { medicationPublicId: string; scheduledFor: string; key: string }) =>
      healthService.upsertMedicationEvent(args.medicationPublicId, {
        scheduled_for: args.scheduledFor,
        status: 'taken',
      }),
    [
      queryKeys.health.schedule(today),
      queryKeys.health.overdue(),
      queryKeys.health.medications(),
      queryKeys.dashboard.all,
    ],
    {
      successMessage: false,
      errorMessage: 'Could not log that dose. Please try again.',
      onSuccess: (_result, args) => markDone(args.key),
    },
  );

  const items = useMemo<NextUpItem[]>(() => {
    const taskItems: NextUpItem[] = todos
      .filter((t): t is DashboardTodoItem & { public_id: string } => !!t.public_id)
      .map((t) => ({
        key: `todo:${t.public_id}`,
        kind: 'task',
        title: t.title ?? 'Untitled task',
        detail: null,
        when: t.due_date ?? null,
        to: '/todo',
        complete: () => completeTodo.mutate({ id: t.public_id, key: `todo:${t.public_id}` }),
      }));
    const doseItems: NextUpItem[] = (scheduleQuery.data ?? [])
      .filter((slot) => slot.status === 'pending')
      .map((slot) => {
        const key = `dose:${slot.medication_public_id}:${slot.scheduled_for}`;
        return {
          key,
          kind: 'dose',
          title: slot.medication_name,
          detail: slot.dose_text,
          when: slot.scheduled_for,
          to: '/health',
          complete: () =>
            takeDose.mutate({
              medicationPublicId: slot.medication_public_id,
              scheduledFor: slot.scheduled_for,
              key,
            }),
        };
      });
    return [...taskItems, ...doseItems]
      .filter((item) => !done.has(item.key))
      .sort((a, b) => timeOf(a.when) - timeOf(b.when))
      .slice(0, MAX_ITEMS);
    // The mutation objects are stable enough for a click handler; they are intentionally not deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, scheduleQuery.data, done]);

  const isPending = (key: string) =>
    (completeTodo.isPending && completeTodo.variables?.key === key) ||
    (takeDose.isPending && takeDose.variables?.key === key);

  return (
    <section
      data-testid="today-next-up"
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-black/10 sm:p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Next up</h2>

      {items.length === 0 && !scheduleQuery.isLoading ? (
        <p data-testid="today-next-up-empty" className="mt-3 text-sm text-slate-400">
          Nothing coming up.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const when = formatDateTime(item.when, { utc: false, fallback: '' });
            return (
              <li
                key={item.key}
                data-testid="today-next-up-item"
                className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3"
              >
                <button
                  type="button"
                  aria-label={`Mark done: ${item.title}`}
                  disabled={isPending(item.key)}
                  onClick={item.complete}
                  className="group shrink-0 rounded-full text-slate-500 transition hover:text-emerald-400 disabled:opacity-50"
                >
                  <Circle className="h-6 w-6 group-hover:hidden" aria-hidden="true" />
                  <CheckCircle2 className="hidden h-6 w-6 group-hover:block" aria-hidden="true" />
                </button>
                <Link to={item.to} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">
                    {item.title}
                    {item.detail ? (
                      <span className="font-normal text-slate-400"> · {item.detail}</span>
                    ) : null}
                  </span>
                  {when ? <span className="block text-xs text-slate-400">{when}</span> : null}
                </Link>
                <span className="shrink-0 rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {item.kind === 'dose' ? 'Dose' : 'Task'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
