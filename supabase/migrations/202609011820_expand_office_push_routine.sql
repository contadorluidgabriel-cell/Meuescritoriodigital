alter table public.office_push_preferences
  add column if not exists midday_enabled boolean not null default false,
  add column if not exists midday_time time without time zone not null default '14:00:00',
  add column if not exists weekly_closing_enabled boolean not null default true,
  add column if not exists weekly_closing_weekday smallint not null default 5,
  add column if not exists weekly_closing_time time without time zone not null default '18:00:00',
  add column if not exists include_tasks boolean not null default true,
  add column if not exists include_processes boolean not null default true,
  add column if not exists include_obligations boolean not null default true,
  add column if not exists include_finance boolean not null default true;

alter table public.office_push_delivery_log
  add column if not exists title text,
  add column if not exists body text;

alter table public.office_push_delivery_log enable row level security;
grant select on table public.office_push_delivery_log to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='office_push_delivery_log' and policyname='push_delivery_log_select_own'
  ) then
    create policy push_delivery_log_select_own
      on public.office_push_delivery_log
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
