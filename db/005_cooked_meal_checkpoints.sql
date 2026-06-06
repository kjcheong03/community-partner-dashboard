-- Add cooked-meal fulfilment checkpoint stages.
-- Run once if db/004_route_fulfilment_checkpoints.sql was already applied.

begin;

alter type public.route_checkpoint_stage add value if not exists 'meal_plan_confirmed';
alter type public.route_checkpoint_stage add value if not exists 'meal_preparing';

update public.request_routes r
set lifecycle = 'Completed'::public.request_status
where r.label = 'Cooked meals'
  and r.lifecycle is distinct from 'Completed'::public.request_status
  and exists (
    select 1
    from public.request_route_checkpoints c
    where c.route_id = r.id
      and c.stage::text = 'meal_preparing'
  );

commit;
