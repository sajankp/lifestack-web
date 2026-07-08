import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { notificationsService } from '../services/notifications';
import { queryKeys } from '../lib/queryKeys';
import { friendlyDeviceLabel } from '../utils/deviceLabel';

// Web Push applicationServerKey must be a Uint8Array, not the base64url
// string the server hands back.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function detectPlatform() {
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isStandalone =
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const supportsPush = 'serviceWorker' in navigator && 'PushManager' in window;
  return { isIOS, isStandalone, supportsPush };
}

export const PushSubscriptionSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { isIOS, isStandalone, supportsPush } = useMemo(() => detectPlatform(), []);

  const { data: subscriptions } = useQuery({
    queryKey: queryKeys.notifications.pushSubscriptions(),
    queryFn: () => notificationsService.listPushSubscriptions(),
    enabled: supportsPush,
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted');
      }
      const { key } = await notificationsService.getVapidPublicKey();
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        throw new Error('Push notifications are not supported on this browser or in this context');
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = subscription.toJSON() as {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Browser did not return push subscription keys');
      }
      return notificationsService.subscribePush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        device_label: navigator.userAgent.slice(0, 100),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.pushSubscriptions() });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not enable push notifications');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => notificationsService.deletePushSubscription(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.pushSubscriptions() });
    },
  });

  if (isIOS && !isStandalone) {
    return (
      <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-200">
        Push notifications on iPhone/iPad require adding Lifestack to your Home Screen first
        (Share → Add to Home Screen), then opening it from there.
      </div>
    );
  }

  if (!supportsPush) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Push notifications</p>
          <p className="text-xs text-slate-400">
            Get reminders and alerts even when Lifestack isn't open.
          </p>
        </div>
        <button
          onClick={() => subscribeMutation.mutate()}
          disabled={subscribeMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-700 bg-cyan-900/40 px-3 py-1.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-900/70 disabled:opacity-50"
        >
          <Bell className="h-4 w-4" />
          {subscribeMutation.isPending ? 'Enabling…' : 'Enable on this device'}
        </button>
      </div>

      {error ? <p className="text-xs text-rose-400">{error}</p> : null}

      {subscriptions && subscriptions.length > 0 ? (
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <div
              key={sub.public_id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-sm"
            >
              <div className="flex items-center gap-2 text-slate-300">
                <Smartphone className="h-4 w-4 text-slate-500" />
                <span>{friendlyDeviceLabel(sub.device_label) || sub.endpoint_hint}</span>
                {!sub.is_active ? (
                  <span className="rounded bg-rose-950/50 px-1.5 py-0.5 text-xs text-rose-300">
                    inactive
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => revokeMutation.mutate(sub.public_id)}
                disabled={revokeMutation.isPending}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-300"
              >
                <BellOff className="h-3.5 w-3.5" />
                Revoke
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
