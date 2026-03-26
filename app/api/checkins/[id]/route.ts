import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = svc();
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = svc();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.completed_at !== undefined) updateData.completed_at = body.completed_at;
  if (body.conducted_by !== undefined) updateData.conducted_by = body.conducted_by;
  if (body.score_overall !== undefined) updateData.score_overall = body.score_overall;
  if (body.score_pay !== undefined) updateData.score_pay = body.score_pay;
  if (body.score_home_time !== undefined) updateData.score_home_time = body.score_home_time;
  if (body.score_equipment !== undefined) updateData.score_equipment = body.score_equipment;
  if (body.score_dispatch !== undefined) updateData.score_dispatch = body.score_dispatch;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.flags_raised !== undefined) updateData.flags_raised = body.flags_raised;
  if (body.missed !== undefined) updateData.missed = body.missed;

  const { data, error } = await supabase
    .from("checkins")
    .update(updateData)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    console.error("Update checkin error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Auto-create retention flags for low scores (2 or below)
  if (data) {
    const checkin = data;
    const driverId = checkin.driver_id as string;
    const orgId = checkin.org_id as string;

    const lowScores: { field: string; trigger: string }[] = [
      { field: "score_pay", trigger: "pay_satisfaction_low" },
      { field: "score_home_time", trigger: "no_home_time" },
      { field: "score_equipment", trigger: "equipment_breakdown" },
      { field: "score_dispatch", trigger: "dispatch_complaints" },
    ];

    const triggerPoints: Record<string, number> = {
      pay_satisfaction_low: 2,
      no_home_time: 3,
      equipment_breakdown: 2,
      dispatch_complaints: 2,
    };

    for (const { field, trigger } of lowScores) {
      const val = body[field] as number | undefined;
      if (val !== undefined && val <= 2) {
        await supabase.from("retention_flags").insert({
          org_id: orgId,
          driver_id: driverId,
          trigger_type: trigger,
          risk_points: triggerPoints[trigger],
          alert_level: "yellow",
          notes: `Auto-flagged from check-in: ${field} scored ${val}`,
        });
      }
    }

    // Missed checkin flag
    if (body.missed === true) {
      await supabase.from("retention_flags").insert({
        org_id: orgId,
        driver_id: driverId,
        trigger_type: "missed_checkin",
        risk_points: 1,
        alert_level: "yellow",
        notes: `Missed ${checkin.checkin_type} check-in`,
      });
    }
  }

  return NextResponse.json(data);
}
