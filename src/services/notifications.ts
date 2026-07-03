import api from './api';
import type { PaginatedResponse } from '../types/common';
import type {
  NotificationItem,
  NotificationPreference,
  PushSubscriptionInfo,
} from '../types/notifications';

export const notificationsService = {
  list: async (
    limit = 20,
    offset = 0,
    params: { category?: string; is_read?: boolean } = {},
  ): Promise<PaginatedResponse<NotificationItem>> => {
    const res = await api.get('/notifications', { params: { limit, offset, ...params } });
    return res.data;
  },
  unreadCount: async (): Promise<{ count: number }> => {
    const res = await api.get('/notifications/unread-count');
    return res.data;
  },
  markRead: async (id: string): Promise<NotificationItem> => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async (): Promise<{ updated: number }> => {
    const res = await api.post('/notifications/mark-all-read');
    return res.data;
  },
  getPreferences: async (): Promise<NotificationPreference[]> => {
    const res = await api.get('/notifications/preferences');
    return res.data;
  },
  updatePreference: async (
    category: string,
    data: Partial<Pick<NotificationPreference, 'channel_push' | 'channel_in_app' | 'is_muted'>>,
  ): Promise<NotificationPreference> => {
    const res = await api.patch(`/notifications/preferences/${category}`, data);
    return res.data;
  },
  getVapidPublicKey: async (): Promise<{ key: string }> => {
    const res = await api.get('/notifications/push/vapid-public-key');
    return res.data;
  },
  subscribePush: async (payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    device_label?: string;
  }): Promise<PushSubscriptionInfo> => {
    const res = await api.post('/notifications/push-subscriptions', payload);
    return res.data;
  },
  listPushSubscriptions: async (): Promise<PushSubscriptionInfo[]> => {
    const res = await api.get('/notifications/push-subscriptions');
    return res.data;
  },
  deletePushSubscription: async (id: string): Promise<void> => {
    await api.delete(`/notifications/push-subscriptions/${id}`);
  },
};
