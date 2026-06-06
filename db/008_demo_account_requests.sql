-- Curated caregiver requests using normal req-* IDs.
-- Run after db/006_rejected_reroute_history.sql. It can be run before or after 007.
--
-- IMPORTANT: change demo_email below only if ORCA's demo-mode filter changes.

begin;

create or replace function pg_temp.demo_uuid(seed text)
returns uuid
language sql
immutable
as $$
  select (
    substr(md5(seed), 1, 8) || '-' ||
    substr(md5(seed), 9, 4) || '-' ||
    substr(md5(seed), 13, 4) || '-' ||
    substr(md5(seed), 17, 4) || '-' ||
    substr(md5(seed), 21, 12)
  )::uuid;
$$;

create temporary table demo_account_setting (
  demo_email text not null
) on commit drop;

insert into demo_account_setting (demo_email)
values ('demo@orca.sg');

delete from public.request_sessions
where id like 'demo-account-%'
  or (
    created_by is null
    and email in ((select demo_email from demo_account_setting), 'demo@example.com', 'demo@cara.sg')
  );

create temporary table demo_sessions (
  session_id text primary key,
  task_id uuid not null,
  support_type public.support_type not null,
  task_key text not null,
  fulfilment public.fulfilment_kind not null,
  primary_org_id text,
  selected_subtypes text[] not null,
  status public.request_status not null,
  rejection_reason text,
  details jsonb not null,
  cost_estimate jsonb,
  created_at timestamptz not null,
  area text not null,
  address text not null,
  postal_code text not null,
  linked_topic text not null
) on commit drop;

