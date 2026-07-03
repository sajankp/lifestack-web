import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { PushSubscriptionSettings } from '../components/PushSubscriptionSettings';
import { notificationsService } from '../services/notifications';
import type { NotificationItem } from '../types/notifications';
import { Pagination } from '../components/Pagination';
import { SkeletonList, EmptyState, ErrorBanner } from '../components/ui/FeedbackStates';

const NotificationRow: React.FC<{ n: NotificationItem }> = ({ n }) => {
  const queryClient = useQueryClient();
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <article className={`rounded-xl border p-4 ${n.is_read ? 'border-slate-800 bg-slate-900/40' : 'border-cyan-800 bg-cyan-950/40'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{n.category} · {n.severity}</p>
          <h3 className="font-semibold text-white">{n.title}</h3>
          {n.body ? <p className="mt-1 text-sm text-slate-300">{n.body}</p> : null}
          <p className="mt-2 text-xs text-slate-500">
            {!Number.isNaN(new Date(n.created_at).getTime())
              ? new Date(n.created_at).toLocaleString(undefined, { timeZone: 'UTC' })
              : 'N/A'}
          </p>
        </div>
        {!n.is_read ? (
          <button
            onClick={() => markReadMutation.mutate(n.public_id)}
            disabled={markReadMutation.isPending}
            className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            Mark read
          </button>
        ) : null}
      </div>
    </article>
  );
};

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', offset],
    queryFn: () => notificationsService.list(limit, offset),
  });

  const { data: preferences } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => notificationsService.getPreferences(),
  });

  const togglePushMutation = useMutation({
    mutationFn: ({ category, channel_push }: { category: string; channel_push: boolean }) =>
      notificationsService.updatePreference(category, { channel_push }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
    },
  });

  // A category with no preference row yet defaults to channel_in_app=true,
  // channel_push=false (the model defaults) — todo_reminder is spec-052's
  // new source, so always show it even before the user has touched it.
  const displayedPreferences = (() => {
    const known = preferences ?? [];
    if (known.some((p) => p.category === 'todo_reminder')) {
      return known;
    }
    return [
      ...known,
      { category: 'todo_reminder', channel_in_app: true, channel_email: false, channel_push: false, is_muted: false },
    ];
  })();

  const markAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <PageShell>
      <PageHero
        title="Notifications"
        subtitle="In-app alerts and delivery preferences."
        actions={(
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      />

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">Preferences</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {displayedPreferences.map((pref) => (
              <div key={pref.category} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
                <p className="font-semibold text-white">{pref.category}</p>
                <p className="text-slate-400">In-app: {pref.channel_in_app ? 'On' : 'Off'} | Muted: {pref.is_muted ? 'Yes' : 'No'}</p>
                <label className="mt-2 flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={pref.channel_push}
                    disabled={togglePushMutation.isPending}
                    onChange={(e) =>
                      togglePushMutation.mutate({ category: pref.category, channel_push: e.target.checked })
                    }
                  />
                  Push notifications
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">Devices</h2>
          <PushSubscriptionSettings />
        </div>
      </section>

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : isError ? (
        <ErrorBanner
          message="Failed to load notifications. Please try again."
          onRetry={() => void refetch()}
        />
      ) : data?.items?.length ? (
        <>
          <div className="space-y-3">
            {data.items.map((n) => (
              <NotificationRow key={n.public_id} n={n} />
            ))}
          </div>
          <div className="mt-4">
            <Pagination total={data.total} limit={data.limit} offset={data.offset} onPageChange={setOffset} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="No notifications yet"
          description="Notifications appear here when budget guardrails fire, recurring tasks trigger, or important events occur in your workspace."
        />
      )}
    </PageShell>
  );
};
