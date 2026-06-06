-- Persisted route fulfilment checkpoints.
-- Run once after db/003_direct_complete_schedule_flow.sql.

begin;

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

create index if not exists request_route_checkpoints_route_id_idx on public.request_route_checkpoints (route_id);
create index if not exists request_route_checkpoints_completed_at_idx on public.request_route_checkpoints (completed_at desc);

update public.workspaces
set
  widgets = array['queue', 'analytics', 'map', 'schedule']::public.widget_id[],
  schedule_kind = 'outreach',
  updated_at = now()
where id = 'aic-link';

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

alter table public.request_route_checkpoints enable row level security;

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

grant select, insert, update, delete on public.request_route_checkpoints to authenticated;
grant execute on function public.allowed_request_transitions(public.request_status, text) to authenticated;

commit;
