export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  overdue_action: 'dismiss' | 'rollover'
  created_at: string
  updated_at: string
}

export type CollectionType = 'date-based' | 'tag-based'
export type DateRangeType = 'dynamic' | 'fixed'
export type DynamicRange = 'next_3_days' | 'next_5_days' | 'next_week' | 'next_month' | 'next_year'

export interface Collection {
  id: string
  user_id: string
  name: string
  type: CollectionType
  color: string | null
  date_range_type: DateRangeType | null
  dynamic_range: DynamicRange | null
  fixed_start_date: string | null
  fixed_end_date: string | null
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type CollectionInsert = Omit<Collection, 'id' | 'created_at' | 'updated_at'>
export type CollectionUpdate = Partial<CollectionInsert>

export interface Preset {
  id: string
  user_id: string
  name: string
  is_default: boolean
  sort_order: number
  created_at: string
}

export interface PresetWithCollections extends Preset {
  collections: Collection[]
}

export type PresetInsert = Omit<Preset, 'id' | 'created_at'>

export interface Habit {
  id: string
  user_id: string
  name: string
  repeat_duration_days: number
  start_date: string
  end_date: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface HabitWithLog extends Habit {
  completed_today: boolean
  log_id: string | null
}

export type HabitInsert = Omit<Habit, 'id' | 'created_at' | 'updated_at'>
export type HabitUpdate = Partial<HabitInsert>

export interface HabitLog {
  id: string
  habit_id: string
  user_id: string
  date: string
  completed: boolean
  created_at: string
}

export type HabitLogInsert = Omit<HabitLog, 'id' | 'created_at'>

export interface JournalEntry {
  id: string
  user_id: string
  content: string
  date: string
  created_at: string
  updated_at: string
}

export type JournalEntryInsert = Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>

export interface NotificationSettings {
  id: string
  user_id: string
  email_notifications: boolean
  push_notifications: boolean
  reminders: boolean
  reminder_minutes_before: number
  daily_summary: boolean
  daily_summary_time: string | null
  created_at: string
  updated_at: string
}

export type NotificationSettingsUpdate = Partial<
  Omit<NotificationSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>
>

export interface AllsenadroUIPreferences {
  theme: 'light' | 'dark'
  accentColor: string
  activePresetId: string | null
}

export type DailySection = 'overdue' | 'urgent' | 'schedule' | 'allday'

export const DAILY_SECTIONS: { key: DailySection; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'allday', label: 'All Day' },
]
