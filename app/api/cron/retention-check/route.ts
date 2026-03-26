import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { sendYellowAlert, sendRedAlert } from "@/lib/alerts";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = svc();

  // Get all active hired drivers
  const { data: drivers, error: dErr } = await supabase
    .from("hired_drivers")
    .select("id, org_id, lead_id, retention_risk_score, status, assigned_dm_id")
    .in("status", ["active", "at_risk", "fragile"]);

  if (dErr) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  let updated = 0;
  let yellowAlerts = 0;
  let redAlerts = 0;

  for (const driver of drivers ?? []) {
    // Sum unresolved flags
    const { data: flags } = await supabase
      .from("retention_flags")
      .select("trigger_type, risk_points")
      .eq("driver_id", driver.id)
      .eq("resolved", false);

    const newScore = (flags ?? []).reduce((sum, f) => sum + (f.risk_points ?? 0), 0);
    const oldScore = driver.retention_risk_score ?? 0;

    // Determine new status
    let newStatus = "active";
    if (newScore >= 8) newStatus = "fragile";
    else if (newScore >= 6) newStatus = "at_risk";

    // Update driver
    await supabase
      .from("hired_drivers")
      .update({
        retention_risk_score: newScore,
        active_flags: (flags ?? []).map((f) => f.trigger_type),
        status: newStatus,
        risk_last_calculated: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", driver.id);

    updated++;

    // Get driver name for alerts
    let driverName = "Unknown Driver";
    if (driver.lead_id) {
      const { data: lead } = await supabase
        .from("driver_leads")
        .select("full_name")
        .eq("id", driver.lead_id)
        .single();
      if (lead) driverName = lead.full_name;
    }

    // Get DM phone if assigned
    let dmPhone: string | null = null;
    if (driver.assigned_dm_id) {
      const { data: dm } = await supabase
        .from("org_members")
        .select("phone")
        .eq("id", driver.assigned_dm_id)
        .single();
      if (dm) dmPhone = dm.phone;
    }

    // Check for alert threshold crossings
    if (newScore >= 8 && oldScore < 8) {
      await sendRedAlert(
        supabase,
        driver.org_id,
        driver.id,
        driverName,
        newScore,
        flags ?? [],
        dmPhone
      );
      redAlerts++;
    } else if (newScore >= 6 && oldScore < 6) {
      await sendYellowAlert(
        supabase,
        driver.org_id,
        driver.id,
        driverName,
        newScore,
        dmPhone
      );
      yellowAlerts++;
    }
  }

  return NextResponse.json({ updated, yellowAlerts, redAlerts });
}
