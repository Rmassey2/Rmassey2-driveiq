-- Funnel-tracking events for /apply and /apply-oo landing pages.
-- Captures page_view, form_start, form_submit, form_error along with the
-- attribution context the AI CMO needs to compare click-through vs.
-- form-submit conversion per campaign / ad set / creative.
-- Apply in the Supabase SQL editor.

create table if not exists landing_page_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  session_id text not null,
  event_type text not null check (event_type in ('page_view','form_start','form_submit','form_error')),
  path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  user_agent text,
  ip_hash text,
  extras jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists landing_page_events_org_time_idx
  on landing_page_events(org_id, occurred_at desc);
create index if not exists landing_page_events_session_idx
  on landing_page_events(session_id, occurred_at);
create index if not exists landing_page_events_campaign_idx
  on landing_page_events(utm_campaign, utm_content, occurred_at desc);

alter table landing_page_events enable row level security;

drop policy if exists lpe_read on landing_page_events;
create policy lpe_read on landing_page_events for select
  using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

-- Aggregation view used by the funnel dashboard and the meta-optimize cron.
-- One row per (utm_source, utm_campaign, utm_content) over the last 30 days
-- with click → form_start → form_submit counts.
create or replace view v_landing_funnel as
with base as (
  select
    coalesce(utm_source, 'direct')   as utm_source,
    coalesce(utm_campaign, 'none')   as utm_campaign,
    coalesce(utm_content, 'none')    as utm_content,
    event_type,
    session_id,
    occurred_at
  from landing_page_events
  where occurred_at >= now() - interval '30 days'
)
select
  utm_source,
  utm_campaign,
  utm_content,
  count(distinct session_id) filter (where event_type = 'page_view')   as page_views,
  count(distinct session_id) filter (where event_type = 'form_start')  as form_starts,
  count(distinct session_id) filter (where event_type = 'form_submit') as form_submits,
  count(distinct session_id) filter (where event_type = 'form_error')  as form_errors
from base
group by utm_source, utm_campaign, utm_content;
