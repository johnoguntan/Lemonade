-- Push notifications + notification preferences

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

create table if not exists public.notification_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  permission text not null default 'default', -- default | granted | denied
  enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_notification_settings_updated_at on public.notification_settings;
create trigger set_notification_settings_updated_at
before update on public.notification_settings
for each row execute function public.set_updated_at();

create table if not exists public.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled', -- scheduled | sent | cancelled | failed
  loop_rule text, -- e.g. "every-5m", "every-15m", "every-30m", "every-60m", "every-morning"
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_notifications_user_time_idx on public.scheduled_notifications(user_id, scheduled_for);
create index if not exists scheduled_notifications_status_idx on public.scheduled_notifications(status);

drop trigger if exists set_scheduled_notifications_updated_at on public.scheduled_notifications;
create trigger set_scheduled_notifications_updated_at
before update on public.scheduled_notifications
for each row execute function public.set_updated_at();

-- Optional link from tasks -> current scheduled notification
alter table public.tasks
add column if not exists scheduled_notification_id uuid references public.scheduled_notifications(id) on delete set null;

-- RLS
alter table public.push_subscriptions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.scheduled_notifications enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
on public.push_subscriptions for select
using (user_id = auth.uid());

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
on public.push_subscriptions for insert
with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
on public.push_subscriptions for delete
using (user_id = auth.uid());

drop policy if exists "notification_settings_select_own" on public.notification_settings;
create policy "notification_settings_select_own"
on public.notification_settings for select
using (user_id = auth.uid());

drop policy if exists "notification_settings_upsert_own" on public.notification_settings;
create policy "notification_settings_upsert_own"
on public.notification_settings for insert
with check (user_id = auth.uid());

drop policy if exists "notification_settings_update_own" on public.notification_settings;
create policy "notification_settings_update_own"
on public.notification_settings for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "scheduled_notifications_select_own" on public.scheduled_notifications;
create policy "scheduled_notifications_select_own"
on public.scheduled_notifications for select
using (user_id = auth.uid());

drop policy if exists "scheduled_notifications_insert_own" on public.scheduled_notifications;
create policy "scheduled_notifications_insert_own"
on public.scheduled_notifications for insert
with check (user_id = auth.uid());

drop policy if exists "scheduled_notifications_update_own" on public.scheduled_notifications;
create policy "scheduled_notifications_update_own"
on public.scheduled_notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "scheduled_notifications_delete_own" on public.scheduled_notifications;
create policy "scheduled_notifications_delete_own"
on public.scheduled_notifications for delete
using (user_id = auth.uid());

