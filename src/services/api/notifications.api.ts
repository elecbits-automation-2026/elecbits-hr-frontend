import type { NotificationList } from '@app-types/api.types';
import { api } from '@utils/axiosInstance';

/**
 * The bell — `me` scope only. Every mark-read call answers with the new unread
 * total so the badge updates without a second request.
 */
export const notificationsApi = {
  list: async (limit = 20): Promise<NotificationList> =>
    (await api.get<NotificationList>('/notifications', { params: { limit } })).data,
  unreadCount: async (): Promise<number> =>
    (await api.get<{ unreadCount: number }>('/notifications/unread-count')).data.unreadCount,
  markRead: async (id: string): Promise<number> =>
    (await api.post<{ unreadCount: number }>(`/notifications/${id}/read`)).data.unreadCount,
  markAllRead: async (): Promise<number> =>
    (await api.post<{ unreadCount: number }>('/notifications/read-all')).data.unreadCount,
};