insert into demo_sessions (
  session_id,
  task_id,
  support_type,
  task_key,
  fulfilment,
  primary_org_id,
  selected_subtypes,
  status,
  rejection_reason,
  details,
  cost_estimate,
  created_at,
  area,
  address,
  postal_code,
  linked_topic
)
values
  (
    'req-20260611-0001',
    pg_temp.demo_uuid('curated-task-001'),
    'food',
    'food-pack',
    'route',
    null,
    array['Food pack / rations'],
    'Pending',
    null,
    jsonb_build_object(
      'packType', 'Standard food pack',
      'numberOfPacks', '1',
      'neededBy', 'Today',
      'fulfilmentMethod', 'Deliver',
      'preferredDeliveryWindow', 'Afternoon',
      'generalPreferredArea', 'Ang Mo Kio',
      'timingConstraints', 'Caregiver is at work before 2 pm.',
      'foodRestrictions', jsonb_build_array('No beef'),
      'restrictionNotes', 'Recipient avoids beef products.'
    ),
    null,
    timestamptz '2026-06-11 08:10:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'meal-support'
  ),
  (
    'req-20260611-0002',
    pg_temp.demo_uuid('curated-task-002'),
    'supplies',
    'supplies',
    'route',
    null,
    array['ART kits', 'Hand sanitiser', 'Masks'],
    'In progress',
    null,
    jsonb_build_object(
      'itemsNeeded', jsonb_build_array(
        jsonb_build_object('item', 'ART kits', 'quantity', '2'),
        jsonb_build_object('item', 'Hand sanitiser', 'quantity', '1'),
        jsonb_build_object('item', 'Masks', 'quantity', '2')
      ),
      'neededBy', 'Today',
      'suppliesFulfilment', 'Deliver to home',
      'preferredDeliveryTime', '10 am - 12 pm',
      'preferredCollectionArea', 'Ang Mo Kio',
      'notes', 'Recipient has respiratory symptoms; caregiver is isolating.'
    ),
    null,
    timestamptz '2026-06-10 16:40:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'home-supplies'
  ),
  (
    'req-20260611-0003',
    pg_temp.demo_uuid('curated-task-003'),
    'food',
    'cooked-meals',
    'route',
    null,
    array['Cooked meals'],
    'Completed',
    null,
    jsonb_build_object(
      'portionsPerMeal', 1,
      'mealsNeeded', jsonb_build_array('Lunch', 'Dinner'),
      'startDate', 'Today',
      'startDateValue', '2026-06-10',
      'duration', '1 week',
      'dietaryRestrictions', jsonb_build_array('Halal'),
      'preferredDeliveryTime', 'Lunch and dinner run',
      'notes', 'Caregiver requested recurring meals while recovering.'
    ),
    jsonb_build_object('label', '$4.90-$7.00 / meal', 'min', 4.90, 'max', 7.00, 'unit', 'meal'),
    timestamptz '2026-06-10 09:25:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'meal-support'
  ),
  (
    'req-20260611-0004',
    pg_temp.demo_uuid('curated-task-004'),
    'welfare',
    'welfare-check',
    'partner',
    'allkin-aac-amk',
    array['Welfare check'],
    'In progress',
    null,
    jsonb_build_object(
      'checkMethod', 'Phone call',
      'checkInDay', 'Choose date',
      'checkInDayValue', '2026-06-11',
      'preferredTime', 'Morning',
      'language', 'Mandarin',
      'safetyNotes', 'Recipient does not always pick up unknown numbers.',
      'notes', 'Caregiver could not reach recipient this morning.'
    ),
    null,
    timestamptz '2026-06-09 18:20:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'care-recipient-check-in'
  ),
  (
    'req-20260611-0005',
    pg_temp.demo_uuid('curated-task-005'),
    'transport',
    'transport',
    'partner',
    'touch-medical-escort-transport',
    array['Medical transport'],
    'In progress',
    null,
    jsonb_build_object(
      'destination', 'Tan Tock Seng Hospital',
      'appointmentDateTime', to_jsonb(timestamptz '2026-06-11 14:30:00+08'),
      'pickupArea', 'Ang Mo Kio',
      'wheelchairRequired', true,
      'escortNeeded', true,
      'caregiverAccompanying', false,
      'returnTripNeeded', true,
      'mobilityNeeds', 'Wheelchair assistance from lift lobby.',
      'notes', 'Please allow time for dialysis appointment registration.'
    ),
    null,
    timestamptz '2026-06-09 12:05:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'appointment-transport'
  ),
  (
    'req-20260611-0006',
    pg_temp.demo_uuid('curated-task-006'),
    'referral',
    'care-referral',
    'partner',
    'aic-link',
    array['Care referral'],
    'In progress',
    null,
    jsonb_build_object(
      'mainConcern', 'Long-term care options',
      'currentSituation', 'Caregiver needs help comparing home care, day care, and subsidy options.',
      'language', 'English',
      'existingSupport', 'No formal support yet.',
      'notes', 'Family prefers a call before 6 pm.'
    ),
    null,
    timestamptz '2026-06-08 15:10:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'care-navigation'
  ),
  (
    'req-20260611-0007',
    pg_temp.demo_uuid('curated-task-007'),
    'welfare',
    'welfare-rerouted',
    'partner',
    'care-corner-aac-toa-payoh',
    array['Welfare check'],
    'In progress',
    null,
    jsonb_build_object(
      'checkMethod', 'Home visit',
      'checkInDay', 'Choose date',
      'checkInDayValue', '2026-06-11',
      'preferredTime', 'Afternoon',
      'language', 'Hokkien',
      'safetyNotes', 'Neighbour says recipient may be anxious with strangers.',
      'notes', 'Primary centre declined due to same-day capacity; backup accepted.'
    ),
    null,
    timestamptz '2026-06-08 10:55:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'care-recipient-check-in'
  ),
  (
    'req-20260611-0008',
    pg_temp.demo_uuid('curated-task-008'),
    'food',
    'food-pack-completed',
    'route',
    null,
    array['Food pack / rations'],
    'Completed',
    null,
    jsonb_build_object(
      'packType', 'Fresh food pack',
      'numberOfPacks', '2',
      'neededBy', 'This week',
      'fulfilmentMethod', 'Deliver',
      'preferredDeliveryWindow', 'Morning',
      'generalPreferredArea', 'Ang Mo Kio',
      'foodRestrictions', '[]'::jsonb,
      'restrictionNotes', null
    ),
    null,
    timestamptz '2026-06-05 11:35:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'meal-support'
  ),
  (
    'req-20260611-0009',
    pg_temp.demo_uuid('curated-task-009'),
    'transport',
    'transport-completed',
    'partner',
    'touch-medical-escort-transport',
    array['Medical transport'],
    'Completed',
    null,
    jsonb_build_object(
      'destination', 'Singapore General Hospital',
      'appointmentDateTime', to_jsonb(timestamptz '2026-06-06 09:45:00+08'),
      'pickupArea', 'Ang Mo Kio',
      'wheelchairRequired', false,
      'escortNeeded', true,
      'caregiverAccompanying', true,
      'returnTripNeeded', true,
      'mobilityNeeds', 'Slow walking pace; allow buffer time.',
      'notes', 'Completed with return trip.'
    ),
    null,
    timestamptz '2026-06-04 14:50:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'appointment-transport'
  ),
  (
    'req-20260611-0010',
    pg_temp.demo_uuid('curated-task-010'),
    'referral',
    'care-referral-rejected',
    'partner',
    'aic-link',
    array['Care referral'],
    'Rejected',
    'Needs urgent clinical triage before social-care navigation.',
    jsonb_build_object(
      'mainConcern', 'Home nursing advice',
      'currentSituation', 'Caregiver reports a sudden deterioration and needs medical triage first.',
      'language', 'English',
      'existingSupport', 'Currently seeing a polyclinic doctor.',
      'notes', 'Advise caregiver to contact healthcare provider first.'
    ),
    null,
    timestamptz '2026-06-03 09:40:00+08',
    'Ang Mo Kio',
    'Blk 123 Ang Mo Kio Ave 6, #08-45, Singapore 560123',
    '560123',
    'care-navigation'
  );

