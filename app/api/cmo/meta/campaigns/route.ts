import { NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { getCampaignInsights, listCampaigns } from "@/lib/meta/client";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.META_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "META_ACCESS_TOKEN not configured", campaigns: [] },
      { status: 200 }
    );
  }

  try {
    const campaigns = await listCampaigns();
    const withInsights = await Promise.all(
      campaigns.map(async (c) => {
        try {
          const insights = await getCampaignInsights(c.id, "last_30d");
          return { ...c, insights };
        } catch {
          return { ...c, insights: null };
        }
      })
    );

    // Persist a snapshot for each campaign we managed to pull insights for.
    const supabase = svc();
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "maco-transport")
      .single();

    if (org) {
      const rows = withInsights
        .filter((c) => c.insights)
        .map((c) => ({
          org_id: org.id,
          campaign_id: c.id,
          campaign_name: c.name,
          impressions: num(c.insights?.impressions),
          clicks: num(c.insights?.clicks),
          spend: numF(c.insights?.spend),
          ctr: numF(c.insights?.ctr),
          cpc: numF(c.insights?.cpc),
          reach: num(c.insights?.reach),
          raw: c.insights as Record<string, unknown> | null,
        }));
      if (rows.length) {
        await supabase.from("meta_campaign_snapshots").insert(rows);
      }
    }

    return NextResponse.json({ campaigns: withInsights });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Meta API request failed";
    return NextResponse.json({ error: msg, campaigns: [] }, { status: 502 });
  }
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function numF(v: string | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
