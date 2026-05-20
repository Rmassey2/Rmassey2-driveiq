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
