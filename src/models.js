import { z } from 'zod'

export const IntentSchema = z.object({
  intent: z.enum([
    'set_reminder',
    'list_reminders',
    'cancel_reminder',
    'general_chat',
    'unknown'
  ]),
  reminder_text: z.string().nullable(),
  trigger_datetime_iso: z.string().nullable(),
  recurrence: z.enum(['none', 'daily', 'weekly']).nullable(),
  reply_to_user: z.string()
})

export const UserSchema = z.object({
  phone: z.string(),
  name: z.string().nullable(),
  timezone: z.string(),
  created_at: z.string()
})

export const ReminderSchema = z.object({
  id: z.string(),
  user_phone: z.string(),
  text: z.string(),
  trigger_time: z.string(),
  cron_expr: z.string().nullable(),
  recurrence: z.string(),
  status: z.string()
})

export const MessageSchema = z.object({
  id: z.number(),
  user_phone: z.string(),
  role: z.string(),
  content: z.string(),
  timestamp: z.string()
})
