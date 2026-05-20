import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-off READ-ONLY diagnostic to dump Meta ad-set targeting + placement so
// we can verify the audience and rule out the Audience Network theory.
// CRON_SECRET protected. Remove after the audit closes.

const GRAPH_BASE = "https://graph.facebook.com";

function v() {
  return process.env.META_GRAPH_API_VERSION || "v19.0";
}

async function fbGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN missing");
  const url = new URL(`${GRAPH_BASE}/${v()}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", token);
  for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (!res.ok) return { error: json.error ?? json, http_status: res.status };
    return json;
  } catch {
    return { error: text, http_status: res.status };
  }
}

async function fbPost(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN missing");
  const url = new URL(`${GRAPH_BASE}/${v()}/${path.replace(/^\//, "")}`);
  const form = new URLSearchParams();
  form.set("access_token", token);
  for (const [k, val] of Object.entries(params)) form.set(k, val);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (!res.ok) return { error: json.error ?? json, http_status: res.status };
    return json;
  } catch {
    return { error: text, http_status: res.status };
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!adAccountId) return NextResponse.json({ error: "META_AD_ACCOUNT_ID missing" }, { status: 500 });
  if (!process.env.META_ACCESS_TOKEN) return NextResponse.json({ error: "META_ACCESS_TOKEN missing" }, { status: 500 });

  const campaignsRes = (await fbGet(`${adAccountId}/campaigns`, {
    fields: "id,name,status,effective_status,objective",
    limit: "50",
  })) as { data?: Array<{ id: string; name?: string; status?: string; effective_status?: string; objective?: string }> };

  const campaigns = campaignsRes.data ?? [];
  const out: Array<{
    campaign: { id: string; name?: string; status?: string; effective_status?: string; objective?: string };
    adsets: Array<{
      id: string;
      name?: string;
      status?: string;
      effective_status?: string;
      daily_budget?: string;
      optimization_goal?: string;
      billing_event?: string;
      targeting?: unknown;
    }>;
  }> = [];

  for (const c of campaigns) {
    if (c.status !== "ACTIVE") continue; // only audit live campaigns
    const adsetsRes = (await fbGet(`${c.id}/adsets`, {
      fields:
        "id,name,status,effective_status,daily_budget,optimization_goal,billing_event,targeting",
      limit: "25",
    })) as {
      data?: Array<{
        id: string;
        name?: string;
        status?: string;
        effective_status?: string;
        daily_budget?: string;
        optimization_goal?: string;
        billing_event?: string;
        targeting?: unknown;
      }>;
    };
    out.push({
      campaign: c,
      adsets: adsetsRes.data ?? [],
    });
  }

  return NextResponse.json({ ad_account_id: adAccountId, active_campaign_count: out.length, campaigns: out });
}

// POST { action: "tighten_targeting", adset_id, disable_advantage_audience?: bool,
//        restrict_to_feed_only?: bool }
// Fetches current targeting, mutates only the requested fields, posts back full
// object (Meta replaces the targeting wholesale). Preserves geo, age,
// flexible_spec, etc.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.META_ACCESS_TOKEN) {
    return NextResponse.json({ error: "META_ACCESS_TOKEN missing" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (body.action !== "tighten_targeting") {
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  }
  const adset_id = String(body.adset_id ?? "");
  if (!adset_id) return NextResponse.json({ error: "adset_id required" }, { status: 400 });

  const disableAdvantage = body.disable_advantage_audience === true;
  const restrictToFeed = body.restrict_to_feed_only === true;
  if (!disableAdvantage && !restrictToFeed) {
    return NextResponse.json({ error: "no changes requested" }, { status: 400 });
  }

  // Pull the current targeting so we can preserve everything else.
  const before = (await fbGet(adset_id, { fields: "id,name,targeting" })) as {
    id?: string;
    name?: string;
    targeting?: Record<string, unknown>;
    error?: unknown;
  };
  if (before.error || !before.targeting) {
    return NextResponse.json({ error: "failed to fetch current targeting", detail: before }, { status: 502 });
  }

  const targeting = { ...before.targeting } as Record<string, unknown>;
  const log: string[] = [];

  if (disableAdvantage) {
    const ta = (targeting.targeting_automation as Record<string, unknown> | undefined) ?? {};
    const next: Record<string, unknown> = { ...ta, advantage_audience: 0 };
    // Also remove the geo individual_setting so Meta doesn't expand the radius.
    if (next.individual_setting && typeof next.individual_setting === "object") {
      next.individual_setting = { ...(next.individual_setting as Record<string, unknown>), geo: 0 };
    }
    targeting.targeting_automation = next;
    log.push("set targeting_automation.advantage_audience=0");
    log.push("set targeting_automation.individual_setting.geo=0");
  }

  if (restrictToFeed) {
    targeting.publisher_platforms = ["facebook", "instagram"];
    targeting.facebook_positions = ["feed"];
    targeting.instagram_positions = ["stream"];
    // Wipe other position lists so they don't override platform restriction.
    delete targeting.audience_network_positions;
    delete targeting.messenger_positions;
    delete targeting.device_platforms;
    log.push("restricted publisher_platforms to facebook+instagram, positions to feed/stream");
  }

  const result = (await fbPost(adset_id, { targeting: JSON.stringify(targeting) })) as {
    success?: boolean;
    error?: unknown;
  };
  if (result.error) {
    return NextResponse.json({ error: "Meta API rejected update", detail: result }, { status: 502 });
  }

  // Re-fetch to confirm
  const after = (await fbGet(adset_id, { fields: "id,name,targeting" })) as {
    id?: string;
    name?: string;
    targeting?: Record<string, unknown>;
  };

  return NextResponse.json({
    ok: true,
    adset_id,
    adset_name: before.name,
    changes: log,
    targeting_after: after.targeting,
  });
}
