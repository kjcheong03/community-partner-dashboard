-- Add cooked-meal fulfilment checkpoint stages.
-- Run once if db/004_route_fulfilment_checkpoints.sql was already applied.

begin;

alter type public.route_checkpoint_stage add value if not exists 'meal_plan_confirmed';
alter type public.route_checkpoint_stage add value if not exists 'meal_preparing';

commit;
