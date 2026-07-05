import { z } from 'zod';

export const NotificationItemSchema = z.object({
  public_id: z.string().default(''),
  category: z.string().default(''),
  severity: z.string().default('info'),
  title: z.string().default(''),
  body: z.string().nullable().default(null),
  module: z.string().default(''),
  entity_type: z.string().nullable().default(null),
  entity_public_id: z.string().nullable().default(null),
  is_read: z.boolean().default(false),
  read_at: z.string().nullable().default(null),
  created_at: z.string().default(''),
});
export type NotificationItem = z.infer<typeof NotificationItemSchema>;

export const NotificationPreferenceSchema = z.object({
  category: z.string().default(''),
  channel_in_app: z.boolean().default(true),
  channel_email: z.boolean().default(false),
  channel_push: z.boolean().default(false),
  is_muted: z.boolean().default(false),
});
export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;

export const PushSubscriptionInfoSchema = z.object({
  public_id: z.string().default(''),
  endpoint_hint: z.string().default(''),
  device_label: z.string().nullable().default(null),
  is_active: z.boolean().default(true),
  last_success_at: z.string().nullable().default(null),
  last_failure_at: z.string().nullable().default(null),
  created_at: z.string().default(''),
});
export type PushSubscriptionInfo = z.infer<typeof PushSubscriptionInfoSchema>;