insert into public.request_sessions (
  id,
  created_by,
  caregiver_name,
  care_recipient_name,
  contact_number,
  contact_method,
  email,
  relationship,
  general_area,
  address,
  postal_code,
  access_notes,
  linked_topic,
  overall_status,
  created_at,
  updated_at
)
select
  s.session_id,
  null::uuid,
  'Chloe',
  'Madam Tan',
  '+65 8123 4567',
  'WhatsApp',
  setting.demo_email,
  null,
  s.area,
  s.address,
  s.postal_code,
  null,
  s.linked_topic,
  s.status,
  s.created_at,
  s.created_at
from demo_sessions s
cross join demo_account_setting setting;

insert into public.request_tasks (
  id,
  session_id,
  task_key,
  fulfilment,
  support_type,
  selected_subtypes,
  details,
  primary_org_id,
  fallback_org_ids,
  cost_estimate,
  status,
  rejection_reason,
  assigned_to,
  scheduled_for,
  partner_notes,
  created_at,
  updated_at
)
select
  task_id,
  session_id,
  task_key,
  fulfilment,
  support_type,
  selected_subtypes,
  details,
  primary_org_id,
  array[]::text[],
  cost_estimate,
  status,
  rejection_reason,
  null,
  null,
  case
    when status = 'Completed'::public.request_status then 'Completed by partner.'
    when status = 'Rejected'::public.request_status then rejection_reason
    else null
  end,
  created_at,
  created_at
from demo_sessions;

