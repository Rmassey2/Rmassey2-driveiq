import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { getCampaignInsights, listCampaigns } from "@/lib/meta/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily autonomous optimization pass.
//
// Pulls Meta spend/clicks/CTR (if META_ACCESS_TOKEN is configured), joins with
// our own landing-page funnel events and lead-creation data by UTM, and asks
// Claude for 2-3 specific recommendations. Each becomes a cmo_inbox_items row
// the admin can approve. The token is not required — without it we still
// surface funnel/conversion issues from our own data.

interface FunnelRow {
  utm_source: string;
  utm_campaign: string;
  utm_content: string;
  page_views: number;
  form_starts: number;
  form_submits: number;
  form_errors: number;
}

interface LeadAggRow {
  source_channel: string | null;
  source_campaign: string | null;
  utm_content: string | null;
  count: number;
}

interface MetaSnapshot {
  campaign_id: string;
  campaign_name: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  ctr: number | null;
  cpc: number | null;
  reach: number | null;
  age_days?: number;
}

interface Recommendation {
  action_type:
    | "pause_adset"
    | "shift_budget"
    | "refresh_creative"
    | "fix_landing_page"
    | "expand_targeting"
    | "other";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  campaign_id?: string;
  adset_id?: string;
  utm_content?: string;
  rationale?: string;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = svc();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 500 });
  }

  const metaSnapshots = await collectMetaSnapshots(supabase, org.id);
  const funnel = await collectFunnel(supabase);
  const leadsByUtm = await collectLeadsByUtm(supabase, org.id);
  const creativeAge = await collectCreativeAge(supabase, org.id);

  const dataset = buildDataset({
    metaSnapshots,
    funnel,
    leadsByUtm,
    creativeAge,
    hasMetaToken: !!process.env.META_ACCESS_TOKEN,
  });

  const recommendations = await askClaudeForRecommendations(dataset);

  let inserted = 0;
  for (const rec of recommendations) {
    const { error } = await supabase.from("cmo_inbox_items").insert({
      org_id: org.id,
      item_type: "meta_optimization",
      title: rec.title.slice(0, 240),
      description: rec.description.slice(0, 2000),
      priority: rec.priority,
      status: "pending",
      meta: {
        action_type: rec.action_type,
        campaign_id: rec.campaign_id ?? null,
        adset_id: rec.adset_id ?? null,
        utm_content: rec.utm_content ?? null,
        rationale: rec.rationale ?? null,
      } as Record<string, unknown>,
    });
    if (!error) inserted++;
  }

  await supabase.from("autonomous_actions").insert({
    org_id: org.id,
    action_type: "meta_optimize_run",
    description: `Meta optimizer drafted ${inserted} recommendation(s) — meta_token=${dataset.hasMetaToken ? "live" : "missing"}, campaigns=${metaSnapshots.length}, funnel_rows=${funnel.length}`,
    reasoning: dataset.summary,
  });

  return NextResponse.json({
    ok: true,
    has_meta_token: dataset.hasMetaToken,
    snapshots: metaSnapshots.length,
    funnel_rows: funnel.length,
    lead_groups: leadsByUtm.length,
    recommendations: inserted,
  });
}

async function collectMetaSnapshots(
  supabase: ReturnType<typeof svc>,
  orgId: string
): Promise<MetaSnapshot[]> {
  if (process.env.META_ACCESS_TOKEN) {
    try {
      const campaigns = await listCampaigns();
      const rows: MetaSnapshot[] = [];
      for (const c of campaigns) {
        try {
          const insights = await getCampaignInsights(c.id, "last_14d");
          if (!insights) continue;
          const snap: MetaSnapshot = {
            campaign_id: c.id,
            campaign_name: c.name ?? null,
            impressions: numI(insights.impressions),
            clicks: numI(insights.clicks),
            spend: numF(insights.spend),
            ctr: numF(insights.ctr),
            cpc: numF(insights.cpc),
            reach: numI(insights.reach),
          };
          rows.push(snap);
          await supabase.from("meta_campaign_snapshots").insert({
            org_id: orgId,
            campaign_id: c.id,
            campaign_name: c.name,
            impressions: snap.impressions,
            clicks: snap.clicks,
            spend: snap.spend,
            ctr: snap.ctr,
            cpc: snap.cpc,
            reach: snap.reach,
            raw: insights as unknown as Record<string, unknown>,
          });
        } catch (e) {
          console.warn(`[meta-optimize] insights failed for ${c.id}:`, e);
        }
      }
      return rows;
    } catch (e) {
      console.warn("[meta-optimize] live Meta fetch failed, falling back to last snapshot:", e);
    }
  }

  // Fallback: read the most recent snapshot per campaign so we still have
  // SOMETHING to feed the model when the token is missing or expired.
  const { data } = await supabase
    .from("meta_campaign_snapshots")
    .select("campaign_id, campaign_name, impressions, clicks, spend, ctr, cpc, reach, captured_at")
    .eq("org_id", orgId)
    .order("captured_at", { ascending: false })
    .limit(50);

  const seen = new Set<string>();
  const rows: MetaSnapshot[] = [];
  for (const r of data ?? []) {
    if (seen.has(r.campaign_id)) continue;
    seen.add(r.campaign_id);
    rows.push({
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      impressions: r.impressions,
      clicks: r.clicks,
      spend: r.spend,
      ctr: r.ctr,
      cpc: r.cpc,
      reach: r.reach,
    });
  }
  return rows;
}

