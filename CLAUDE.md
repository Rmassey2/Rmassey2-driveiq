# DriveIQ — Driver Recruiting & Retention CRM
## Maco Transport, LLC

### What This App Is
DriveIQ is a standalone driver recruiting and retention CRM built for Maco Transport, LLC. It is NOT connected to Bid Genie (freight intelligence) or LogiCRM (customer CRM — future product). It is a completely independent application.

### The Three Products (Do Not Confuse)
- **Bid Genie** (bidgenieai.com) — freight lane bidding and RFP intelligence. Already built. Separate repo.
- **DriveIQ** (this app) — driver recruiting, drip campaigns, retention engine, AI CMO. Built here.
- **LogiCRM** (future) — customer/shipper CRM that connects to Bid Genie. Not built yet.

### Tech Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (Postgres + Auth + RLS) — new project, separate from Bid Genie
- Vercel deployment — auto-deploys on push to main
- Twilio — SMS for drip campaigns and alerts
- Resend — email for drip campaigns and newsletter
- Claude API (claude-sonnet-4-20250514) — AI CMO features
- Meta API — Facebook ad management (Phase 2)
- Tenstreet — ATS system (CSV import Phase 1, API Phase 2)
- GitHub: Rmassey2/Rmassey2-driveiq

### Users & Roles
- **admin** (Randall Massey — rmassey@macotransport.com) — sees everything, approves AI CMO actions, controls budgets
- **recruiter** (Jacob — jacob@macotransport.com) — manages lead pipeline, logs calls, sets dispositions, sends Tenstreet links
- **safety** — read-only retention dashboard, auto-notified on DNH flags and Red alerts
- **dm** (Driver Manager) — retention dashboard for their assigned drivers only, Yellow/Red alerts

### Database — 22 Tables
organizations, org_members, driver_leads, pipeline_events, call_log, tenstreet_sync_log, hired_drivers, retention_flags, checkins, drip_campaigns, drip_messages, drip_enrollments, drip_sends, newsletter_content, review_requests, ai_campaigns, content_posts, cmo_inbox_items, autonomous_actions, cmo_reports, competitive_intel, source_analytics

### Key Views
- v_recruiter_queue — Jacob's daily queue sorted by score and urgency
- v_retention_dashboard — hired drivers sorted by retention risk score
- v_source_attribution — lead to hire conversion by channel

### Lead Entry Points
1. **driveformaco.com** (company drivers) — Webflow form → webhook → /api/webhooks/webflow-lead
2. **getloaded.net** (owner-operators) — same webhook setup, pending Webflow access
3. **Tenstreet direct** — CSV import via /dashboard/pipeline/import (admin only)
4. **Walk-in / phone call** — Quick Add modal on pipeline dashboard
5. **Referral** — unique link per driver, referral_driver_id tracked on lead record

### Lead Scoring (0-100)
- CDL-A = 25 pts
- 2+ years experience = 20 pts
- Referral = 5 pts
- Hazmat endorsement = 5 pts
- Score 70+ = Priority (call within 1 hour)

### Driver Dispositions
active | considering | contact_later | do_not_hire | hired | withdrew | archived

### Do Not Hire Rules
- Matched on CDL number (permanent identifier — drivers change phones/emails)
- Visible to all org members
- Auto-notifies Ops/Safety on set
- Kills drip and sets do_not_contact = true
- Requires admin override to reverse
- Must synced back to Tenstreet (manual for now)
- Requires typing CONFIRM in UI before saving

### Contact Later Rules
- Jacob sets a follow-up date and reason (e.g. "Under 2yr experience")
- Daily cron at 7am resurfaces drivers whose contact_later_date has arrived
- Enrolled in Contact Later Newsletter drip (every 6 weeks)
- Newsletter content types: driver milestones, freight news, Maco culture

### Drip Campaigns (7 total, seeded)
1. OTR Active Recruiting (6 messages over 16 days)
2. Regional Active Recruiting
3. Local Active Recruiting
4. Owner-Op Active Recruiting
5. Contact Later Newsletter (every 6 weeks)
6. Re-Engagement Sequence (3 messages over 14 days)
7. Quarterly Win-Back

