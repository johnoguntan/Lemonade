-- Add retry_count to scheduled_notifications
alter table public.scheduled_notifications
add column if not exists retry_count int not null default 0;
