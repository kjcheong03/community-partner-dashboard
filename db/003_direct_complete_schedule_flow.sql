-- Allow accepted work to be completed directly.
-- This matches the dashboard flow where scheduling is the operational progress
-- step and staff do not need a separate "start" click before completion.

begin;

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

commit;
