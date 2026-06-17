-- Alessandro / Lemonade — Supabase schema + RLS
-- Generated: 2026-04-23

-- Extensions
create extension if not exists "pgcrypto";

-- Timestamp helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- USERS (profile) table
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, null)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- TASKS
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  date date,
  time time,
  priority text not null default 'normal',
  completed boolean not null default false,
  completed_at timestamptz,
  notes text,
  location text,
  duration integer,
  url text,
  photo_url text,
  color text,
  icon text,
  recurring text,
  recurring_day text,
  recurring_days integer[],
  recurring_interval integer,
  recurring_custom_text text,
  reminder integer,
  snoozed_until timestamptz,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  order_index integer not null default 0,
  end_of_day boolean not null default false,
  is_heading boolean not null default false,
  subtasks jsonb not null default '[]'::jsonb,
  when_added timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scheduled_notification_id uuid
);

create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_date_idx on public.tasks(user_id, date);
create index if not exists tasks_parent_idx on public.tasks(user_id, parent_task_id);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- LABELS
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

create index if not exists labels_user_id_idx on public.labels(user_id);

-- TASK_LABELS (join table)
create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- LISTS
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  tab text not null default 'planning',
  type text not null default 'list',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lists_user_id_idx on public.lists(user_id);

drop trigger if exists set_lists_updated_at on public.lists;
create trigger set_lists_updated_at
before update on public.lists
for each row execute function public.set_updated_at();

-- LIST_ITEMS
create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  content text not null,
  completed boolean not null default false,
  order_index integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists list_items_list_id_idx on public.list_items(list_id);

drop trigger if exists set_list_items_updated_at on public.list_items;
create trigger set_list_items_updated_at
before update on public.list_items
for each row execute function public.set_updated_at();

-- SHOPPING_RETURNS
create table if not exists public.shopping_returns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  item text not null,
  store text,
  deadline date,
  notes text,
  returned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_returns_user_id_idx on public.shopping_returns(user_id);

drop trigger if exists set_shopping_returns_updated_at on public.shopping_returns;
create trigger set_shopping_returns_updated_at
before update on public.shopping_returns
for each row execute function public.set_updated_at();

-- NOTIFICATION SETTINGS
create table if not exists public.notification_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  enabled boolean not null default true,
  permission text not null default 'default',
  quiet_hours_start text,
  quiet_hours_end text,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
create policy "notification_settings_own" on public.notification_settings for all using (auth.uid() = user_id);

-- PUSH SUBSCRIPTIONS
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions_own" on public.push_subscriptions for all using (auth.uid() = user_id);

-- SCHEDULED NOTIFICATIONS
create table if not exists public.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled',
  loop_rule text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_notifications_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade
);

create index if not exists scheduled_notifications_user_scheduled_idx on public.scheduled_notifications(user_id, scheduled_for);
alter table public.scheduled_notifications enable row level security;
create policy "scheduled_notifications_own" on public.scheduled_notifications for all using (auth.uid() = user_id);

-- RLS
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.shopping_returns enable row level security;

-- USERS policies
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users for select
using (id = auth.uid());

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users for update
using (id = auth.uid())
with check (id = auth.uid());

-- TASKS policies
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks for select
using (user_id = auth.uid());

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks for insert
with check (user_id = auth.uid());

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks for delete
using (user_id = auth.uid());

-- LABELS policies
drop policy if exists "labels_select_own" on public.labels;
create policy "labels_select_own"
on public.labels for select
using (user_id = auth.uid());

drop policy if exists "labels_insert_own" on public.labels;
create policy "labels_insert_own"
on public.labels for insert
with check (user_id = auth.uid());

drop policy if exists "labels_update_own" on public.labels;
create policy "labels_update_own"
on public.labels for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "labels_delete_own" on public.labels;
create policy "labels_delete_own"
on public.labels for delete
using (user_id = auth.uid());

-- TASK_LABELS policies (must belong to the user via either side)
drop policy if exists "task_labels_select_own" on public.task_labels;
create policy "task_labels_select_own"
on public.task_labels for select
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_labels.task_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "task_labels_insert_own" on public.task_labels;
create policy "task_labels_insert_own"
on public.task_labels for insert
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_labels.task_id
      and t.user_id = auth.uid()
  )
  and exists (
    select 1 from public.labels l
    where l.id = task_labels.label_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "task_labels_delete_own" on public.task_labels;
create policy "task_labels_delete_own"
on public.task_labels for delete
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_labels.task_id
      and t.user_id = auth.uid()
  )
);

-- LISTS policies
drop policy if exists "lists_select_own" on public.lists;
create policy "lists_select_own"
on public.lists for select
using (user_id = auth.uid());

drop policy if exists "lists_insert_own" on public.lists;
create policy "lists_insert_own"
on public.lists for insert
with check (user_id = auth.uid());

drop policy if exists "lists_update_own" on public.lists;
create policy "lists_update_own"
on public.lists for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "lists_delete_own" on public.lists;
create policy "lists_delete_own"
on public.lists for delete
using (user_id = auth.uid());

-- LIST_ITEMS policies (via parent list)
drop policy if exists "list_items_select_own" on public.list_items;
create policy "list_items_select_own"
on public.list_items for select
using (
  exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "list_items_insert_own" on public.list_items;
create policy "list_items_insert_own"
on public.list_items for insert
with check (
  exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "list_items_update_own" on public.list_items;
create policy "list_items_update_own"
on public.list_items for update
using (
  exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
      and l.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "list_items_delete_own" on public.list_items;
create policy "list_items_delete_own"
on public.list_items for delete
using (
  exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
      and l.user_id = auth.uid()
  )
);

-- SHOPPING_RETURNS policies
drop policy if exists "shopping_returns_select_own" on public.shopping_returns;
create policy "shopping_returns_select_own"
on public.shopping_returns for select
using (user_id = auth.uid());

drop policy if exists "shopping_returns_insert_own" on public.shopping_returns;
create policy "shopping_returns_insert_own"
on public.shopping_returns for insert
with check (user_id = auth.uid());

drop policy if exists "shopping_returns_update_own" on public.shopping_returns;
create policy "shopping_returns_update_own"
on public.shopping_returns for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "shopping_returns_delete_own" on public.shopping_returns;
create policy "shopping_returns_delete_own"
on public.shopping_returns for delete
using (user_id = auth.uid());
