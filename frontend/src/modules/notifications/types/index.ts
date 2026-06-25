// CHOS-406: in-app notification inbox types (mirror the backend schema).

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  items: NotificationItem[];
  total: number;
  unread: number;
}

export interface UnreadCount {
  unread: number;
}
