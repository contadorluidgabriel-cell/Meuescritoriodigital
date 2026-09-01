create table if not exists public.office_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Meu Escritório',
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.office_workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  display_name text not null default '',
  role text not null check (role in ('admin','collaborator','partner')),
  partner_id text,
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  permissions jsonb not null default '{}'::jsonb,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(workspace_id, email),
  unique(workspace_id, user_id)
);

create table if not exists public.office_workspace_snapshots (
  workspace_id uuid primary key references public.office_workspaces(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  app_version text not null default '11.1',
  version bigint not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_user_workspace_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_workspace_id uuid references public.office_workspaces(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.office_audit_log (
  id bigserial primary key,
  workspace_id uuid not null references public.office_workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null default '',
  actor_role text not null default '',
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists office_members_user_idx on public.office_members(user_id, status);
create index if not exists office_members_workspace_idx on public.office_members(workspace_id, status);
create index if not exists office_members_partner_idx on public.office_members(workspace_id, partner_id) where partner_id is not null;
create index if not exists office_audit_workspace_created_idx on public.office_audit_log(workspace_id, created_at desc);
create index if not exists office_audit_actor_created_idx on public.office_audit_log(actor_user_id, created_at desc);

alter table public.office_workspaces enable row level security;
alter table public.office_members enable row level security;
alter table public.office_workspace_snapshots enable row level security;
alter table public.office_user_workspace_preferences enable row level security;
alter table public.office_audit_log enable row level security;

insert into public.office_workspaces (owner_user_id, name, created_at, updated_at)
select s.user_id, coalesce(nullif(s.payload->'med_configuracoes'->>'office', ''), 'Meu Escritório'), s.created_at, s.updated_at
from public.office_snapshots s
on conflict (owner_user_id) do nothing;

insert into public.office_members (workspace_id, user_id, email, display_name, role, status, permissions, joined_at, updated_at)
select w.id, w.owner_user_id, lower(coalesce(u.email, w.owner_user_id::text || '@local.invalid')),
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(s.payload->'med_configuracoes'->>'user', ''), 'Administrador'),
  'admin', 'active',
  '{"clients":true,"tasks":true,"processes":true,"obligations":true,"finance":true,"team":true,"delete_records":true,"manage_clients":true}'::jsonb,
  coalesce(u.created_at, now()), now()
from public.office_workspaces w
join auth.users u on u.id = w.owner_user_id
left join public.office_snapshots s on s.user_id = w.owner_user_id
on conflict (workspace_id, user_id) do nothing;

insert into public.office_workspace_snapshots (workspace_id, payload, app_version, version, updated_by, created_at, updated_at)
select w.id, s.payload, coalesce(s.app_version, '11.1'), 1, s.user_id, s.created_at, s.updated_at
from public.office_workspaces w
join public.office_snapshots s on s.user_id = w.owner_user_id
on conflict (workspace_id) do nothing;

insert into public.office_user_workspace_preferences (user_id, active_workspace_id, updated_at)
select owner_user_id, id, now() from public.office_workspaces
on conflict (user_id) do nothing;
