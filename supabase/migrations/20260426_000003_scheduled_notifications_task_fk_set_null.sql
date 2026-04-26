alter table public.scheduled_notifications
drop constraint if exists scheduled_notifications_task_id_fkey;

alter table public.scheduled_notifications
add constraint scheduled_notifications_task_id_fkey
foreign key (task_id) references public.tasks(id)
on delete set null;