async function collectFunnel(supabase: ReturnType<typeof svc>): Promise<FunnelRow[]> {
  const { data, error } = await supabase.from("v_landing_funnel").select("*");
  if (error) {
    console.warn("[meta-optimize] funnel view query failed:", error.message);
    return [];
  }
  return (data as FunnelRow[] | null) ?? [];
}

async function collectLeadsByUtm(
  supabase: ReturnType<typeof svc>,
  orgId: string
): Promise<LeadAggRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const { data } = await supabase
    .from("driver_leads")
    .select("source_channel, source_campaign, utm_content")
    .eq("org_id", orgId)
    .gte("created_at", cutoff.toISOString());

  const counts = new Map<string, LeadAggRow>();
  for (const lead of data ?? []) {
    const key = `${lead.source_channel ?? "null"}|${lead.source_campaign ?? "null"}|${lead.utm_content ?? "null"}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, {
        source_channel: lead.source_channel,
        source_campaign: lead.source_campaign,
        utm_content: lead.utm_content,
        count: 1,
      });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

async function collectCreativeAge(
  supabase: ReturnType<typeof svc>,
  orgId: string
): Promise<{ name: string; age_days: number; status: string }[]> {
  const { data } = await supabase
    .from("ai_campaigns")
    .select("name, status, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);

  const now = Date.now();
  return (data ?? []).map((c) => ({
    name: c.name as string,
    status: c.status as string,
    age_days: Math.floor((now - new Date(c.created_at as string).getTime()) / 86400000),
  }));
}

interface Dataset {
  hasMetaToken: boolean;
  metaSnapshots: MetaSnapshot[];
  funnel: FunnelRow[];
  leadsByUtm: LeadAggRow[];
  creativeAge: { name: string; age_days: number; status: string }[];
  summary: string;
}

function buildDataset(input: {
  hasMetaToken: boolean;
  metaSnapshots: MetaSnapshot[];
  funnel: FunnelRow[];
  leadsByUtm: LeadAggRow[];
  creativeAge: { name: string; age_days: number; status: string }[];
}): Dataset {
  const totalSpend = input.metaSnapshots.reduce((s, r) => s + (r.spend ?? 0), 0);
  const totalClicks = input.metaSnapshots.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const totalSubmits = input.funnel.reduce((s, r) => s + r.form_submits, 0);
  const totalLeads = input.leadsByUtm.reduce((s, r) => s + r.count, 0);

  const summary = `meta_token=${input.hasMetaToken ? "live" : "missing"}, spend_14d=$${totalSpend.toFixed(
    2
  )}, clicks_14d=${totalClicks}, form_submits_14d=${totalSubmits}, leads_14d=${totalLeads}`;

  return { ...input, summary };
}

async function askClaudeForRecommendations(
  dataset: Dataset
): Promise<Recommendation[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackRecommendations(dataset);

  const payload = {
    has_meta_token: dataset.hasMetaToken,
    summary: dataset.summary,
    meta_campaigns_last_14d: dataset.metaSnapshots,
    landing_funnel_last_30d: dataset.funnel,
    leads_created_last_14d_by_utm: dataset.leadsByUtm.slice(0, 25),
    creative_age: dataset.creativeAge,
  };

  const system = `You are the AI CMO for Maco Transport, a Memphis TN trucking company hiring CDL-A drivers. Your job: analyze Facebook ad spend, landing-page funnel data, and lead-creation data to surface 2-4 SPECIFIC, ACTIONABLE recommendations the admin can approve.

Constraints:
- Each recommendation must reference a concrete campaign, ad set, utm_content, or landing page — never generic advice.
- If a campaign has clicks but low form_submits, the bottleneck is the landing page, not spend. Recommend a landing-page fix.
- If a campaign has stale creative (>14 days) and falling CTR, recommend refresh.
- If a campaign has high spend but low leads, recommend a pause or budget cut.
- If a campaign has low spend but strong lead conversion, recommend a budget increase.
- Sort by priority: high > medium > low.
- Respond with valid JSON only — no markdown, no code fences, no preamble.`;

  const user = `Here is the dataset:
${JSON.stringify(payload, null, 2)}

Return JSON:
{"recommendations":[{"action_type":"pause_adset|shift_budget|refresh_creative|fix_landing_page|expand_targeting|other","priority":"high|medium|low","title":"short title under 80 chars","description":"2-3 sentence specific action including numbers","campaign_id":"if applicable","adset_id":"if applicable","utm_content":"if applicable","rationale":"why"}]}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.warn("[meta-optimize] Claude API error:", res.status);
      return fallbackRecommendations(dataset);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as { recommendations?: Recommendation[] };
    if (!Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
      return fallbackRecommendations(dataset);
    }
    return parsed.recommendations.filter(
      (r) => r && r.title && r.description && r.priority && r.action_type
    );
  } catch (e) {
    console.warn("[meta-optimize] Claude parse failed:", e);
    return fallbackRecommendations(dataset);
  }
}

