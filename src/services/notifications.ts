import { z } from 'zod';
import api from './api';
import { paginatedSchema } from '../types/common';
import {
  NotificationItemSchema,
  NotificationPreferenceSchema,
  PushSubscriptionInfoSchema,
} from '../types/notifications';
import type {
  NotificationItem,
  NotificationPreference,
  PushSubscriptionInfo,
} from '../types/notifications';

const PaginatedNotificationsSchema = paginatedSchema(NotificationItemSchema);
const UnreadCountSchema = z.object({ count: z.number().default(0) });
const MarkAllReadSchema = z.object({ updated: z.number().default(0) });
const VapidPublicKeySchema = z.object({ key: z.string().default('') });

export const notificationsService = {
  list: async (
    limit = 20,
    offset = 0,
    params: { category?: string; is_read?: boolean } = {},
  ): Promise<z.infer<typeof PaginatedNotificationsSchema>> => {
    const res = await api.get('/notifications', { params: { limit, offset, ...params } });
    return PaginatedNotificationsSchema.parse(res.data);
  },
  unreadCount: async (): Promise<{ count: number }> => {
    const res = await api.get('/notifications/unread-count');
    return UnreadCountSchema.parse(res.data);
  },
  markRead: async (id: string): Promise<NotificationItem> => {
    const res = await api.patch(`/notifications/${id}/read`);
    return NotificationItemSchema.parse(res.data);
  },
  markAllRead: async (): Promise<{ updated: number }> => {
    const res = await api.post('/notifications/mark-all-read');
    return MarkAllReadSchema.parse(res.data);
  },
  getPreferences: async (): Promise<NotificationPreference[]> => {
    const res = await api.get('/notifications/preferences');
    return z.array(NotificationPreferenceSchema).parse(res.data);
  },
  updatePreference: async (
    category: string,
    data: Partial<Pick<NotificationPreference, 'channel_push' | 'channel_in_app' | 'is_muted'>>,
  ): Promise<NotificationPreference> => {
    const res = await api.patch(`/notifications/preferences/${category}`, data);
    return NotificationPreferenceSchema.parse(res.data);
  },
  getVapidPublicKey: async (): Promise<{ key: string }> => {
    const res = await api.get('/notifications/push/vapid-public-key');
    return VapidPublicKeySchema.parse(res.data);
  },
  subscribePush: async (payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    device_label?: string;
  }): Promise<PushSubscriptionInfo> => {
    const res = await api.post('/notifications/push-subscriptions', payload);
    return PushSubscriptionInfoSchema.parse(res.data);
  },
  listPushSubscriptions: async (): Promise<PushSubscriptionInfo[]> => {
    const res = await api.get('/notifications/push-subscriptions');
    return z.array(PushSubscriptionInfoSchema).parse(res.data);
  },
  deletePushSubscription: async (id: string): Promise<void> => {
    await api.delete(`/notifications/push-subscriptions/${id}`);
  },
};
