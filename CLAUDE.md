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
- Production URL: https://driveiq-virid.vercel.app

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
6. **/apply and /apply-oo** — native landing pages with UTM capture

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
- Must sync back to Tenstreet (manual for now)
- Requires typing CONFIRM in UI before saving

### Contact Later Rules
- Jacob sets a follow-up date and reason (e.g. "Under 2yr experience")
- Daily cron at 7am resurfaces drivers whose contact_later_date has arrived
- Enrolled in Contact Later Newsletter drip (every 6 weeks)
- Newsletter content types: driver milestones, freight news, Maco culture

### Lead Deletion (Permanent)
- Delete Lead button lives in the slide-over panel (Details tab) and on the lead detail page
- Requires typing DELETE in a confirmation modal before the action enables
- DELETE /api/leads/[id] removes associated child rows first (call_log, pipeline_events, drip_sends, drip_enrollments, review_requests, hired_drivers)
- Every permanent delete is logged to autonomous_actions as `lead_hard_delete` for audit
- Not the same as archive — archive keeps the record and flips disposition; delete is irreversible
- Pipeline table does NOT expose delete directly; must open the lead first

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
- /api/cron/retention-check — daily 8am (risk scoring + alerts)
- /api/cron/review-requests — daily 9am (Day 30 Google, Day 45 Facebook)
- /api/cron/cmo-report — monthly 1st at 6am (Claude AI executive summary)
- /api/cron/competitive-intel — every 48h at 10am (Claude competitive scan)

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
- **Session 5 (April 2026)** — Lead deletion flow (DELETE endpoint, confirmation modal in slide-over and detail page, autonomous_actions audit logging), Meta Ads API campaign optimizer, Vercel production deployment hardening

### Known Limitations / Future Work
- **Tenstreet API** — CSV import only currently; direct API integration planned for Phase 2
- **Facebook auto-publish** — manual copy-paste from Content Calendar currently; Meta API auto-publish planned
- **Google review tracking** — review requests sent via SMS but open/click/submit tracking is manual
- **Meta Ads API** — live campaign management (budget, targeting, start/stop) not yet connected
- **A2P SMS upgrade** — Twilio A2P 10DLC registration needed before going live with real driver SMS volume
- **Page-visit analytics** — source attribution and conversion funnel exist; raw page views not yet tracked
- **DAT API** — not yet integrated (see DAT Integration section below)

### Environment Variables Required
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, RESEND_API_KEY, RESEND_FROM_RECRUITING, RESEND_FROM_NEWSLETTER, RESEND_FROM_NAME, META_APP_ID, META_APP_SECRET, META_PAGE_ACCESS_TOKEN, META_PAGE_ID, META_AD_ACCOUNT_ID, ANTHROPIC_API_KEY, GOOGLE_REVIEW_LINK, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_ORG_SLUG, WEBFLOW_WEBHOOK_SECRET, CRON_SECRET, ADMIN_PHONE

Planned additions for DAT integration: DAT_API_KEY, DAT_API_SECRET, DAT_ACCOUNT_ID (names TBD based on DAT docs).

### How to Start Each Session
Open Claude Code in the driveiq project directory. Say which session you are working on. Claude Code will read this file and have full context without needing re-explanation.

### Build Commands
- npm run dev — local development
- npm run build — production build check
- npm run lint — lint check
- npx vercel --prod — deploy to production

### Standard Workflow After Code Changes
1. `npm run build` — fix any errors before continuing
2. `git add` specific files, commit with descriptive message, `git push`
3. Vercel auto-deploys on push to main (verify with `npx vercel ls`)
4. Restart `npm run dev` so the local server reflects changes

---

## Integrations

### Live and Working
- **Supabase** — Postgres + Auth + RLS. Service-role key used in server routes (svc() helper). Org slug is `maco-transport`.
- **Twilio** — SMS. `sendSMS(to, body)` in `lib/twilio.ts`. Numbers: toll-free +18664025201 (pending verification), local 901 +19015828745 (A2P 10DLC pending).
- **Resend** — Email via `RESEND_API_KEY`. Separate sender identities for recruiting and newsletter.
- **Claude API** — `claude-sonnet-4-20250514` for ad copy, content, CMO reports, review SMS personalization, competitive intel scans.
- **Webflow** — Form webhook posting to `/api/webhooks/webflow-lead`. JS embed on driveformaco.com.
- **Vercel** — GitHub-linked project `driveiq` (projectId `prj_Asqva2r2iFjrDfKtlMt99nVk5bDh`, org `team_hoRIBWq5Lo6AaWrhN8WD8cZR`). Cron jobs defined in `vercel.json`.

### Partial / Pending
- **Meta Ads API** — ad generator writes to `content_posts` and campaign records; live campaign push pending token + app review.
- **Tenstreet** — CSV import only. API rep follow-up pending.
- **Google Business Profile** — verification postcard pending; review links used in Day-30 flow.

---

## Facebook Campaigns Status

Last snapshot: early April 2026. Confirm current state in Meta Ads Manager before making decisions.

- **Company Drivers - Traffic - Apr2026** — ACTIVE. Traffic objective, UTM-tagged, points to `/apply`. Funded by Visa ending 9164 and $100 prepaid balance.
- **Company Drivers v1** — should be OFF (had rejected-ad error). Verify it is disabled.
- **Owner Operators** — still running as a Lead Form campaign. Plan is to duplicate the Company Drivers Traffic setup pointing to `/apply-oo`, UTM tagged.
- **Company Drivers (old)** — OFF.