function fallbackRecommendations(dataset: Dataset): Recommendation[] {
  const recs: Recommendation[] = [];

  // Landing-page funnel issue: high page_views, low form_submits.
  const worstFunnel = [...dataset.funnel]
    .filter((f) => f.page_views >= 20)
    .sort(
      (a, b) =>
        a.form_submits / Math.max(a.page_views, 1) -
        b.form_submits / Math.max(b.page_views, 1)
    )[0];
  if (worstFunnel) {
    const conv = worstFunnel.page_views
      ? Math.round((worstFunnel.form_submits / worstFunnel.page_views) * 100)
      : 0;
    if (conv < 5) {
      recs.push({
        action_type: "fix_landing_page",
        priority: "high",
        title: `Landing page converting at ${conv}% for ${worstFunnel.utm_campaign}/${worstFunnel.utm_content}`,
        description: `${worstFunnel.page_views} page views, ${worstFunnel.form_starts} form starts, only ${worstFunnel.form_submits} submits. Review copy, form length, and CTA on the page receiving this traffic.`,
        utm_content: worstFunnel.utm_content,
        rationale: "Conversion below 5% — fix the page before scaling spend.",
      });
    }
  }

  // Stale creative
  const stale = dataset.creativeAge.find((c) => c.status === "approved" && c.age_days > 14);
  if (stale) {
    recs.push({
      action_type: "refresh_creative",
      priority: "medium",
      title: `Refresh creative on "${stale.name}" (${stale.age_days} days old)`,
      description: `Approved creative "${stale.name}" has been running for ${stale.age_days} days. Generate a new variant in the Ad Studio to avoid creative fatigue.`,
      rationale: "Creative > 14 days typically drops CTR by 20-30%.",
    });
  }

  // High spend, no leads
  for (const m of dataset.metaSnapshots) {
    if ((m.spend ?? 0) >= 50 && (m.clicks ?? 0) > 10) {
      const leadsForCampaign = dataset.leadsByUtm.find(
        (l) => l.source_campaign && m.campaign_name?.toLowerCase().includes(l.source_campaign.toLowerCase())
      );
      if (!leadsForCampaign || leadsForCampaign.count === 0) {
        recs.push({
          action_type: "pause_adset",
          priority: "high",
          title: `Pause "${m.campaign_name}" — $${(m.spend ?? 0).toFixed(2)} spent, 0 leads`,
          description: `Campaign "${m.campaign_name}" has spent $${(m.spend ?? 0).toFixed(2)} with ${m.clicks ?? 0} clicks over 14 days but produced 0 leads. Pause the ad sets and review targeting + creative.`,
          campaign_id: m.campaign_id,
          rationale: "Spend > $50 with zero attributable leads.",
        });
        break;
      }
    }
  }

  if (recs.length === 0) {
    recs.push({
      action_type: "other",
      priority: "low",
      title: "Insufficient data for optimization",
      description: `Last 14 days: ${dataset.summary}. Once UTM-tagged ads have run for a week, recommendations will be more specific. Confirm /apply traffic is carrying utm_source, utm_campaign, and utm_content.`,
      rationale: "Bootstrap mode.",
    });
  }
  return recs;
}

function numI(v: string | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function numF(v: string | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
