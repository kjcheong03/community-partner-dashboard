-- CARA Community Partner Dashboard schema
-- Paste into the Supabase SQL editor and run once.
--
-- Shape goals:
-- - caregiver submissions persist as sessions -> tasks -> routes
-- - partner-assigned work lives at task level
-- - route-based food/supply work lives at route level
-- - route_type mirrors the frontend contract exactly:
--   public_distribution | community_distribution | partner_service
-- - organisation kind stays behavioral:
--   partner_service | distribution
-- - parent statuses are derived from child task/route statuses
-- - inventory availability is derived from route item status, with stock rows
--   holding the manually corrected/top-up baseline count

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.app_role as enum ('caregiver', 'workspace_user', 'admin');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.org_kind as enum ('partner_service', 'distribution');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.support_type as enum ('supplies', 'food', 'welfare', 'transport', 'referral');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.request_status as enum ('Pending', 'Accepted', 'In progress', 'Completed', 'Rejected', 'Cancelled');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.fulfilment_kind as enum ('route', 'partner');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.route_type as enum ('public_distribution', 'community_distribution', 'partner_service');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.availability_mode as enum (
    'active_distribution_exercise',
    'local_stock_subject_to_availability',
    'partner_assessment',
    'unavailable'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.workspace_profile as enum ('schedule-ops', 'inventory-ops', 'triage-ops');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.support_group as enum ('welfare', 'referral', 'food', 'transport', 'supplies');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.widget_id as enum ('queue', 'analytics', 'map', 'schedule', 'inventory');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.inventory_kind as enum ('cooked-meals', 'food-packs', 'public-supplies');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.schedule_kind as enum ('outreach', 'transport');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.schedule_status as enum ('Scheduled', 'In progress', 'Completed', 'Cancelled', 'Rescheduled');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.stock_movement_type as enum ('top_up', 'correction', 'fulfilment', 'release', 'manual_adjustment');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.route_checkpoint_stage as enum (
    'accepted',
    'meal_plan_confirmed',
    'meal_preparing',
    'packing',
    'ready_for_pickup',
    'out_for_delivery',
    'completed'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Identity, accounts, organisations, workspaces
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role public.app_role not null default 'caregiver',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id text primary key,
  name text not null,
  logo text,
  account_kind public.org_kind not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_members (
  account_id text not null references public.accounts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table if not exists public.organisations (
  id text primary key,
  name text not null,
  short_name text not null,
  logo text,
  org_kind public.org_kind not null,
  service_areas text[] not null default '{}'::text[],
  support_types public.support_type[] not null default '{}'::public.support_type[],
  support_subtypes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id text primary key,
  org_id text not null references public.organisations (id) on delete restrict,
  account_id text not null references public.accounts (id) on delete restrict,
  slug text not null unique,
  name text not null,
  short_name text not null,
  logo text,
  support_group public.support_group not null,
  profile public.workspace_profile not null,
  widgets public.widget_id[] not null default '{}'::public.widget_id[],
  supply_route_labels text[] not null default '{}'::text[],
  schedule_kind public.schedule_kind,
  inventory_kind public.inventory_kind,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id text not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.fulfilment_route_catalog (
  id uuid primary key default gen_random_uuid(),
  support_type public.support_type not null,
  subtype_label text not null,
  workspace_id text not null references public.workspaces (id) on delete cascade,
  route_name text not null,
  logo text,
  organisation_id text references public.organisations (id) on delete set null,
  route_type public.route_type not null,
  availability_mode public.availability_mode not null,
  cost_label text not null default 'Free',
  detail text,
  status text not null default '',
  inventory_sku text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (support_type, subtype_label, workspace_id),
  constraint fulfilment_route_catalog_org_matches_type check (
    (route_type = 'partner_service' and organisation_id is not null)
    or (route_type <> 'partner_service' and organisation_id is null)
  )
);

-- ---------------------------------------------------------------------------
-- Request contract persistence
-- ---------------------------------------------------------------------------

create table if not exists public.request_sessions (
  id text primary key default gen_random_uuid()::text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  care_recipient_name text not null,
  caregiver_name text not null,
  contact_number text not null,
  contact_method text not null,
  email text,
  relationship text,
  general_area text,
  address text,
  postal_code text,
  access_notes text,
  linked_topic text not null,
  overall_status public.request_status not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.request_sessions (id) on delete cascade,
  task_key text not null,
  fulfilment public.fulfilment_kind not null,
  support_type public.support_type not null,
  selected_subtypes text[] not null default '{}'::text[],
  details jsonb not null default '{}'::jsonb,
  primary_org_id text references public.organisations (id) on delete set null,
  fallback_org_ids text[] not null default '{}'::text[],
  cost_estimate jsonb,
  status public.request_status not null default 'Pending',
  assigned_to text,
  rejection_reason text,
  scheduled_for timestamptz,
  partner_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, task_key),
  constraint request_tasks_partner_has_primary_org check (
    (fulfilment = 'partner' and primary_org_id is not null)
    or (fulfilment = 'route' and primary_org_id is null)
  )
);

create table if not exists public.request_routes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.request_tasks (id) on delete cascade,
  workspace_id text not null references public.workspaces (id) on delete restrict,
  label text not null,
  quantity numeric not null default 1 check (quantity > 0),
  route_name text not null,
  logo text,
  organisation_id text references public.organisations (id) on delete set null,
  route_type public.route_type not null,
  availability_mode public.availability_mode not null,
  cost_label text not null default 'Free',
  detail text,
  status text not null default '',
  lifecycle public.request_status default 'Pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_routes_organisation_id_matches_type check (
    (route_type = 'partner_service' and organisation_id is not null)
    or (route_type <> 'partner_service' and organisation_id is null)
  )
);

alter table public.request_routes
  drop constraint if exists request_routes_distribution_has_no_lifecycle;

alter table public.request_routes
  alter column lifecycle set default 'Pending';

update public.request_routes r
set lifecycle = coalesce(t.status, 'Pending'::public.request_status)
from public.request_tasks t
where t.id = r.task_id
  and r.lifecycle is null
  and r.route_type <> 'partner_service';

-- Persistent stock rows. For food/MOW, one row per meal period + dietary variant.
-- For supplies/food packs, one row per stock item.
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces (id) on delete cascade,
  sku text not null,
  item_name text not null,
  item_group text,
  item_variant text,
  unit text not null default 'unit',
  stock_count integer not null default 0 check (stock_count >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  collection_point text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, sku)
);

-- Route inventory claims. The backend should create these when a route is created
-- so inventory can derive reserved/fulfilled from route/task lifecycle changes.
create table if not exists public.request_route_items (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.request_routes (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  item_key text not null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, item_key)
);

