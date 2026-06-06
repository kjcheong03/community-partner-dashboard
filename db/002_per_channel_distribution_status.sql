-- Per-channel distribution status migration.
-- Run once on an existing CARA community dashboard Supabase project.

begin;

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

update public.request_tasks t
set status = public.task_effective_status(t.id)
where exists (
  select 1
  from public.request_routes r
  where r.task_id = t.id
);

update public.request_sessions s
set overall_status = public.rollup_request_status(coalesce(task_statuses.statuses, array[]::public.request_status[]))
from (
  select
    t.session_id,
    array_agg(public.task_effective_status(t.id) order by t.created_at, t.id) as statuses
  from public.request_tasks t
  group by t.session_id
) task_statuses
where task_statuses.session_id = s.id;

commit;
