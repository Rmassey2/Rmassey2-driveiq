-- Inbound-call tracking for the Twilio 901 number wired to /apply and /apply-oo.
-- Every time a driver dials the tracked number, Twilio hits our voice webhook,
-- which inserts a row here and returns TwiML forwarding the call to Jacob.
-- Closes the "phone-call conversion blind spot" — see memory `phone-call-conversion-blind-spot`.
-- Apply in the Supabase SQL editor.

create table if not exists inbound_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  caller_phone text not null,
  called_number text not null,
  twilio_call_sid text unique,
  matched_lead_id uuid references driver_leads(id) on delete set null,
  call_status text,
  duration_seconds int,
  forwarded_to text,
  occurred_at timestamptz not null default now()
);

create index if not exists inbound_calls_org_time_idx
  on inbound_calls(org_id, occurred_at desc);
create index if not exists inbound_calls_caller_phone_idx
  on inbound_calls(caller_phone, occurred_at desc);
create index if not exists inbound_calls_matched_lead_idx
  on inbound_calls(matched_lead_id, occurred_at desc);

alter table inbound_calls enable row level security;

drop policy if exists inbound_calls_read on inbound_calls;
create policy inbound_calls_read on inbound_calls for select
  using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

-- Rolling 14-day aggregate the AI CMO optimizer will read so it stops treating
-- FB spend as "zero conversions" when in reality calls are happening.
create or replace view v_inbound_calls_last_14d as
select
  org_id,
  count(*)                                                              as total_calls,
  count(*) filter (where matched_lead_id is not null)                    as matched_to_existing_lead,
  count(*) filter (where matched_lead_id is null)                        as unmatched_new_callers,
  coalesce(round(avg(duration_seconds))::int, 0)                        as avg_duration_seconds,
  count(*) filter (where call_status = 'completed')                      as completed_calls,
  count(*) filter (where call_status in ('no-answer','busy','failed'))   as missed_calls
from inbound_calls
where occurred_at >= now() - interval '14 days'
group by org_id;
