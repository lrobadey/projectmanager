-- Project Manager schema
-- Run this in the Supabase SQL editor (or via the CLI) to set up tables + RLS.
-- Safe to re-run: guarded enums, idempotent tables, and policies are reset.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $do$ begin
  create type project_tier as enum ('primary', 'secondary', 'tertiary', 'incubating', 'idea');
exception when duplicate_object then null; end $do$;

-- Backfill 'incubating' for databases created before it existed (no-op if present).
alter type project_tier add value if not exists 'incubating' before 'idea';

-- The Completed column: a special tier projects graduate into when finished.
alter type project_tier add value if not exists 'completed';

do $do$ begin
  create type project_status as enum ('active', 'on_hold', 'done', 'archived', 'idea');
exception when duplicate_object then null; end $do$;

-- Backfill 'idea' for databases created before it existed (no-op if present).
-- Idea Vault projects carry this status; it is never picked from a dropdown.
alter type project_status add value if not exists 'idea';

-- Postgres forbids *using* a newly added enum value in the same transaction
-- that added it. The Supabase SQL editor runs this whole file as one
-- transaction, so we commit here to make 'incubating' / 'idea' usable below
-- (e.g. the backfill UPDATE). In psql autocommit this is a harmless no-op.
commit;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  -- A short tagline shown under the title on the big "hero" tier cards.
  subtitle    text,
  description text,
  tier        project_tier   not null default 'idea',
  status      project_status not null default 'active',
  due_date    date,
  -- Origin tier remembered when a project is moved into the Completed column.
  completed_from_tier project_tier,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Backfill the column for databases created before it existed.
alter table public.projects
  add column if not exists completed_from_tier project_tier;

-- Backfill the subtitle column for databases created before it existed.
alter table public.projects
  add column if not exists subtitle text;

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_tier_idx on public.projects (tier);

-- Idea Vault projects always carry the 'idea' status. Align any existing rows.
-- Safe here because the enum value was committed above.
update public.projects set status = 'idea' where tier = 'idea' and status <> 'idea';

-- ---------------------------------------------------------------------------
-- Milestones (timeline checkpoints within a project)
-- ---------------------------------------------------------------------------
create table if not exists public.milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  due_date    date,
  completed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists milestones_project_id_idx on public.milestones (project_id);

-- ---------------------------------------------------------------------------
-- Sub-goals (a checklist of steps within a project)
-- ---------------------------------------------------------------------------
create table if not exists public.subgoals (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  -- Free-form notes for a single sub-goal, edited inline on the hero cards.
  notes       text,
  completed   boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists subgoals_project_id_idx on public.subgoals (project_id);

-- Backfill the notes column for databases created before it existed.
alter table public.subgoals
  add column if not exists notes text;

-- ---------------------------------------------------------------------------
-- Source links (clickable references attached to a project)
-- ---------------------------------------------------------------------------
create table if not exists public.project_links (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  url         text not null,
  title       text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists project_links_project_id_idx on public.project_links (project_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $func$
begin
  new.updated_at = now();
  return new;
end;
$func$ language plpgsql;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user only sees their own rows
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.subgoals enable row level security;
alter table public.project_links enable row level security;

drop policy if exists "Users manage own projects" on public.projects;
create policy "Users manage own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own milestones" on public.milestones;
create policy "Users manage own milestones"
  on public.milestones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own subgoals" on public.subgoals;
create policy "Users manage own subgoals"
  on public.subgoals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own project_links" on public.project_links;
create policy "Users manage own project_links"
  on public.project_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