create table if not exists public.request_route_checkpoints (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.request_routes (id) on delete cascade,
  stage public.route_checkpoint_stage not null,
  step_order integer not null check (step_order > 0),
  actor_user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  actor_name text,
  notes text,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (route_id, stage)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  route_item_id uuid references public.request_route_items (id) on delete set null,
  movement_type public.stock_movement_type not null,
  quantity_delta integer not null,
  count_after integer check (count_after >= 0),
  reason text,
  actor_user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.request_status_events (
  id uuid primary key default gen_random_uuid(),
  session_id text references public.request_sessions (id) on delete cascade,
  task_id uuid references public.request_tasks (id) on delete cascade,
  route_id uuid references public.request_routes (id) on delete cascade,
  actor_user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  from_status public.request_status,
  to_status public.request_status not null,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  constraint request_status_events_has_target check (
    session_id is not null or task_id is not null or route_id is not null
  )
);

create table if not exists public.schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces (id) on delete cascade,
  task_id uuid references public.request_tasks (id) on delete cascade,
  route_id uuid references public.request_routes (id) on delete cascade,
  assignee_user_id uuid references public.profiles (id) on delete set null,
  assignee_name text,
  scheduled_for timestamptz not null,
  status public.schedule_status not null default 'Scheduled',
  rescheduled_from timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_assignments_one_target check (
    (task_id is not null and route_id is null)
    or (task_id is null and route_id is not null)
  )
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists account_members_user_id_idx on public.account_members (user_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
create index if not exists fulfilment_route_catalog_support_type_idx on public.fulfilment_route_catalog (support_type);
create index if not exists fulfilment_route_catalog_workspace_id_idx on public.fulfilment_route_catalog (workspace_id);
create index if not exists workspaces_account_id_idx on public.workspaces (account_id);
create index if not exists workspaces_org_id_idx on public.workspaces (org_id);
create index if not exists request_sessions_created_by_idx on public.request_sessions (created_by);
create index if not exists request_sessions_created_at_idx on public.request_sessions (created_at desc);
create index if not exists request_sessions_status_idx on public.request_sessions (overall_status);
create index if not exists request_tasks_session_id_idx on public.request_tasks (session_id);
create index if not exists request_tasks_primary_org_id_idx on public.request_tasks (primary_org_id);
create index if not exists request_tasks_support_type_idx on public.request_tasks (support_type);
create index if not exists request_tasks_status_idx on public.request_tasks (status);
create index if not exists request_routes_task_id_idx on public.request_routes (task_id);
create index if not exists request_routes_workspace_id_idx on public.request_routes (workspace_id);
create index if not exists request_routes_organisation_id_idx on public.request_routes (organisation_id);
create index if not exists request_routes_type_idx on public.request_routes (route_type);
create index if not exists request_routes_lifecycle_idx on public.request_routes (lifecycle);
create index if not exists request_route_items_route_id_idx on public.request_route_items (route_id);
create index if not exists request_route_items_inventory_item_id_idx on public.request_route_items (inventory_item_id);
create index if not exists request_route_checkpoints_route_id_idx on public.request_route_checkpoints (route_id);
create index if not exists request_route_checkpoints_completed_at_idx on public.request_route_checkpoints (completed_at desc);
create index if not exists inventory_items_workspace_id_idx on public.inventory_items (workspace_id);
create index if not exists inventory_movements_inventory_item_id_idx on public.inventory_movements (inventory_item_id);
create index if not exists request_status_events_session_id_idx on public.request_status_events (session_id);
create index if not exists request_status_events_task_id_idx on public.request_status_events (task_id);
create index if not exists request_status_events_route_id_idx on public.request_status_events (route_id);
create index if not exists schedule_assignments_workspace_id_idx on public.schedule_assignments (workspace_id);
create index if not exists schedule_assignments_task_id_idx on public.schedule_assignments (task_id);
create index if not exists schedule_assignments_route_id_idx on public.schedule_assignments (route_id);
create index if not exists schedule_assignments_scheduled_for_idx on public.schedule_assignments (scheduled_for);

-- ---------------------------------------------------------------------------
-- Status rollups and transition helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.rollup_request_status(statuses public.request_status[])
returns public.request_status
language plpgsql
immutable
as $$
begin
  if statuses is null or cardinality(statuses) = 0 then
    return 'Pending'::public.request_status;
  end if;

  if 'Pending'::public.request_status = any(statuses) then
    return 'Pending'::public.request_status;
  end if;

  if 'Accepted'::public.request_status = any(statuses)
    or 'In progress'::public.request_status = any(statuses) then
    return 'In progress'::public.request_status;
  end if;

  if 'Completed'::public.request_status = any(statuses) then
    return 'Completed'::public.request_status;
  end if;

  if 'Rejected'::public.request_status = any(statuses) then
    return 'Rejected'::public.request_status;
  end if;

  return 'Cancelled'::public.request_status;
end;
$$;

create or replace function public.allowed_request_transitions(
  current_status public.request_status,
  transition_scope text
)
returns public.request_status[]
language plpgsql
immutable
as $$
begin
  if transition_scope = 'full' then
    case current_status
      when 'Pending' then return array['Accepted', 'Rejected']::public.request_status[];
      when 'Accepted' then return array['In progress', 'Completed', 'Cancelled']::public.request_status[];
      when 'In progress' then return array['Completed', 'Cancelled']::public.request_status[];
      else return array[]::public.request_status[];
    end case;
  end if;

  if transition_scope = 'reduced' then
    case current_status
      when 'Pending' then return array['Accepted', 'Cancelled']::public.request_status[];
      when 'Accepted' then return array['In progress', 'Completed', 'Cancelled']::public.request_status[];
      when 'In progress' then return array['Completed', 'Cancelled']::public.request_status[];
      else return array[]::public.request_status[];
    end case;
  end if;

  return array[]::public.request_status[];
end;
$$;

create or replace function public.is_valid_request_transition(
  from_status public.request_status,
  to_status public.request_status,
  transition_scope text
)
returns boolean
language sql
immutable
as $$
  select from_status is null
    or to_status = from_status
    or to_status = any(public.allowed_request_transitions(from_status, transition_scope));
$$;

create or replace function public.task_effective_status(task_id_input uuid)
returns public.request_status
language plpgsql
stable
as $$
declare
  task_status public.request_status;
  route_statuses public.request_status[];
begin
  select status
    into task_status
  from public.request_tasks
  where id = task_id_input;

  select array_agg(coalesce(lifecycle, 'Pending'::public.request_status) order by created_at, id)
    into route_statuses
  from public.request_routes
  where task_id = task_id_input;

  if route_statuses is not null and cardinality(route_statuses) > 0 then
    return public.rollup_request_status(route_statuses);
  end if;

  return coalesce(task_status, 'Pending'::public.request_status);
end;
$$;

create or replace function public.route_effective_status(route_id_input uuid)
returns public.request_status
language plpgsql
stable
as $$
declare
  route_record public.request_routes%rowtype;
  parent_status public.request_status;
begin
  select *
    into route_record
  from public.request_routes
  where id = route_id_input;

  if route_record.id is null then
    return 'Pending'::public.request_status;
  end if;

  if route_record.route_type = 'partner_service' then
    return coalesce(route_record.lifecycle, 'Pending'::public.request_status);
  end if;

  select status
    into parent_status
  from public.request_tasks
  where id = route_record.task_id;

  return coalesce(route_record.lifecycle, parent_status, 'Pending'::public.request_status);
end;
$$;

create or replace function public.refresh_session_status(session_id_input text)
returns void
language plpgsql
as $$
declare
  statuses public.request_status[];
begin
  select array_agg(public.task_effective_status(id) order by created_at, id)
    into statuses
  from public.request_tasks
  where session_id = session_id_input;

  update public.request_sessions
  set overall_status = public.rollup_request_status(coalesce(statuses, array[]::public.request_status[]))
  where id = session_id_input;
end;
$$;

create or replace function public.refresh_task_status(task_id_input uuid)
returns void
language plpgsql
as $$
declare
  session_id_value text;
  has_routes boolean;
begin
  select session_id
    into session_id_value
  from public.request_tasks
  where id = task_id_input;

  if session_id_value is null then
    return;
  end if;

  select exists (
    select 1
    from public.request_routes
    where task_id = task_id_input
  )
    into has_routes;

  if has_routes then
    update public.request_tasks
    set status = public.task_effective_status(task_id_input)
    where id = task_id_input;
  else
    perform public.refresh_session_status(session_id_value);
  end if;
end;
$$;

create or replace function public.after_request_tasks_rollup()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_session_status(old.session_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.session_id is distinct from new.session_id then
    perform public.refresh_session_status(old.session_id);
  end if;

  perform public.refresh_session_status(new.session_id);
  return new;
end;
$$;

create or replace function public.after_request_routes_rollup()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_task_status(old.task_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.task_id is distinct from new.task_id then
    perform public.refresh_task_status(old.task_id);
  end if;

  perform public.refresh_task_status(new.task_id);
  return new;
end;
$$;

create or replace function public.guard_task_status_rollup()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.request_routes
    where task_id = new.id
  ) then
    new.status = public.task_effective_status(new.id);
  end if;

  return new;
end;
$$;

create or replace function public.guard_session_status_rollup()
returns trigger
language plpgsql
as $$
declare
  statuses public.request_status[];
begin
  select array_agg(public.task_effective_status(id) order by created_at, id)
    into statuses
  from public.request_tasks
  where session_id = new.id;

  new.overall_status = public.rollup_request_status(coalesce(statuses, array[]::public.request_status[]));
  return new;
end;
$$;

create or replace function public.guard_request_route_consistency()
returns trigger
language plpgsql
as $$
begin
  if new.route_type = 'partner_service' then
    if not exists (
      select 1
      from public.workspaces w
      where w.id = new.workspace_id
        and w.org_id = new.organisation_id
    ) then
      raise exception 'partner_service route workspace_id must belong to organisation_id';
    end if;
  else
    if not exists (
      select 1
      from public.workspaces w
      join public.organisations o on o.id = w.org_id
      where w.id = new.workspace_id
        and o.org_kind = 'distribution'
    ) then
      raise exception 'distribution route workspace_id must belong to a distribution organisation';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_route_item_workspace()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.request_routes r
    join public.inventory_items i on i.id = new.inventory_item_id
    where r.id = new.route_id
      and i.workspace_id = r.workspace_id
  ) then
    raise exception 'request_route_items.inventory_item_id must belong to the route workspace';
  end if;

  return new;
end;
$$;

create or replace function public.guard_schedule_assignment_workspace()
returns trigger
language plpgsql
as $$
begin
  if new.route_id is not null then
    if not exists (
      select 1
      from public.request_routes r
      where r.id = new.route_id
        and r.workspace_id = new.workspace_id
    ) then
      raise exception 'route schedule assignment must use the route workspace';
    end if;
  end if;

  if new.task_id is not null then
    if not exists (
      select 1
      from public.request_tasks t
      where t.id = new.task_id
        and (
          t.primary_org_id = new.workspace_id
          or new.workspace_id = any(t.fallback_org_ids)
        )
    ) then
      raise exception 'task schedule assignment must use a primary or fallback task workspace';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Updated-at and rollup triggers
-- ---------------------------------------------------------------------------

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_accounts on public.accounts;
create trigger set_updated_at_accounts
before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_organisations on public.organisations;
create trigger set_updated_at_organisations
before update on public.organisations
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_workspaces on public.workspaces;
create trigger set_updated_at_workspaces
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_fulfilment_route_catalog on public.fulfilment_route_catalog;
create trigger set_updated_at_fulfilment_route_catalog
before update on public.fulfilment_route_catalog
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_request_sessions on public.request_sessions;
create trigger set_updated_at_request_sessions
before update on public.request_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_request_tasks on public.request_tasks;
create trigger set_updated_at_request_tasks
before update on public.request_tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_request_routes on public.request_routes;
create trigger set_updated_at_request_routes
before update on public.request_routes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_request_route_items on public.request_route_items;
create trigger set_updated_at_request_route_items
before update on public.request_route_items
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_inventory_items on public.inventory_items;
create trigger set_updated_at_inventory_items
before update on public.inventory_items
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_schedule_assignments on public.schedule_assignments;
create trigger set_updated_at_schedule_assignments
before update on public.schedule_assignments
for each row execute function public.set_updated_at();

drop trigger if exists request_tasks_guard_status_rollup on public.request_tasks;
create trigger request_tasks_guard_status_rollup
before update of status on public.request_tasks
for each row execute function public.guard_task_status_rollup();

drop trigger if exists request_sessions_guard_status_rollup on public.request_sessions;
create trigger request_sessions_guard_status_rollup
before update of overall_status on public.request_sessions
for each row execute function public.guard_session_status_rollup();

drop trigger if exists request_routes_guard_consistency on public.request_routes;
create trigger request_routes_guard_consistency
before insert or update of workspace_id, organisation_id, route_type on public.request_routes
for each row execute function public.guard_request_route_consistency();

drop trigger if exists request_route_items_guard_workspace on public.request_route_items;
create trigger request_route_items_guard_workspace
before insert or update of route_id, inventory_item_id on public.request_route_items
for each row execute function public.guard_route_item_workspace();

drop trigger if exists schedule_assignments_guard_workspace on public.schedule_assignments;
create trigger schedule_assignments_guard_workspace
before insert or update of workspace_id, task_id, route_id on public.schedule_assignments
for each row execute function public.guard_schedule_assignment_workspace();

drop trigger if exists request_tasks_rollup_after_write on public.request_tasks;
create trigger request_tasks_rollup_after_write
after insert or update of status, session_id on public.request_tasks
for each row execute function public.after_request_tasks_rollup();

drop trigger if exists request_tasks_rollup_after_delete on public.request_tasks;
create trigger request_tasks_rollup_after_delete
after delete on public.request_tasks
for each row execute function public.after_request_tasks_rollup();

drop trigger if exists request_routes_rollup_after_write on public.request_routes;
create trigger request_routes_rollup_after_write
after insert or update of lifecycle, route_type, task_id on public.request_routes
for each row execute function public.after_request_routes_rollup();

drop trigger if exists request_routes_rollup_after_delete on public.request_routes;
create trigger request_routes_rollup_after_delete
after delete on public.request_routes
for each row execute function public.after_request_routes_rollup();

-- ---------------------------------------------------------------------------
-- Dashboard views
-- ---------------------------------------------------------------------------

create or replace view public.workspace_work_items
with (security_invoker = true)
as
select
  concat(s.id, ':', t.support_type::text) as work_item_id,
  t.primary_org_id as workspace_id,
  'primary'::text as relation,
  'partner-task'::text as item_kind,
  s.id as session_id,
  t.id as task_id,
  null::uuid as route_id,
  t.support_type,
  t.status as status,
  s.overall_status,
  s.created_at,
  s.updated_at,
  s.caregiver_name,
  s.care_recipient_name,
  s.contact_number,
  s.contact_method,
  s.email,
  s.relationship,
  s.general_area,
  s.address,
  s.postal_code,
  s.access_notes,
  s.linked_topic,
  t.selected_subtypes,
  t.details,
  t.cost_estimate,
  t.assigned_to,
  t.rejection_reason,
  t.scheduled_for,
  t.partner_notes,
  null::text as route_label,
  null::public.route_type as route_type,
  null::text as route_status,
  null::public.request_status as route_lifecycle
from public.request_sessions s
join public.request_tasks t on t.session_id = s.id
where t.fulfilment = 'partner'
  and t.primary_org_id is not null

union all

select
  concat(s.id, ':', t.support_type::text, ':backup:', f.workspace_id) as work_item_id,
  f.workspace_id,
  'backup'::text as relation,
  'partner-task'::text as item_kind,
  s.id as session_id,
  t.id as task_id,
  null::uuid as route_id,
  t.support_type,
  t.status as status,
  s.overall_status,
  s.created_at,
  s.updated_at,
  s.caregiver_name,
  s.care_recipient_name,
  s.contact_number,
  s.contact_method,
  s.email,
  s.relationship,
  s.general_area,
  s.address,
  s.postal_code,
  s.access_notes,
  s.linked_topic,
  t.selected_subtypes,
  t.details,
  t.cost_estimate,
  t.assigned_to,
  t.rejection_reason,
  t.scheduled_for,
  t.partner_notes,
  null::text as route_label,
  null::public.route_type as route_type,
  null::text as route_status,
  null::public.request_status as route_lifecycle
from public.request_sessions s
join public.request_tasks t on t.session_id = s.id
cross join lateral unnest(t.fallback_org_ids) as f(workspace_id)
where t.fulfilment = 'partner'

union all

select
  concat(s.id, ':', t.support_type::text, ':rejected:', rejected.workspace_id, ':', e.id::text) as work_item_id,
  rejected.workspace_id,
  'rejected'::text as relation,
  'partner-task'::text as item_kind,
  s.id as session_id,
  t.id as task_id,
  null::uuid as route_id,
  t.support_type,
  'Rejected'::public.request_status as status,
  s.overall_status,
  s.created_at,
  e.created_at as updated_at,
  s.caregiver_name,
  s.care_recipient_name,
  s.contact_number,
  s.contact_method,
  s.email,
  s.relationship,
  s.general_area,
  s.address,
  s.postal_code,
  s.access_notes,
  s.linked_topic,
  t.selected_subtypes,
  t.details,
  t.cost_estimate,
  null::text as assigned_to,
  e.reason as rejection_reason,
  null::timestamptz as scheduled_for,
  null::text as partner_notes,
  null::text as route_label,
  null::public.route_type as route_type,
  null::text as route_status,
  null::public.request_status as route_lifecycle
from public.request_status_events e
join public.request_tasks t on t.id = e.task_id
join public.request_sessions s on s.id = t.session_id
cross join lateral (
  select split_part(split_part(coalesce(e.notes, ''), 'rerouted_from:', 2), ';', 1) as workspace_id
) rejected
where t.fulfilment = 'partner'
  and e.to_status = 'Pending'
  and e.notes like 'rerouted_from:%'
  and rejected.workspace_id <> ''

union all

select
  concat(s.id, ':', t.support_type::text, ':', r.label) as work_item_id,
  r.workspace_id,
  'owner'::text as relation,
  case when r.route_type = 'partner_service' then 'food-route' else 'supplies-route' end as item_kind,
  s.id as session_id,
  t.id as task_id,
  r.id as route_id,
  t.support_type,
  public.route_effective_status(r.id) as status,
  s.overall_status,
  s.created_at,
  s.updated_at,
  s.caregiver_name,
  s.care_recipient_name,
  s.contact_number,
  s.contact_method,
  s.email,
  s.relationship,
  s.general_area,
  s.address,
  s.postal_code,
  s.access_notes,
  s.linked_topic,
  t.selected_subtypes,
  t.details,
  t.cost_estimate,
  t.assigned_to,
  t.rejection_reason,
  t.scheduled_for,
  t.partner_notes,
  r.label as route_label,
  r.route_type,
  r.status as route_status,
  r.lifecycle as route_lifecycle
from public.request_sessions s
join public.request_tasks t on t.session_id = s.id
join public.request_routes r on r.task_id = t.id
where t.fulfilment = 'route';

create or replace view public.request_reroute_history
with (security_invoker = true)
as
select
  s.id as session_id,
  t.id as task_id,
  reroute.from_org_id,
  reroute.to_org_id,
  e.reason,
  e.created_at as rerouted_at
from public.request_status_events e
join public.request_tasks t on t.id = e.task_id
join public.request_sessions s on s.id = t.session_id
cross join lateral (
  select
    split_part(split_part(coalesce(e.notes, ''), 'rerouted_from:', 2), ';', 1) as from_org_id,
    split_part(split_part(coalesce(e.notes, ''), 'rerouted_to:', 2), ';', 1) as to_org_id
) reroute
where t.fulfilment = 'partner'
  and e.to_status = 'Pending'
  and e.notes like 'rerouted_from:%'
  and reroute.from_org_id <> ''
  and reroute.to_org_id <> '';

create or replace view public.inventory_dashboard
with (security_invoker = true)
as
with claims as (
  select
    ri.inventory_item_id,
    coalesce(sum(ri.quantity) filter (
      where public.route_effective_status(ri.route_id) = any(array['Pending', 'Accepted', 'In progress']::public.request_status[])
    ), 0)::integer as reserved_count,
    coalesce(sum(ri.quantity) filter (
      where public.route_effective_status(ri.route_id) = 'Completed'::public.request_status
    ), 0)::integer as fulfilled_count,
    max(r.updated_at) as last_request_update
  from public.request_route_items ri
  join public.request_routes r on r.id = ri.route_id
  group by ri.inventory_item_id
)
select
  i.id,
  i.workspace_id,
  i.sku,
  i.item_name,
  i.item_group,
  i.item_variant,
  i.unit,
  greatest(i.stock_count - coalesce(c.fulfilled_count, 0), 0) as available_count,
  coalesce(c.reserved_count, 0) as reserved_count,
  coalesce(c.fulfilled_count, 0) as fulfilled_count,
  i.low_stock_threshold,
  i.collection_point,
  greatest(i.updated_at, coalesce(c.last_request_update, i.updated_at)) as last_updated,
  case
    when greatest(i.stock_count - coalesce(c.fulfilled_count, 0), 0) = 0 then 'Out'
    when greatest(i.stock_count - coalesce(c.fulfilled_count, 0), 0) < i.low_stock_threshold then 'Low'
    else 'OK'
  end as stock_status
from public.inventory_items i
left join claims c on c.inventory_item_id = i.id;

create or replace view public.schedule_dashboard
with (security_invoker = true)
as
select
  sa.id,
  sa.workspace_id,
  sa.task_id,
  sa.route_id,
  r.label as route_label,
  coalesce(t.support_type, rt.support_type) as support_type,
  case
    when sa.route_id is not null then public.route_effective_status(sa.route_id)
    else public.task_effective_status(sa.task_id)
  end as request_status,
  sa.assignee_user_id,
  sa.assignee_name,
  sa.scheduled_for,
  sa.status as schedule_status,
  sa.rescheduled_from,
  sa.notes,
  s.id as session_id,
  s.caregiver_name,
  s.care_recipient_name,
  s.general_area,
  s.address,
  coalesce(t.selected_subtypes, rt.selected_subtypes) as selected_subtypes,
  coalesce(t.details, rt.details) as details
from public.schedule_assignments sa
left join public.request_tasks t on t.id = sa.task_id
left join public.request_routes r on r.id = sa.route_id
left join public.request_tasks rt on rt.id = r.task_id
join public.request_sessions s on s.id = coalesce(t.session_id, rt.session_id);

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin'::public.app_role, false);
$$;

create or replace function public.is_account_member(account_id_input text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.account_members am
      where am.account_id = account_id_input
        and am.user_id = auth.uid()
    );
$$;

create or replace function public.is_workspace_member(workspace_id_input text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_id_input
        and wm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.workspaces w
      join public.account_members am on am.account_id = w.account_id
      where w.id = workspace_id_input
        and am.user_id = auth.uid()
    );
$$;

create or replace function public.can_access_task(task_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.request_tasks t
      join public.request_sessions s on s.id = t.session_id
      where t.id = task_id_input
        and (
          s.created_by = auth.uid()
          or public.is_workspace_member(t.primary_org_id)
          or exists (
            select 1
            from unnest(t.fallback_org_ids) as f(workspace_id)
            where public.is_workspace_member(f.workspace_id)
          )
          or exists (
            select 1
            from public.request_routes r
            where r.task_id = t.id
              and public.is_workspace_member(r.workspace_id)
          )
        )
    );
$$;

create or replace function public.can_access_route(route_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.request_routes r
      where r.id = route_id_input
        and (
          public.is_workspace_member(r.workspace_id)
          or public.can_access_task(r.task_id)
        )
    );
$$;

create or replace function public.can_access_session(session_id_input text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.request_sessions s
      where s.id = session_id_input
        and s.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.request_tasks t
      where t.session_id = session_id_input
        and public.can_access_task(t.id)
    );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.account_members enable row level security;
alter table public.organisations enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.fulfilment_route_catalog enable row level security;
alter table public.request_sessions enable row level security;
alter table public.request_tasks enable row level security;
alter table public.request_routes enable row level security;
alter table public.inventory_items enable row level security;
alter table public.request_route_items enable row level security;
alter table public.request_route_checkpoints enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.request_status_events enable row level security;
alter table public.schedule_assignments enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert to authenticated
with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists accounts_select_authenticated on public.accounts;
create policy accounts_select_authenticated
on public.accounts for select to authenticated
using (true);

drop policy if exists accounts_admin_write on public.accounts;
create policy accounts_admin_write
on public.accounts for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists account_members_select_own_or_admin on public.account_members;
create policy account_members_select_own_or_admin
on public.account_members for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists account_members_admin_write on public.account_members;
create policy account_members_admin_write
on public.account_members for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists organisations_select_authenticated on public.organisations;
create policy organisations_select_authenticated
on public.organisations for select to authenticated
using (true);

drop policy if exists organisations_admin_write on public.organisations;
create policy organisations_admin_write
on public.organisations for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists workspaces_select_authenticated on public.workspaces;
create policy workspaces_select_authenticated
on public.workspaces for select to authenticated
using (true);

drop policy if exists workspaces_admin_write on public.workspaces;
create policy workspaces_admin_write
on public.workspaces for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists workspace_members_select_own_or_admin on public.workspace_members;
create policy workspace_members_select_own_or_admin
on public.workspace_members for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists workspace_members_admin_write on public.workspace_members;
create policy workspace_members_admin_write
on public.workspace_members for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists fulfilment_route_catalog_select_authenticated on public.fulfilment_route_catalog;
create policy fulfilment_route_catalog_select_authenticated
on public.fulfilment_route_catalog for select to authenticated
using (true);

drop policy if exists fulfilment_route_catalog_admin_write on public.fulfilment_route_catalog;
create policy fulfilment_route_catalog_admin_write
on public.fulfilment_route_catalog for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists request_sessions_select_accessible on public.request_sessions;
create policy request_sessions_select_accessible
on public.request_sessions for select to authenticated
using (public.can_access_session(id));

drop policy if exists request_sessions_insert_own on public.request_sessions;
create policy request_sessions_insert_own
on public.request_sessions for insert to authenticated
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists request_sessions_update_accessible on public.request_sessions;
create policy request_sessions_update_accessible
on public.request_sessions for update to authenticated
using (public.can_access_session(id))
with check (public.can_access_session(id));

drop policy if exists request_sessions_admin_delete on public.request_sessions;
create policy request_sessions_admin_delete
on public.request_sessions for delete to authenticated
using (public.is_admin());

drop policy if exists request_tasks_select_accessible on public.request_tasks;
create policy request_tasks_select_accessible
on public.request_tasks for select to authenticated
using (public.can_access_task(id));

drop policy if exists request_tasks_insert_accessible_session on public.request_tasks;
create policy request_tasks_insert_accessible_session
on public.request_tasks for insert to authenticated
with check (public.can_access_session(session_id));

drop policy if exists request_tasks_update_accessible on public.request_tasks;
create policy request_tasks_update_accessible
on public.request_tasks for update to authenticated
using (public.can_access_task(id))
with check (public.can_access_task(id));

drop policy if exists request_tasks_admin_delete on public.request_tasks;
create policy request_tasks_admin_delete
on public.request_tasks for delete to authenticated
using (public.is_admin());

drop policy if exists request_routes_select_accessible on public.request_routes;
create policy request_routes_select_accessible
on public.request_routes for select to authenticated
using (public.can_access_route(id));

drop policy if exists request_routes_insert_accessible_task on public.request_routes;
create policy request_routes_insert_accessible_task
on public.request_routes for insert to authenticated
with check (public.can_access_task(task_id) or public.is_workspace_member(workspace_id));

drop policy if exists request_routes_update_accessible on public.request_routes;
create policy request_routes_update_accessible
on public.request_routes for update to authenticated
using (public.can_access_route(id))
with check (public.can_access_route(id));

drop policy if exists request_routes_admin_delete on public.request_routes;
create policy request_routes_admin_delete
on public.request_routes for delete to authenticated
using (public.is_admin());

drop policy if exists inventory_items_select_workspace on public.inventory_items;
create policy inventory_items_select_workspace
on public.inventory_items for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists inventory_items_update_workspace on public.inventory_items;
create policy inventory_items_update_workspace
on public.inventory_items for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists inventory_items_admin_insert on public.inventory_items;
create policy inventory_items_admin_insert
on public.inventory_items for insert to authenticated
with check (public.is_admin() or public.is_workspace_member(workspace_id));

drop policy if exists inventory_items_admin_delete on public.inventory_items;
create policy inventory_items_admin_delete
on public.inventory_items for delete to authenticated
using (public.is_admin());

drop policy if exists request_route_items_select_accessible_route on public.request_route_items;
create policy request_route_items_select_accessible_route
on public.request_route_items for select to authenticated
using (public.can_access_route(route_id));

drop policy if exists request_route_items_insert_accessible_route on public.request_route_items;
create policy request_route_items_insert_accessible_route
on public.request_route_items for insert to authenticated
with check (public.can_access_route(route_id));

drop policy if exists request_route_items_update_accessible_route on public.request_route_items;
create policy request_route_items_update_accessible_route
on public.request_route_items for update to authenticated
using (public.can_access_route(route_id))
with check (public.can_access_route(route_id));

drop policy if exists request_route_items_admin_delete on public.request_route_items;
create policy request_route_items_admin_delete
on public.request_route_items for delete to authenticated
using (public.is_admin());

drop policy if exists request_route_checkpoints_select_accessible_route on public.request_route_checkpoints;
create policy request_route_checkpoints_select_accessible_route
on public.request_route_checkpoints for select to authenticated
using (public.can_access_route(route_id));

drop policy if exists request_route_checkpoints_insert_accessible_route on public.request_route_checkpoints;
create policy request_route_checkpoints_insert_accessible_route
on public.request_route_checkpoints for insert to authenticated
with check (public.can_access_route(route_id));

drop policy if exists request_route_checkpoints_update_accessible_route on public.request_route_checkpoints;
create policy request_route_checkpoints_update_accessible_route
on public.request_route_checkpoints for update to authenticated
using (public.can_access_route(route_id))
with check (public.can_access_route(route_id));

drop policy if exists request_route_checkpoints_admin_delete on public.request_route_checkpoints;
create policy request_route_checkpoints_admin_delete
on public.request_route_checkpoints for delete to authenticated
using (public.is_admin());

drop policy if exists inventory_movements_select_workspace on public.inventory_movements;
create policy inventory_movements_select_workspace
on public.inventory_movements for select to authenticated
using (
  exists (
    select 1
    from public.inventory_items i
    where i.id = inventory_item_id
      and public.is_workspace_member(i.workspace_id)
  )
);

drop policy if exists inventory_movements_insert_workspace on public.inventory_movements;
create policy inventory_movements_insert_workspace
on public.inventory_movements for insert to authenticated
with check (
  exists (
    select 1
    from public.inventory_items i
    where i.id = inventory_item_id
      and public.is_workspace_member(i.workspace_id)
  )
);

drop policy if exists request_status_events_select_accessible on public.request_status_events;
create policy request_status_events_select_accessible
on public.request_status_events for select to authenticated
using (
  public.is_admin()
  or (session_id is not null and public.can_access_session(session_id))
  or (task_id is not null and public.can_access_task(task_id))
  or (route_id is not null and public.can_access_route(route_id))
);

drop policy if exists request_status_events_insert_accessible on public.request_status_events;
create policy request_status_events_insert_accessible
on public.request_status_events for insert to authenticated
with check (
  public.is_admin()
  or (session_id is not null and public.can_access_session(session_id))
  or (task_id is not null and public.can_access_task(task_id))
  or (route_id is not null and public.can_access_route(route_id))
);

drop policy if exists schedule_assignments_select_workspace on public.schedule_assignments;
create policy schedule_assignments_select_workspace
on public.schedule_assignments for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists schedule_assignments_insert_workspace on public.schedule_assignments;
create policy schedule_assignments_insert_workspace
on public.schedule_assignments for insert to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists schedule_assignments_update_workspace on public.schedule_assignments;
create policy schedule_assignments_update_workspace
on public.schedule_assignments for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists schedule_assignments_admin_delete on public.schedule_assignments;
create policy schedule_assignments_admin_delete
on public.schedule_assignments for delete to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed stable accounts, organisations, workspaces, and inventory rows
-- ---------------------------------------------------------------------------

insert into public.accounts (id, name, logo, account_kind)
values
  ('allkin', 'Allkin Singapore', '/logos/allkin.png', 'partner_service'),
  ('care-corner', 'Care Corner', '/logos/care-corner.png', 'partner_service'),
  ('st-lukes', 'St Luke''s ElderCare', '/logos/st-lukes.png', 'partner_service'),
  ('aic', 'AIC Link', '/logos/aic.png', 'partner_service'),
  ('touch', 'TOUCH', '/logos/touch.png', 'partner_service'),
  ('food-from-the-heart', 'Food from the Heart', '/logos/food-from-the-heart.png', 'partner_service'),
  ('temasek', 'Temasek Foundation Distribution', '/logos/temasek.png', 'distribution'),
  ('moh', 'MOH ART Kit Distribution', '/logos/moh.png', 'distribution'),
  ('nea', 'NEA Dengue Outreach', '/logos/nea.png', 'distribution')
on conflict (id) do update set
  name = excluded.name,
  logo = excluded.logo,
  account_kind = excluded.account_kind,
  updated_at = now();

insert into public.organisations (
  id,
  name,
  short_name,
  logo,
  org_kind,
  service_areas,
  support_types,
  support_subtypes
)
values
  (
    'allkin-aac-amk',
    'Allkin Singapore',
    'Allkin AAC',
    '/logos/allkin.png',
    'partner_service',
    array['Ang Mo Kio']::text[],
    array['welfare', 'referral']::public.support_type[],
    array['Caregiver cannot check in', 'Follow-up after symptoms', 'General wellbeing check', 'Concern about daily needs', 'Find suitable eldercare service', 'Connect to local AAC', 'Longer-term home care help']::text[]
  ),
  (
    'care-corner-aac-toa-payoh',
    'Care Corner',
    'Care Corner AAC',
    '/logos/care-corner.png',
    'partner_service',
    array['Toa Payoh']::text[],
    array['welfare']::public.support_type[],
    array['Caregiver cannot check in', 'General wellbeing check', 'Concern about daily needs', 'Follow-up after symptoms']::text[]
  ),
  (
    'st-lukes-aac-bishan',
    'St Luke''s ElderCare',
    'St Luke''s AAC',
    '/logos/st-lukes.png',
    'partner_service',
    array['Bishan']::text[],
    array['welfare']::public.support_type[],
    array['Caregiver cannot check in', 'General wellbeing check', 'Concern about daily needs', 'Follow-up after symptoms']::text[]
  ),
  (
    'aic-link',
    'AIC Link',
    'AIC Link',
    '/logos/aic.png',
    'partner_service',
    array['Nationwide']::text[],
    array['referral']::public.support_type[],
    array['Find suitable eldercare service', 'Connect to local AAC', 'Longer-term home care help', 'Apply for support / subsidies']::text[]
  ),
  (
    'touch-meals-on-wheels',
    'TOUCH Meals-on-Wheels',
    'TOUCH MOW',
    '/logos/touch.png',
    'partner_service',
    array['Central', 'Islandwide']::text[],
    array['food']::public.support_type[],
    array['Cooked meals']::text[]
  ),
  (
    'touch-medical-escort-transport',
    'TOUCH Medical Escort & Transport',
    'TOUCH MET',
    '/logos/touch.png',
    'partner_service',
    array['Islandwide']::text[],
    array['transport']::public.support_type[],
    array['Medical appointment transport']::text[]
  ),
  (
    'food-from-the-heart',
    'Food from the Heart',
    'FFTH',
    '/logos/food-from-the-heart.png',
    'partner_service',
    array['Islandwide']::text[],
    array['food']::public.support_type[],
    array['Food pack / rations']::text[]
  ),
  (
    'temasek-distribution',
    'Temasek Foundation Distribution',
    'Temasek',
    '/logos/temasek.png',
    'distribution',
    array['Islandwide']::text[],
    array['supplies']::public.support_type[],
    array['Masks', 'Hand sanitiser']::text[]
  ),
  (
    'moh-art-kit-distribution',
    'MOH ART Kit Distribution',
    'MOH ART Kits',
    '/logos/moh.png',
    'distribution',
    array['Islandwide']::text[],
    array['supplies']::public.support_type[],
    array['ART kits']::text[]
  ),
  (
    'nea-dengue-outreach',
    'NEA Dengue Outreach',
    'NEA Dengue',
    '/logos/nea.png',
    'distribution',
    array['Islandwide']::text[],
    array['supplies']::public.support_type[],
    array['Dengue kit / repellent pack']::text[]
  )
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  logo = excluded.logo,
  org_kind = excluded.org_kind,
  service_areas = excluded.service_areas,
  support_types = excluded.support_types,
  support_subtypes = excluded.support_subtypes,
  updated_at = now();

insert into public.workspaces (
  id,
  org_id,
  account_id,
  slug,
  name,
  short_name,
  logo,
  support_group,
  profile,
  widgets,
  supply_route_labels,
  schedule_kind,
  inventory_kind
)
values
  ('allkin-aac-amk', 'allkin-aac-amk', 'allkin', 'allkin-aac-amk', 'Allkin Singapore', 'Allkin AAC', '/logos/allkin.png', 'welfare', 'schedule-ops', array['queue', 'analytics', 'map', 'schedule']::public.widget_id[], array[]::text[], 'outreach', null),
  ('care-corner-aac-toa-payoh', 'care-corner-aac-toa-payoh', 'care-corner', 'care-corner-aac-toa-payoh', 'Care Corner', 'Care Corner AAC', '/logos/care-corner.png', 'welfare', 'schedule-ops', array['queue', 'analytics', 'map', 'schedule']::public.widget_id[], array[]::text[], 'outreach', null),
  ('st-lukes-aac-bishan', 'st-lukes-aac-bishan', 'st-lukes', 'st-lukes-aac-bishan', 'St Luke''s ElderCare', 'St Luke''s AAC', '/logos/st-lukes.png', 'welfare', 'schedule-ops', array['queue', 'analytics', 'map', 'schedule']::public.widget_id[], array[]::text[], 'outreach', null),
  ('aic-link', 'aic-link', 'aic', 'aic-link', 'AIC Link', 'AIC Link', '/logos/aic.png', 'referral', 'triage-ops', array['queue', 'analytics', 'map', 'schedule']::public.widget_id[], array[]::text[], 'outreach', null),
  ('touch-meals-on-wheels', 'touch-meals-on-wheels', 'touch', 'touch-meals-on-wheels', 'TOUCH Meals-on-Wheels', 'TOUCH MOW', '/logos/touch.png', 'food', 'inventory-ops', array['queue', 'analytics', 'map', 'inventory']::public.widget_id[], array[]::text[], null, 'cooked-meals'),
  ('touch-medical-escort-transport', 'touch-medical-escort-transport', 'touch', 'touch-medical-escort-transport', 'TOUCH Medical Escort & Transport', 'TOUCH MET', '/logos/touch.png', 'transport', 'schedule-ops', array['queue', 'analytics', 'map', 'schedule']::public.widget_id[], array[]::text[], 'transport', null),
  ('food-from-the-heart', 'food-from-the-heart', 'food-from-the-heart', 'food-from-the-heart', 'Food from the Heart', 'FFTH', '/logos/food-from-the-heart.png', 'food', 'inventory-ops', array['queue', 'analytics', 'map', 'inventory']::public.widget_id[], array[]::text[], null, 'food-packs'),
  ('temasek-distribution', 'temasek-distribution', 'temasek', 'temasek-distribution', 'Temasek Foundation Distribution', 'Temasek', '/logos/temasek.png', 'supplies', 'inventory-ops', array['queue', 'analytics', 'map', 'inventory']::public.widget_id[], array['Masks', 'Hand sanitiser']::text[], null, 'public-supplies'),
  ('moh-art-kit-distribution', 'moh-art-kit-distribution', 'moh', 'moh-art-kit-distribution', 'MOH ART Kit Distribution', 'MOH ART Kits', '/logos/moh.png', 'supplies', 'inventory-ops', array['queue', 'analytics', 'map', 'inventory']::public.widget_id[], array['ART kits']::text[], null, 'public-supplies'),
  ('nea-dengue-outreach', 'nea-dengue-outreach', 'nea', 'nea-dengue-outreach', 'NEA Dengue Outreach', 'NEA Dengue', '/logos/nea.png', 'supplies', 'inventory-ops', array['queue', 'analytics', 'map', 'inventory']::public.widget_id[], array['Dengue kit / repellent pack']::text[], null, 'public-supplies')
on conflict (id) do update set
  org_id = excluded.org_id,
  account_id = excluded.account_id,
  slug = excluded.slug,
  name = excluded.name,
  short_name = excluded.short_name,
  logo = excluded.logo,
  support_group = excluded.support_group,
  profile = excluded.profile,
  widgets = excluded.widgets,
  supply_route_labels = excluded.supply_route_labels,
  schedule_kind = excluded.schedule_kind,
  inventory_kind = excluded.inventory_kind,
  updated_at = now();

insert into public.fulfilment_route_catalog (
  support_type,
  subtype_label,
  workspace_id,
  route_name,
  logo,
  organisation_id,
  route_type,
  availability_mode,
  cost_label,
  detail,
  status,
  inventory_sku
)
values
  (
    'food',
    'Cooked meals',
    'touch-meals-on-wheels',
    'TOUCH Meals on Wheels',
    '/logos/touch.png',
    'touch-meals-on-wheels',
    'partner_service',
    'partner_assessment',
    '$4.90-$7.00 / meal',
    'Partner confirms meal availability and delivery timing.',
    'Partner will confirm availability',
    null
  ),
  (
    'food',
    'Food pack / rations',
    'food-from-the-heart',
    'Food from the Heart',
    '/logos/food-from-the-heart.png',
    'food-from-the-heart',
    'partner_service',
    'partner_assessment',
    'Free / partner assessment',
    'Partner confirms pack availability and fulfilment method.',
    'Partner will confirm availability',
    null
  ),
  (
    'supplies',
    'Masks',
    'temasek-distribution',
    'Temasek Foundation distribution exercise',
    '/logos/temasek.png',
    null,
    'public_distribution',
    'active_distribution_exercise',
    'Free',
    'Collection subject to active public distribution stock.',
    'Available while stock lasts',
    'masks'
  ),
  (
    'supplies',
    'Hand sanitiser',
    'temasek-distribution',
    'Temasek Foundation distribution exercise',
    '/logos/temasek.png',
    null,
    'public_distribution',
    'active_distribution_exercise',
    'Free',
    'Collection subject to active public distribution stock.',
    'Available while stock lasts',
    'hand-sanitiser'
  ),
  (
    'supplies',
    'ART kits',
    'moh-art-kit-distribution',
    'Ministry of Health ART kit distribution',
    '/logos/moh.png',
    null,
    'public_distribution',
    'active_distribution_exercise',
    'Free',
    'Collection subject to active public distribution stock.',
    'Available while stock lasts',
    'art-kits'
  ),
  (
    'supplies',
    'Dengue kit / repellent pack',
    'nea-dengue-outreach',
    'NEA dengue outreach / local community stock',
    '/logos/nea.png',
    null,
    'community_distribution',
    'local_stock_subject_to_availability',
    'Free',
    'Collection subject to local community stock.',
    'Available while stock lasts',
    'dengue-kit-repellent-pack'
  )
on conflict (support_type, subtype_label, workspace_id) do update set
  route_name = excluded.route_name,
  logo = excluded.logo,
  organisation_id = excluded.organisation_id,
  route_type = excluded.route_type,
  availability_mode = excluded.availability_mode,
  cost_label = excluded.cost_label,
  detail = excluded.detail,
  status = excluded.status,
  inventory_sku = excluded.inventory_sku,
  updated_at = now();

insert into public.inventory_items (
  workspace_id,
  sku,
  item_name,
  item_group,
  item_variant,
  unit,
  stock_count,
  low_stock_threshold,
  collection_point,
  metadata
)
values
  ('touch-meals-on-wheels', 'lunch-regular', 'Regular', 'Lunch', 'Regular', 'portion', 34, 10, 'Central meal kitchen', '{"mealPeriod":"Lunch","dietaryVariant":"Regular"}'::jsonb),
  ('touch-meals-on-wheels', 'lunch-halal', 'Halal', 'Lunch', 'Halal', 'portion', 14, 4, 'Halal meal shelf', '{"mealPeriod":"Lunch","dietaryVariant":"Halal"}'::jsonb),
  ('touch-meals-on-wheels', 'lunch-vegetarian', 'Vegetarian', 'Lunch', 'Vegetarian', 'portion', 10, 3, 'Diet kitchen shelf', '{"mealPeriod":"Lunch","dietaryVariant":"Vegetarian"}'::jsonb),
  ('touch-meals-on-wheels', 'lunch-soft-food', 'Soft food', 'Lunch', 'Soft food', 'portion', 8, 3, 'Diet kitchen shelf', '{"mealPeriod":"Lunch","dietaryVariant":"Soft food"}'::jsonb),
  ('touch-meals-on-wheels', 'lunch-low-sugar', 'Low sugar', 'Lunch', 'Low sugar', 'portion', 7, 3, 'Diet kitchen shelf', '{"mealPeriod":"Lunch","dietaryVariant":"Low sugar"}'::jsonb),
  ('touch-meals-on-wheels', 'lunch-low-salt', 'Low salt', 'Lunch', 'Low salt', 'portion', 9, 3, 'Diet kitchen shelf', '{"mealPeriod":"Lunch","dietaryVariant":"Low salt"}'::jsonb),
  ('touch-meals-on-wheels', 'lunch-special', 'Special', 'Lunch', 'Special', 'portion', 5, 2, 'Special prep shelf', '{"mealPeriod":"Lunch","dietaryVariant":"Special"}'::jsonb),
  ('touch-meals-on-wheels', 'dinner-regular', 'Regular', 'Dinner', 'Regular', 'portion', 30, 10, 'Central meal kitchen', '{"mealPeriod":"Dinner","dietaryVariant":"Regular"}'::jsonb),
  ('touch-meals-on-wheels', 'dinner-halal', 'Halal', 'Dinner', 'Halal', 'portion', 12, 4, 'Halal meal shelf', '{"mealPeriod":"Dinner","dietaryVariant":"Halal"}'::jsonb),
  ('touch-meals-on-wheels', 'dinner-vegetarian', 'Vegetarian', 'Dinner', 'Vegetarian', 'portion', 9, 3, 'Diet kitchen shelf', '{"mealPeriod":"Dinner","dietaryVariant":"Vegetarian"}'::jsonb),
  ('touch-meals-on-wheels', 'dinner-soft-food', 'Soft food', 'Dinner', 'Soft food', 'portion', 7, 3, 'Diet kitchen shelf', '{"mealPeriod":"Dinner","dietaryVariant":"Soft food"}'::jsonb),
  ('touch-meals-on-wheels', 'dinner-low-sugar', 'Low sugar', 'Dinner', 'Low sugar', 'portion', 6, 3, 'Diet kitchen shelf', '{"mealPeriod":"Dinner","dietaryVariant":"Low sugar"}'::jsonb),
  ('touch-meals-on-wheels', 'dinner-low-salt', 'Low salt', 'Dinner', 'Low salt', 'portion', 8, 3, 'Diet kitchen shelf', '{"mealPeriod":"Dinner","dietaryVariant":"Low salt"}'::jsonb),
  ('touch-meals-on-wheels', 'dinner-special', 'Special', 'Dinner', 'Special', 'portion', 5, 2, 'Special prep shelf', '{"mealPeriod":"Dinner","dietaryVariant":"Special"}'::jsonb),
  ('food-from-the-heart', 'standard-food-pack', 'Standard food pack', null, null, 'pack', 26, 10, 'Community pack store', '{"packType":"Standard food pack"}'::jsonb),
  ('food-from-the-heart', 'fresh-food-pack', 'Fresh food pack', null, null, 'pack', 7, 8, 'Fresh food shelf', '{"packType":"Fresh food pack"}'::jsonb),
  ('temasek-distribution', 'masks', 'Masks', null, null, 'box', 420, 120, 'Temasek distribution shelf', '{}'::jsonb),
  ('temasek-distribution', 'hand-sanitiser', 'Hand sanitiser', null, null, 'bottle', 75, 30, 'Temasek distribution shelf', '{}'::jsonb),
  ('moh-art-kit-distribution', 'art-kits', 'ART kits', null, null, 'kit', 38, 40, 'MOH pickup shelf', '{}'::jsonb),
  ('nea-dengue-outreach', 'dengue-kit-repellent-pack', 'Dengue kit / repellent pack', null, null, 'pack', 1, 10, 'NEA outreach shelf', '{}'::jsonb)
on conflict (workspace_id, sku) do update set
  item_name = excluded.item_name,
  item_group = excluded.item_group,
  item_variant = excluded.item_variant,
  unit = excluded.unit,
  stock_count = excluded.stock_count,
  low_stock_threshold = excluded.low_stock_threshold,
  collection_point = excluded.collection_point,
  metadata = excluded.metadata,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.workspace_work_items to authenticated;
grant select on public.request_reroute_history to authenticated;
grant select on public.inventory_dashboard to authenticated;
grant select on public.schedule_dashboard to authenticated;
grant select, insert, update, delete on public.request_route_checkpoints to authenticated;
grant execute on function public.rollup_request_status(public.request_status[]) to authenticated;
grant execute on function public.allowed_request_transitions(public.request_status, text) to authenticated;
grant execute on function public.is_valid_request_transition(public.request_status, public.request_status, text) to authenticated;
grant execute on function public.task_effective_status(uuid) to authenticated;
grant execute on function public.route_effective_status(uuid) to authenticated;

commit;
