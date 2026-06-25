// CHOS-406: notification inbox HTTP calls. Thin wrappers over the shared
// authenticated apiClient; the backend scopes every call to the current user.

import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type { NotificationList, UnreadCount } from '../types';

export interface ListParams {
  skip?: number;
  limit?: number;
  unread_only?: boolean;
}

export async function fetchNotifications(params: ListParams = {}): Promise<NotificationList> {
  const { data } = await apiClient.get<NotificationList>(API.notifications.base, {
    params,
  });
  return data;
}

export async function fetchUnreadCount(): Promise<UnreadCount> {
  const { data } = await apiClient.get<UnreadCount>(API.notifications.unreadCount);
  return data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiClient.post(API.notifications.read(id));
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post(API.notifications.readAll);
}
