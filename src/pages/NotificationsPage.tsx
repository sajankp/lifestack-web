import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '../services/notifications';
import { Pagination } from '../components/Pagination';

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications', offset],
    queryFn: () => notificationsService.list(limit, offset),
  });

  const { data: preferences } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => notificationsService.getPreferences(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <div className="w-full px-8 py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Notifications</h1>
          <p className="mt-1 text-slate-400">In-app alerts and delivery preferences.</p>
        </div>
        <button
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Mark all read
        </button>
      </header>

      <section className="mb-6 rounded-xl border border-slate-800 bg-slate-800/30 p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">Preferences</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(preferences ?? []).map((pref) => (
            <div key={pref.category} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
              <p className="font-semibold text-white">{pref.category}</p>
              <p className="text-slate-400">In-app: {pref.channel_in_app ? 'On' : 'Off'} | Muted: {pref.is_muted ? 'Yes' : 'No'}</p>
            </div>
          ))}
          {!preferences?.length ? <p className="text-slate-400">No preferences configured yet.</p> : null}
        </div>
      </section>

      {isLoading ? (
        <div className="text-slate-400">Loading notifications...</div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-800 bg-rose-950/30 p-6 text-rose-300">
          Failed to load notifications. Please try again.
        </div>
      ) : data?.items?.length ? (
        <>
          <div className="space-y-3">
            {data.items.map((n) => (
              <article key={n.public_id} className={`rounded-xl border p-4 ${n.is_read ? 'border-slate-800 bg-slate-900/40' : 'border-blue-700/50 bg-blue-900/10'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">{n.category} · {n.severity}</p>
                    <h3 className="font-semibold text-white">{n.title}</h3>
                    {n.body ? <p className="mt-1 text-sm text-slate-300">{n.body}</p> : null}
                    <p className="mt-2 text-xs text-slate-500">
                      {!Number.isNaN(new Date(n.created_at).getTime())
                        ? new Date(n.created_at).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                  {!n.is_read ? (
                    <button
                      onClick={() => markReadMutation.mutate(n.public_id)}
                      disabled={
                        markReadMutation.isPending &&
                        markReadMutation.variables === n.public_id
                      }
                      className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4">
            <Pagination total={data.total} limit={data.limit} offset={data.offset} onPageChange={setOffset} />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-6 text-slate-400">No notifications yet.</div>
      )}
    </div>
  );
};