insert into public.request_routes (
  id,
  task_id,
  workspace_id,
  organisation_id,
  label,
  quantity,
  route_name,
  logo,
  route_type,
  availability_mode,
  cost_label,
  detail,
  status,
  lifecycle,
  created_at,
  updated_at
)
values
  (
    pg_temp.demo_uuid('curated-route-001-food-pack'),
    pg_temp.demo_uuid('curated-task-001'),
    'food-from-the-heart',
    'food-from-the-heart',
    'Food pack / rations',
    1,
    'Food from the Heart',
    '/logos/food-from-the-heart.png',
    'partner_service',
    'partner_assessment',
    'Free / partner assessment',
    'Partner confirms pack availability and fulfilment method.',
    'Partner will confirm availability',
    'Pending',
    timestamptz '2026-06-11 08:10:00+08',
    timestamptz '2026-06-11 08:10:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-route-002-art'),
    pg_temp.demo_uuid('curated-task-002'),
    'moh-art-kit-distribution',
    null,
    'ART kits',
    2,
    'Ministry of Health ART kit distribution',
    '/logos/moh.png',
    'public_distribution',
    'active_distribution_exercise',
    'Free',
    'ART kits for caregivers monitoring respiratory symptoms.',
    'Dispatch with active distribution stock',
    'Completed',
    timestamptz '2026-06-10 16:40:00+08',
    timestamptz '2026-06-10 16:40:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-route-002-hand'),
    pg_temp.demo_uuid('curated-task-002'),
    'temasek-distribution',
    null,
    'Hand sanitiser',
    1,
    'Temasek Foundation distribution exercise',
    '/logos/temasek.png',
    'public_distribution',
    'active_distribution_exercise',
    'Free',
    'Hand sanitiser from Temasek community stock.',
    'Dispatch with active distribution stock',
    'In progress',
    timestamptz '2026-06-10 16:40:00+08',
    timestamptz '2026-06-10 16:40:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-route-002-masks'),
    pg_temp.demo_uuid('curated-task-002'),
    'temasek-distribution',
    null,
    'Masks',
    2,
    'Temasek Foundation distribution exercise',
    '/logos/temasek.png',
    'public_distribution',
    'active_distribution_exercise',
    'Free',
    'Mask collection from community distribution shelves.',
    'Dispatch with active distribution stock',
    'In progress',
    timestamptz '2026-06-10 16:40:00+08',
    timestamptz '2026-06-10 16:40:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-route-003-cooked'),
    pg_temp.demo_uuid('curated-task-003'),
    'touch-meals-on-wheels',
    'touch-meals-on-wheels',
    'Cooked meals',
    1,
    'TOUCH Meals on Wheels',
    '/logos/touch.png',
    'partner_service',
    'partner_assessment',
    '$4.90-$7.00 / meal',
    'Partner confirms meal availability and delivery timing.',
    'Partner will confirm availability',
    'Completed',
    timestamptz '2026-06-10 09:25:00+08',
    timestamptz '2026-06-10 09:25:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-route-008-food-pack'),
    pg_temp.demo_uuid('curated-task-008'),
    'food-from-the-heart',
    'food-from-the-heart',
    'Food pack / rations',
    2,
    'Food from the Heart',
    '/logos/food-from-the-heart.png',
    'partner_service',
    'partner_assessment',
    'Free / partner assessment',
    'Partner confirms pack availability and fulfilment method.',
    'Partner will confirm availability',
    'Completed',
    timestamptz '2026-06-05 11:35:00+08',
    timestamptz '2026-06-05 11:35:00+08'
  );

insert into public.request_route_items (
  id,
  route_id,
  inventory_item_id,
  item_key,
  item_name,
  quantity
)
select
  pg_temp.demo_uuid('curated-route-item:' || item.route_id::text || ':' || item.sku),
  item.route_id,
  i.id,
  item.sku,
  i.item_name,
  item.quantity
from (
  values
    (pg_temp.demo_uuid('curated-route-001-food-pack'), 'standard-food-pack', 1),
    (pg_temp.demo_uuid('curated-route-002-art'), 'art-kits', 2),
    (pg_temp.demo_uuid('curated-route-002-hand'), 'hand-sanitiser', 1),
    (pg_temp.demo_uuid('curated-route-002-masks'), 'masks', 2),
    (pg_temp.demo_uuid('curated-route-003-cooked'), 'lunch-halal', 1),
    (pg_temp.demo_uuid('curated-route-003-cooked'), 'dinner-halal', 1),
    (pg_temp.demo_uuid('curated-route-008-food-pack'), 'fresh-food-pack', 2)
) as item(route_id, sku, quantity)
join public.request_routes r on r.id = item.route_id
join public.inventory_items i
  on i.workspace_id = r.workspace_id
  and i.sku = item.sku;

