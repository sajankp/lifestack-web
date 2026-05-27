export interface NotificationItem {
  public_id: string;
  category: string;
  severity: string;
  title: string;
  body: string | null;
  module: string;
  entity_type: string | null;
  entity_public_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  category: string;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_push: boolean;
  is_muted: boolean;
}
