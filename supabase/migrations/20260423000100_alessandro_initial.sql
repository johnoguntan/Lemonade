create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  reminder integer,
  snoozed_until timestamptz,
  parent_task_id uuid references public.tasks(id) on delete set null,
  order_index integer not null default 0,
  when_added timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  end_of_day boolean not null default false,
  is_heading boolean not null default false,
  recurring_days integer[],
  recurring_interval integer,
  recurring_custom_text text,
  subtasks jsonb not null default '[]'::jsonb
);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  tab text not null default 'planning',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  type text not null default 'list'
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  content text not null,
  completed boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  notes text,
  updated_at timestamptz not null default now()
);

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

create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists labels_user_id_idx on public.labels(user_id);
create index if not exists lists_user_id_idx on public.lists(user_id);
create index if not exists shopping_returns_user_id_idx on public.shopping_returns(user_id);
create index if not exists list_items_list_id_idx on public.list_items(list_id);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at before update on public.lists
for each row execute function public.set_updated_at();

drop trigger if exists list_items_set_updated_at on public.list_items;
create trigger list_items_set_updated_at before update on public.list_items
for each row execute function public.set_updated_at();

drop trigger if exists shopping_returns_set_updated_at on public.shopping_returns;
create trigger shopping_returns_set_updated_at before update on public.shopping_returns
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.shopping_returns enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users for select using (auth.uid() = id);
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users for update using (auth.uid() = id);

drop policy if exists "tasks_own_all" on public.tasks;
create policy "tasks_own_all" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "labels_own_all" on public.labels;
create policy "labels_own_all" on public.labels for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "task_labels_own_all" on public.task_labels;
create policy "task_labels_own_all" on public.task_labels
for all
using (
  exists (
    select 1 from public.tasks
    where public.tasks.id = task_labels.task_id
      and public.tasks.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.tasks
    where public.tasks.id = task_labels.task_id
      and public.tasks.user_id = auth.uid()
  )
);

drop policy if exists "lists_own_all" on public.lists;
create policy "lists_own_all" on public.lists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "list_items_own_all" on public.list_items;
create policy "list_items_own_all" on public.list_items
for all
using (
  exists (
    select 1 from public.lists
    where public.lists.id = list_items.list_id
      and public.lists.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.lists
    where public.lists.id = list_items.list_id
      and public.lists.user_id = auth.uid()
  )
);

drop policy if exists "shopping_returns_own_all" on public.shopping_returns;
create policy "shopping_returns_own_all" on public.shopping_returns
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
