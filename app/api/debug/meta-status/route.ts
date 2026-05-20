import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Read-only diagnostic for Meta campaign / ad set / ad delivery health.
// CRON_SECRET protected; safe to leave but should be removed once the active
// FB-WebView investigation is closed.

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

interface CampaignRow {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  configured_status?: string;
  objective?: string;
  daily_budget?: string;
  budget_remaining?: string;
  issues_info?: unknown;
}

interface AdSetRow {
  id: string;
  name?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  budget_remaining?: string;
  issues_info?: unknown;
  recommendations?: unknown;
}

interface AdRow {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  ad_review_feedback?: unknown;
  issues_info?: unknown;
  recommendations?: unknown;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!adAccountId) {
    return NextResponse.json({ error: "META_AD_ACCOUNT_ID missing" }, { status: 500 });
  }
  if (!process.env.META_ACCESS_TOKEN) {
    return NextResponse.json({ error: "META_ACCESS_TOKEN missing" }, { status: 500 });
  }

  // Account-level status + any disable_reason / spend cap / funding
  const account = (await fbGet(adAccountId, {
    fields:
      "id,name,account_status,disable_reason,spend_cap,amount_spent,balance,currency,timezone_name,funding_source_details,capabilities",
  })) as Record<string, unknown>;

  // Campaigns + delivery / issue surface
  const campaignsRes = (await fbGet(`${adAccountId}/campaigns`, {
    fields:
      "id,name,status,effective_status,configured_status,objective,daily_budget,budget_remaining,issues_info,recommendations",
    limit: "50",
  })) as { data?: CampaignRow[] };

  const campaigns = campaignsRes.data ?? [];
  const results: Array<{
    campaign: CampaignRow;
    adsets: AdSetRow[];
    ads: AdRow[];
  }> = [];

  for (const c of campaigns) {
    const adsetsRes = (await fbGet(`${c.id}/adsets`, {
      fields:
        "id,name,campaign_id,status,effective_status,daily_budget,budget_remaining,issues_info,recommendations",
      limit: "25",
    })) as { data?: AdSetRow[] };

    const adsRes = (await fbGet(`${c.id}/ads`, {
      fields: "id,name,status,effective_status,ad_review_feedback,issues_info,recommendations",
      limit: "25",
    })) as { data?: AdRow[] };

    results.push({
      campaign: c,
      adsets: adsetsRes.data ?? [],
      ads: adsRes.data ?? [],
    });
  }

  return NextResponse.json({
    ad_account_id: adAccountId,
    account,
    campaign_count: campaigns.length,
    campaigns: results,
  });
}

// One-off action handler — accepts JSON {action, ...args}. Supports:
//   - {action:"pause_campaign", campaign_id:"..."}
//   - {action:"pause_adset",    adset_id:"..."}
//   - {action:"set_adset_budget_dollars", adset_id:"...", dollars: 5}
//   - {action:"set_campaign_budget_dollars", campaign_id:"...", dollars: 5}
// CRON_SECRET protected. Calls log to autonomous_actions for audit.
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

  const action = String(body.action ?? "");

  let result: unknown;
  let target = "";

  if (action === "pause_campaign") {
    const id = String(body.campaign_id ?? "");
    if (!id) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
    target = id;
    result = await fbPost(id, { status: "PAUSED" });
  } else if (action === "pause_adset") {
    const id = String(body.adset_id ?? "");
    if (!id) return NextResponse.json({ error: "adset_id required" }, { status: 400 });
    target = id;
    result = await fbPost(id, { status: "PAUSED" });
  } else if (action === "set_adset_budget_dollars") {
    const id = String(body.adset_id ?? "");
    const dollars = Number(body.dollars);
    if (!id) return NextResponse.json({ error: "adset_id required" }, { status: 400 });
    if (!Number.isFinite(dollars) || dollars <= 0) {
      return NextResponse.json({ error: "dollars must be a positive number" }, { status: 400 });
    }
    target = id;
    const cents = Math.round(dollars * 100);
    result = await fbPost(id, { daily_budget: String(cents) });
  } else if (action === "set_campaign_budget_dollars") {
    const id = String(body.campaign_id ?? "");
    const dollars = Number(body.dollars);
    if (!id) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
    if (!Number.isFinite(dollars) || dollars <= 0) {
      return NextResponse.json({ error: "dollars must be a positive number" }, { status: 400 });
    }
    target = id;
    const cents = Math.round(dollars * 100);
    result = await fbPost(id, { daily_budget: String(cents) });
  } else {
    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true, action, target, result });
}
