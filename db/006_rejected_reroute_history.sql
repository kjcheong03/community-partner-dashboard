-- Show rerouted rejections in the rejecting workspace's Closed queue.
-- Run once after db/005_cooked_meal_checkpoints.sql.

begin;

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

grant select on public.workspace_work_items to authenticated;
grant select on public.request_reroute_history to authenticated;

commit;
