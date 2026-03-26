import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function POST(
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

  const separationDate = (body.separation_date as string) ?? new Date().toISOString().split("T")[0];
  const departureReason = body.departure_reason as string;
  const departureNotes = (body.departure_notes as string) ?? null;
  const eligibleForRehire = body.eligible_for_rehire as boolean ?? false;

  // Get current hired driver
  const { data: hired } = await supabase
    .from("hired_drivers")
    .select("org_id, lead_id")
    .eq("id", params.id)
    .single();

  if (!hired) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Update hired_drivers
  const { error } = await supabase
    .from("hired_drivers")
    .update({
      status: "separated",
      separation_date: separationDate,
      departure_reason: departureReason,
      departure_notes: departureNotes,
      eligible_for_rehire: eligibleForRehire,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  // Save exit interview scores as a checkin
  const scores = body.scores as Record<string, number> | undefined;
  if (scores) {
    await supabase.from("checkins").insert({
      org_id: hired.org_id,
      driver_id: params.id,
      checkin_type: "exit_interview",
      scheduled_at: separationDate,
      completed_at: new Date().toISOString(),
      score_overall: scores.overall ?? null,
      score_pay: scores.pay ?? null,
      score_home_time: scores.home_time ?? null,
      score_equipment: scores.equipment ?? null,
      score_dispatch: scores.dispatch ?? null,
      notes: departureNotes,
    });
  }

  // Log to autonomous_actions
  await supabase.from("autonomous_actions").insert({
    org_id: hired.org_id,
    action_type: "driver_separated",
    description: `Driver separated: ${departureReason}`,
    reasoning: `Eligible for rehire: ${eligibleForRehire}`,
    affected_record_id: params.id,
    affected_table: "hired_drivers",
  });

  // If eligible for rehire and not terminated, set driver_leads to contact_later
  if (eligibleForRehire && departureReason !== "terminated" && hired.lead_id) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 180);

    await supabase
      .from("driver_leads")
      .update({
        disposition: "contact_later",
        contact_later_date: futureDate.toISOString().split("T")[0],
        contact_later_reason: "Former employee — eligible for rehire",
        updated_at: new Date().toISOString(),
      })
      .eq("id", hired.lead_id);
  }

  return NextResponse.json({ success: true });
}