### Cron Jobs (vercel.json)
- /api/cron/drip-send — every hour (sends pending drip messages)
- /api/cron/contact-later-check — daily 7am (resurfaces Contact Later leads)

### Maco Transport Context
- Asset-based trucking company, Memphis TN
- Landing pages: driveformaco.com (company drivers), getloaded.net (owner-operators)
- ATS: Tenstreet (system of record for full application, MVR/PSP, compliance)
- Pay: up to 61 cents/mile, minimum 2,500 miles/week
- Home time: weekends guaranteed (Regional/Local), bi-weekly (OTR)
- Equipment: new 2024 Freightliners
- Referral bonus: $500 per hire ($250 at first dispatch, $250 at 90 days)
- Segments: OTR | Regional | Local | Dedicated | Owner-Op
- Recruiter: Jacob (jacob@macotransport.com)
- Admin: Randall Massey (rmassey@macotransport.com)

### Sessions Completed
- **Session 1** — scaffold, auth, role-based dashboard shell, Randall and Jacob user accounts
- **Session 2** — Webflow webhook intake, lead scoring, Twilio SMS confirmation, drip enrollment, Jacob pipeline dashboard, Quick Add, slide-over detail panel, DNH flag, Contact Later, call log, drip engine cron, contact-later cron, Tenstreet CSV import, source attribution API
- **Session 3** — Retention dashboard, hired_drivers management, auto-hire flow (disposition→hired creates record + schedules check-ins), check-in scheduler (day 1/7/30/60/90/180/annual), 5-dimension satisfaction scoring, retention risk engine cron, Yellow/Red alert routing (SMS + email to DM and admin), flag management, exit interview form, separation flow with rehire eligibility
- **Session 4A** — AI CMO dashboard, CMO approval inbox with Approve/Edit/Dismiss, AI Ad Studio (Claude API ad generation, Facebook preview, campaign table), Content Calendar (weekly view, Generate Week, post management)
- **Session 4B** — Review request system (Day 30 Google, Day 45 Facebook, Claude-personalized SMS, autonomous action logging), source attribution dashboard (recharts bar chart, channel table, Facebook quality callout), monthly CMO report generator (Claude AI executive summary + 3 recommendations, HTML email to admin), competitive intel scanner (Claude AI every 48h, auto-creates inbox items), shared components (skeleton, empty-state, toast, error-boundary), dashboard home polish (priority leads, overdue check-ins, open flags, pending approvals, activity feed), sign out button, mobile responsive tables

### App Is Complete — All Sessions Done

### Known Limitations / Future Work
- **Tenstreet API** — CSV import only currently; direct API integration planned for Phase 2
- **Facebook auto-publish** — manual copy-paste from Content Calendar currently; Meta API auto-publish planned
- **Google review tracking** — review requests sent via SMS but open/click/submit tracking is manual
- **Meta Ads API** — live campaign management (budget, targeting, start/stop) not yet connected
- **A2P SMS upgrade** — Twilio A2P 10DLC registration needed before going live with real driver SMS volume

### Environment Variables Required
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, RESEND_API_KEY, RESEND_FROM_RECRUITING, RESEND_FROM_NEWSLETTER, RESEND_FROM_NAME, META_APP_ID, META_APP_SECRET, META_PAGE_ACCESS_TOKEN, META_PAGE_ID, META_AD_ACCOUNT_ID, ANTHROPIC_API_KEY, GOOGLE_REVIEW_LINK, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_ORG_SLUG, WEBFLOW_WEBHOOK_SECRET, CRON_SECRET, ADMIN_PHONE

### How to Start Each Session
Open Claude Code in the driveiq project directory. Say which session you are working on. Claude Code will read this file and have full context without needing re-explanation.

### Build Commands
- npm run dev — local development
- npm run build — production build check
- npm run lint — lint check
- npx vercel --prod — deploy to production
