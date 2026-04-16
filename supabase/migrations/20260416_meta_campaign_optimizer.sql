-- Meta (Facebook) Ads campaign optimization logging
-- Apply in Supabase SQL editor.

create table if not exists meta_campaign_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  campaign_id text not null,
  campaign_name text,
  impressions integer,
  clicks integer,
  spend numeric(10,2),
  ctr numeric(6,4),
  cpc numeric(10,4),
  reach integer,
  targeting jsonb,
  raw jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists meta_campaign_snapshots_org_idx
  on meta_campaign_snapshots(org_id, captured_at desc);
create index if not exists meta_campaign_snapshots_campaign_idx
  on meta_campaign_snapshots(campaign_id, captured_at desc);

create table if not exists meta_optimization_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  campaign_id text,
  adset_id text,
  action text not null,
  payload jsonb,
  result jsonb,
  success boolean not null default false,
  error text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists meta_optimization_events_org_idx
  on meta_optimization_events(org_id, created_at desc);

alter table meta_campaign_snapshots enable row level security;
alter table meta_optimization_events enable row level security;

drop policy if exists meta_snap_read on meta_campaign_snapshots;
create policy meta_snap_read on meta_campaign_snapshots for select
  using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

drop policy if exists meta_opt_read on meta_optimization_events;
create policy meta_opt_read on meta_optimization_events for select
  using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );
