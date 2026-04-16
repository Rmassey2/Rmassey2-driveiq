import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import {
  buildMemphisRadiusTargeting,
  listAdSets,
  updateAdSetTargeting,
} from "@/lib/meta/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = svc();
  const userClient = createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campaignId =
    (body.campaign_id as string) || process.env.META_DEFAULT_CAMPAIGN_ID;
  if (!campaignId) {
    return NextResponse.json(
      { error: "campaign_id required" },
      { status: 400 }
    );
  }

  const targeting = buildMemphisRadiusTargeting({
    radiusMiles: (body.radius_miles as number) ?? 200,
    ageMin: (body.age_min as number) ?? 25,
    ageMax: (body.age_max as number) ?? 50,
    incomeMin: (body.income_min as number) ?? 30000,
    incomeMax: (body.income_max as number) ?? 75000,
  });

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();

  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 500 });
  }

  const dryRun = body.dry_run === true || !process.env.META_ACCESS_TOKEN;

  try {
    if (dryRun) {
      await supabase.from("meta_optimization_events").insert({
        org_id: org.id,
        campaign_id: campaignId,
        action: "dry_run_targeting_update",
        payload: { targeting } as Record<string, unknown>,
        success: true,
        result: { note: "No META_ACCESS_TOKEN configured or dry_run=true" },
        actor_user_id: user?.id ?? null,
      });
      return NextResponse.json({
        ok: true,
        dry_run: true,
        campaign_id: campaignId,
        targeting,
      });
    }

    const adSets = await listAdSets(campaignId);
    const results = await Promise.all(
      adSets.map(async (a) => {
        try {
          const r = await updateAdSetTargeting(a.id, targeting);
          return { adset_id: a.id, name: a.name, ok: true, result: r };
        } catch (e) {
          return {
            adset_id: a.id,
            name: a.name,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      })
    );

    const allOk = results.every((r) => r.ok);
    await supabase.from("meta_optimization_events").insert({
      org_id: org.id,
      campaign_id: campaignId,
      action: "update_targeting_memphis_200mi",
      payload: { targeting } as Record<string, unknown>,
      result: { adsets: results } as Record<string, unknown>,
      success: allOk,
      error: allOk ? null : "One or more ad sets failed to update",
      actor_user_id: user?.id ?? null,
    });

    // Mirror into autonomous_actions for the CMO activity feed.
    await supabase.from("autonomous_actions").insert({
      org_id: org.id,
      action_type: "meta_optimize_targeting",
      description: `Updated Meta campaign ${campaignId} targeting to Memphis + 200mi (age ${targeting.age_min}-${targeting.age_max})`,
      reasoning: `AI CMO Meta optimizer applied to ${results.length} ad set(s); ${results.filter((r) => r.ok).length} succeeded`,
      affected_record_id: campaignId,
      affected_table: "meta_campaigns",
    });

    return NextResponse.json({
      ok: allOk,
      campaign_id: campaignId,
      targeting,
      adsets: results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Optimization failed";
    await supabase.from("meta_optimization_events").insert({
      org_id: org.id,
      campaign_id: campaignId,
      action: "update_targeting_memphis_200mi",
      payload: { targeting } as Record<string, unknown>,
      success: false,
      error: msg,
      actor_user_id: user?.id ?? null,
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