### UTM Convention
All paid traffic to `/apply` and `/apply-oo` should carry `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` so the Source Attribution dashboard (`/dashboard/reports`) can credit conversions correctly.

---

## Current Status — April 20, 2026

### What's Live and Working
- DriveIQ app live at https://driveiq-virid.vercel.app
- Lead pipeline, retention dashboard, AI CMO inbox, content calendar, review requests, source attribution, monthly CMO report — all shipped
- 189+ leads in pipeline (186 from Tenstreet import + test leads + organic Webflow/landing traffic)
- 53 active drivers in retention engine
- `/apply` and `/apply-oo` landing pages live with UTM capture
- Facebook Traffic campaign live pointing to `/apply`
- Webflow webhook wired on driveformaco.com
- Lead scoring, duplicate detection, DNH blocking, permanent delete flow all working
- Drip messages loaded with Tenstreet apply link in first message
- Vercel auto-deploys on push to main; deployment protection disabled (public access)
- Billing configured in Meta Ads

### Twilio Status (SMS not yet sending)
- Toll-free +18664025201: Verification submitted — pending approval (1-5 days from early April)
- Local 901 +19015828745: A2P 10DLC campaign submitted — pending approval (2-3 weeks from early April)
- Business Profile approved by Twilio Trust Hub (Bundle SID: BUa346d24bc3b93fe44c16941b13fc17b3)
- SMS will fire automatically when either number is approved — no code changes required
- First drip message includes Tenstreet apply link

### Pending / In Progress
- Twilio toll-free verification (check twilio.com > Phone Numbers > 866 number > Regulatory Information)
- Twilio A2P campaign (check twilio.com > Messaging > Regulatory Compliance > A2P Messaging)
- Owner Operators Facebook Traffic campaign (duplicate Company Drivers campaign, point to `/apply-oo`)
- getloaded.net Apply Now buttons still broken (need Webflow access to fix)
- Active driver hire dates all show 3/25/2026 — need real hire dates
- Active driver segments mostly blank — need to be filled in
- Google Business Profile verification — postcard in mail
- Tenstreet API — waiting on rep response
- UTM tags on Owner Operators Facebook campaign — not yet applied
- Privacy policy page needed for long-term Twilio compliance
- Page-visit analytics dashboard — source attribution exists, raw page views do not

### Known Issues / Limitations
- driveformaco.com Webflow form not reliably sending to DriveIQ webhook (JS embed in place but Webflow Basic plan limitations)
- No privacy policy page yet (using driveformaco.com as placeholder URL in Twilio)
- All 53 active drivers have hire date of 3/25/2026 instead of real hire dates
- Test Driver record in hired_drivers needs to be deleted

---

## DAT API Integration (Planned)

DAT Freight & Analytics provides load board data, rate benchmarks, and lane analytics via the DAT ONE API. For DriveIQ the intended use cases are recruiter-facing:

### Target Use Cases
1. **Driver Pay Transparency in Drip Messages** — pull current average rates for Maco's primary lanes (e.g. MEM→ATL, MEM→DAL) and surface them in OTR/Regional recruiting SMS and landing page copy ("drivers on this lane are earning $X/mile this week").
2. **Segment-Aware Messaging** — match the driver's interest segment (OTR / Regional / Local / Owner-Op) to a curated lane set and pull real rates when the drip fires.
3. **Owner-Operator Lane Intelligence** — on `/apply-oo`, show live rate ranges for top Maco lanes to attract quality owner-ops.
4. **Recruiter Talking Points** — expose a "Lane Rate Today" card inside the lead detail view so Jacob can quote real numbers on live calls.
5. **Competitive Intel Feed** — feed DAT data into the existing `competitive_intel` table for the Claude AI competitive scanner.

### Implementation Sketch
- New module `lib/dat.ts` wrapping DAT API calls (auth, rate query, lane search).
- New env vars: `DAT_API_KEY`, `DAT_API_SECRET`, `DAT_ACCOUNT_ID` (names TBD against DAT docs).
- Caching layer — DAT API calls are metered; cache responses in Supabase table `dat_rate_cache` with TTL (e.g. 6h) keyed by origin/destination/equipment.
- New cron `/api/cron/dat-refresh` — pull rates for top N Maco lanes once per day, populate cache.
- Expose cached data via `/api/dat/rates?origin=&dest=&equipment=` for drip messages, landing pages, and the recruiter UI.
- Audit DAT calls through `autonomous_actions` (action_type `dat_rate_query`) for cost tracking.

### Open Questions Before Starting
- Which DAT product tier does Maco already have (DAT ONE, Truckload, Power, RateView)?
- Do we have API access credentials, or do we need to request them from a DAT rep?
- Allowed call volume on the current plan — informs cache TTL and cron frequency.
- Whether to expose rates to public landing pages or keep them behind auth (contractual restrictions may apply).

---

## Next Session Priorities
1. Confirm Twilio approval and test SMS end to end
2. Create Owner Operators Traffic campaign in Facebook and point it to `/apply-oo`
3. Disable / delete Company Drivers v1 (rejected-ad error)
4. Update real hire dates for the 53 active drivers
5. Fix getloaded.net Apply buttons when Webflow access is available
6. (Optional) point driveformaco.com at DriveIQ `/apply` instead of the Webflow form
7. Kick off DAT API integration — confirm account tier, request credentials, build `lib/dat.ts` and the `dat_rate_cache` table
8. Privacy policy page for long-term Twilio compliance
9. Decide on page-visit analytics approach (custom Supabase table vs Vercel Analytics)