insert into public.request_route_checkpoints (
  id,
  route_id,
  stage,
  step_order,
  actor_name,
  completed_at,
  created_at
)
select
  pg_temp.demo_uuid('curated-checkpoint:' || checkpoint.route_id::text || ':' || checkpoint.stage),
  checkpoint.route_id,
  checkpoint.stage::public.route_checkpoint_stage,
  checkpoint.step_order,
  checkpoint.actor_name,
  checkpoint.completed_at,
  checkpoint.completed_at
from (
  values
    (pg_temp.demo_uuid('curated-route-002-art'), 'accepted', 1, 'Ministry of Health', timestamptz '2026-06-10 17:00:00+08'),
    (pg_temp.demo_uuid('curated-route-002-art'), 'packing', 2, 'Ministry of Health', timestamptz '2026-06-10 17:20:00+08'),
    (pg_temp.demo_uuid('curated-route-002-art'), 'out_for_delivery', 3, 'Ministry of Health', timestamptz '2026-06-10 18:05:00+08'),
    (pg_temp.demo_uuid('curated-route-002-art'), 'completed', 4, 'Ministry of Health', timestamptz '2026-06-10 19:10:00+08'),
    (pg_temp.demo_uuid('curated-route-002-hand'), 'accepted', 1, 'Temasek Foundation', timestamptz '2026-06-10 17:05:00+08'),
    (pg_temp.demo_uuid('curated-route-002-hand'), 'packing', 2, 'Temasek Foundation', timestamptz '2026-06-10 17:45:00+08'),
    (pg_temp.demo_uuid('curated-route-002-masks'), 'accepted', 1, 'Temasek Foundation', timestamptz '2026-06-10 17:05:00+08'),
    (pg_temp.demo_uuid('curated-route-002-masks'), 'packing', 2, 'Temasek Foundation', timestamptz '2026-06-10 17:40:00+08'),
    (pg_temp.demo_uuid('curated-route-002-masks'), 'out_for_delivery', 3, 'Temasek Foundation', timestamptz '2026-06-11 08:25:00+08'),
    (pg_temp.demo_uuid('curated-route-003-cooked'), 'accepted', 1, 'TOUCH Meals-on-Wheels', timestamptz '2026-06-10 10:00:00+08'),
    (pg_temp.demo_uuid('curated-route-003-cooked'), 'meal_plan_confirmed', 2, 'TOUCH Meals-on-Wheels', timestamptz '2026-06-10 10:35:00+08'),
    (pg_temp.demo_uuid('curated-route-003-cooked'), 'meal_preparing', 3, 'TOUCH Meals-on-Wheels', timestamptz '2026-06-10 11:05:00+08'),
    (pg_temp.demo_uuid('curated-route-008-food-pack'), 'accepted', 1, 'Food from the Heart', timestamptz '2026-06-05 12:10:00+08'),
    (pg_temp.demo_uuid('curated-route-008-food-pack'), 'packing', 2, 'Food from the Heart', timestamptz '2026-06-05 13:00:00+08'),
    (pg_temp.demo_uuid('curated-route-008-food-pack'), 'out_for_delivery', 3, 'Food from the Heart', timestamptz '2026-06-05 15:30:00+08'),
    (pg_temp.demo_uuid('curated-route-008-food-pack'), 'completed', 4, 'Food from the Heart', timestamptz '2026-06-05 17:20:00+08')
) as checkpoint(route_id, stage, step_order, actor_name, completed_at);

