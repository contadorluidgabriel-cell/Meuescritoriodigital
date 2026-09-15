create table if not exists public.todoist_workspace_config (
  workspace_id uuid primary key references public.office_workspaces(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todoist_workspace_config enable row level security;

comment on table public.todoist_workspace_config is
  'Allowlist server-side dos workspaces autorizados a usar a integração global do Todoist.';
