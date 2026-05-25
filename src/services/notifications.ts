import api from './api';
import type { PaginatedResponse } from '../types/common';
import type { NotificationItem, NotificationPreference } from '../types/notifications';

export const notificationsService = {
  list: async (limit = 20, offset = 0): Promise<PaginatedResponse<NotificationItem>> => {
    const res = await api.get('/notifications', { params: { limit, offset } });
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
};