insert into public.schedule_assignments (
  id,
  task_id,
  workspace_id,
  assignee_name,
  scheduled_for,
  status,
  rescheduled_from,
  notes,
  created_at,
  updated_at
)
values
  (
    pg_temp.demo_uuid('curated-schedule-004'),
    pg_temp.demo_uuid('curated-task-004'),
    'allkin-aac-amk',
    'Aisha Rahman',
    timestamptz '2026-06-10 10:30:00+08',
    'Rescheduled'::public.schedule_status,
    timestamptz '2026-06-09 15:30:00+08',
    'Confirm welfare check outcome with caregiver.',
    timestamptz '2026-06-10 18:45:00+08',
    timestamptz '2026-06-10 18:45:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-schedule-005'),
    pg_temp.demo_uuid('curated-task-005'),
    'touch-medical-escort-transport',
    'Nora Lim',
    timestamptz '2026-06-11 13:00:00+08',
    'Scheduled'::public.schedule_status,
    null,
    'Confirm transport readiness before dispatch.',
    timestamptz '2026-06-09 13:15:00+08',
    timestamptz '2026-06-09 13:15:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-schedule-006'),
    pg_temp.demo_uuid('curated-task-006'),
    'aic-link',
    'Grace Teo',
    timestamptz '2026-06-09 16:00:00+08',
    'Scheduled'::public.schedule_status,
    null,
    'Prepare care navigation notes before call.',
    timestamptz '2026-06-08 16:30:00+08',
    timestamptz '2026-06-08 16:30:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-schedule-007'),
    pg_temp.demo_uuid('curated-task-007'),
    'care-corner-aac-toa-payoh',
    'Mei Lin Chua',
    timestamptz '2026-06-10 14:30:00+08',
    'Scheduled'::public.schedule_status,
    null,
    'Backup centre accepted the welfare visit.',
    timestamptz '2026-06-08 12:15:00+08',
    timestamptz '2026-06-08 12:15:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-schedule-009'),
    pg_temp.demo_uuid('curated-task-009'),
    'touch-medical-escort-transport',
    'Wei Ming Tan',
    timestamptz '2026-06-06 09:15:00+08',
    'Completed'::public.schedule_status,
    null,
    'Completed with return trip.',
    timestamptz '2026-06-04 16:00:00+08',
    timestamptz '2026-06-06 12:10:00+08'
  );

update public.request_tasks t
set
  assigned_to = sa.assignee_name,
  scheduled_for = sa.scheduled_for,
  partner_notes = sa.notes
from public.schedule_assignments sa
where sa.task_id = t.id
  and t.session_id in (select session_id from demo_sessions);

insert into public.request_status_events (
  id,
  task_id,
  from_status,
  to_status,
  reason,
  notes,
  created_at
)
values
  (
    pg_temp.demo_uuid('curated-reroute-event-007'),
    pg_temp.demo_uuid('curated-task-007'),
    'Pending',
    'Pending',
    'Same-day home visit capacity full.',
    'rerouted_from:allkin-aac-amk;rerouted_to:care-corner-aac-toa-payoh',
    timestamptz '2026-06-08 11:35:00+08'
  ),
  (
    pg_temp.demo_uuid('curated-rejected-event-010'),
    pg_temp.demo_uuid('curated-task-010'),
    'Pending',
    'Rejected',
    'Needs urgent clinical triage before social-care navigation.',
    'Partner declined the request.',
    timestamptz '2026-06-03 10:25:00+08'
  );

do $$
declare
  task_record record;
  session_record record;
begin
  for task_record in
    select id
    from public.request_tasks
    where session_id in (select session_id from demo_sessions)
  loop
    perform public.refresh_task_status(task_record.id);
  end loop;

  for session_record in
    select id
    from public.request_sessions
    where id in (select session_id from demo_sessions)
  loop
    perform public.refresh_session_status(session_record.id);
  end loop;
end;
$$;

commit;

select
  count(*) as demo_account_sessions,
  min(created_at) as first_submission,
  max(created_at) as last_submission
from public.request_sessions
where created_by is null
  and email = 'demo@orca.sg';
