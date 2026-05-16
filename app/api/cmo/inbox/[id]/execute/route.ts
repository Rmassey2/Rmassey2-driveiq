import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import {
  listCampaignAdSets,
  pauseAdSet,
  pauseCampaign,
  updateAdSetDailyBudgetDollars,
  updateCampaignDailyBudgetDollars,
} from "@/lib/meta/client";

export const dynamic = "force-dynamic";

// Approve & Execute for meta_optimization inbox items.
//
// Reads the recommendation's meta payload and applies the action directly via
// the Meta Graph API. Only meta_optimization items with executable action
// types (pause_adset, pause_campaign, shift_budget) are dispatched; everything
// else returns manual_action_required so the admin knows to apply it by hand.

interface ExecuteResult {
  ok: boolean;
  executed: boolean;
  action_type: string;
  detail: string;
  meta_result?: unknown;
  manual_action_required?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = svc();
  const userClient = createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: item, error: itemErr } = await supabase
    .from("cmo_inbox_items")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (itemErr || !item) {
    return NextResponse.json({ ok: false, error: "Inbox item not found" }, { status: 404 });
  }

  if (item.item_type !== "meta_optimization") {
    return NextResponse.json(
      { ok: false, error: `Execute only supported for meta_optimization items (got ${item.item_type})` },
      { status: 400 }
    );
  }

  const dataPoints = (item.data_points as Record<string, unknown> | null) ?? {};
  const action_type = String(dataPoints.action_type ?? "other");
  const campaign_id = typeof dataPoints.campaign_id === "string" ? dataPoints.campaign_id : null;
  const adset_id = typeof dataPoints.adset_id === "string" ? dataPoints.adset_id : null;
  const budgetRaw = dataPoints.proposed_daily_budget_dollars;
  const proposed_daily_budget_dollars =
    typeof budgetRaw === "number" && Number.isFinite(budgetRaw) ? budgetRaw : null;

  const executable = new Set(["pause_adset", "pause_campaign", "shift_budget"]);
  if (!executable.has(action_type)) {
    await markApprovedManual(supabase, item.id, action_type, "Action type requires manual application in Ads Manager.");
    return NextResponse.json<ExecuteResult>({
      ok: true,
      executed: false,
      action_type,
      detail: `${action_type} is a manual action — marked approved for your reference.`,
      manual_action_required: true,
    });
  }

  if (!process.env.META_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        error: "META_ACCESS_TOKEN not configured in Vercel. Apply manually in Ads Manager and click Approve.",
      },
      { status: 400 }
    );
  }

  let result: ExecuteResult;
  try {
    if (action_type === "pause_adset") {
      if (!adset_id && !campaign_id) {
        throw new Error("Recommendation is missing both adset_id and campaign_id; cannot pause anything.");
      }
      if (adset_id) {
        const r = await pauseAdSet(adset_id);
        result = { ok: true, executed: true, action_type, detail: `Paused ad set ${adset_id}`, meta_result: r };
      } else {
        // Fall back to pausing all ad sets under the campaign.
        const adSets = await listCampaignAdSets(campaign_id!);
        const paused: { id: string; ok: boolean; error?: string }[] = [];
        for (const a of adSets) {
          try {
            await pauseAdSet(a.id);
            paused.push({ id: a.id, ok: true });
          } catch (e) {
            paused.push({ id: a.id, ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        }
        const okCount = paused.filter((p) => p.ok).length;
        result = {
          ok: okCount > 0,
          executed: okCount > 0,
          action_type,
          detail: `Paused ${okCount}/${paused.length} ad sets under campaign ${campaign_id}`,
          meta_result: paused,
        };
      }
    } else if (action_type === "pause_campaign") {
      if (!campaign_id) throw new Error("Recommendation is missing campaign_id.");
      const r = await pauseCampaign(campaign_id);
      result = { ok: true, executed: true, action_type, detail: `Paused campaign ${campaign_id}`, meta_result: r };
    } else if (action_type === "shift_budget") {
      if (proposed_daily_budget_dollars === null) {
        throw new Error("Recommendation is missing proposed_daily_budget_dollars.");
      }
      if (adset_id) {
        const r = await updateAdSetDailyBudgetDollars(adset_id, proposed_daily_budget_dollars);
        result = {
          ok: true,
          executed: true,
          action_type,
          detail: `Set ad set ${adset_id} daily budget to $${proposed_daily_budget_dollars}`,
          meta_result: r,
        };
      } else if (campaign_id) {
        const r = await updateCampaignDailyBudgetDollars(campaign_id, proposed_daily_budget_dollars);
        result = {
          ok: true,
          executed: true,
          action_type,
          detail: `Set campaign ${campaign_id} daily budget to $${proposed_daily_budget_dollars}`,
          meta_result: r,
        };
      } else {
        throw new Error("shift_budget requires either adset_id or campaign_id.");
      }
    } else {
      throw new Error(`Unhandled action_type ${action_type}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logEvent(supabase, item.org_id, {
      campaign_id,
      adset_id,
      action: `inbox_execute_${action_type}`,
      payload: { data_points: dataPoints },
      success: false,
      error: msg,
      actor_user_id: user.id,
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  // Persist success
  await logEvent(supabase, item.org_id, {
    campaign_id,
    adset_id,
    action: `inbox_execute_${action_type}`,
    payload: { data_points: dataPoints },
    result: { detail: result.detail, meta_result: result.meta_result } as Record<string, unknown>,
    success: true,
    actor_user_id: user.id,
  });

  await supabase.from("autonomous_actions").insert({
    org_id: item.org_id,
    action_type: `meta_${action_type}`,
    description: result.detail,
    reasoning: `Admin approved inbox item ${item.id}: ${item.title}`,
    affected_record_id: campaign_id ?? adset_id ?? item.id,
    affected_table: "meta_campaigns",
  });

  await supabase
    .from("cmo_inbox_items")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      data_points: {
        ...dataPoints,
        executed_at: new Date().toISOString(),
        executed_by: user.id,
        execution_detail: result.detail,
      } as Record<string, unknown>,
    })
    .eq("id", item.id);

  return NextResponse.json(result);
}

async function markApprovedManual(
  supabase: ReturnType<typeof svc>,
  itemId: string,
  action_type: string,
  note: string
) {
  await supabase
    .from("cmo_inbox_items")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      data_points: { manual_action_required: true, action_type, note } as Record<string, unknown>,
    })
    .eq("id", itemId);
}

async function logEvent(
  supabase: ReturnType<typeof svc>,
  orgId: string,
  row: {
    campaign_id: string | null;
    adset_id: string | null;
    action: string;
    payload: Record<string, unknown>;
    result?: Record<string, unknown>;
    success: boolean;
    error?: string;
    actor_user_id: string;
  }
) {
  await supabase.from("meta_optimization_events").insert({
    org_id: orgId,
    campaign_id: row.campaign_id,
    adset_id: row.adset_id,
    action: row.action,
    payload: row.payload,
    result: row.result ?? null,
    success: row.success,
    error: row.error ?? null,
    actor_user_id: row.actor_user_id,
  });
}
