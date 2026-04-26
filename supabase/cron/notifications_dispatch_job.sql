-- Supabase Cron (pg_cron + pg_net) to call Alessandro dispatch endpoint every minute.
--
-- 1) Enable extensions (run once)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Schedule the job (replace URL + secret)
-- NOTE: set NOTIFICATIONS_CRON_SECRET in your app env and reuse the same value below.
select
  cron.schedule(
    'alessandro-dispatch-notifications',
    '* * * * *',
    $$
    select net.http_post(
      url:='https://YOUR_APP_DOMAIN/api/notifications/dispatch',
      headers:='{"Content-Type":"application/json","x-cron-secret":"YOUR_SECRET"}'::jsonb
    ) as request_id;
    $$
  );

