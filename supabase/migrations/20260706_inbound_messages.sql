-- Inbound SMS replies to the Twilio 901 number.
-- Twilio's Messaging Service still handles STOP/HELP/START compliance
-- automatically. This table captures every other reply (questions, "call me
-- back," etc) that used to be dropped by Twilio's demo endpoint.

create table if not exists inbound_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  from_phone text not null,
  to_phone text not null,
  body text,
  twilio_message_sid text unique,
  matched_lead_id uuid references driver_leads(id) on delete set null,
  forwarded_to_recruiter boolean not null default false,
  occurred_at timestamptz not null default now()
);

create index if not exists inbound_messages_org_time_idx
  on inbound_messages(org_id, occurred_at desc);
create index if not exists inbound_messages_from_phone_idx
  on inbound_messages(from_phone, occurred_at desc);
create index if not exists inbound_messages_matched_lead_idx
  on inbound_messages(matched_lead_id, occurred_at desc);

alter table inbound_messages enable row level security;

drop policy if exists inbound_messages_read on inbound_messages;
create policy inbound_messages_read on inbound_messages for select
  using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );
