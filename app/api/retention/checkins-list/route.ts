import { NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = svc();

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "maco-transport")
      .single();

    if (!org) return NextResponse.json({ checkins: [], names: {} });

    // Query checkins without the join — safer if hired_drivers is empty
    const { data, error } = await supabase
      .from("checkins")
      .select("id, driver_id, checkin_type, scheduled_at, completed_at, missed, org_id")
      .eq("org_id", org.id)
      .order("scheduled_at", { ascending: true });

    if (error) {
      console.error("[checkins-list] Query error:", error.message);
      return NextResponse.json({ checkins: [], names: {} });
    }

    const checkins = data ?? [];
    if (checkins.length === 0) {
      return NextResponse.json({ checkins: [], names: {} });
    }

    // Get lead_ids from hired_drivers for these driver_ids
    const driverIds = Array.from(new Set(checkins.map((c) => c.driver_id)));
    const { data: hiredDrivers } = await supabase
      .from("hired_drivers")
      .select("id, lead_id")
      .in("id", driverIds);

    const driverToLead: Record<string, string> = {};
    const leadIds = new Set<string>();
    for (const hd of hiredDrivers ?? []) {
      if (hd.lead_id) {
        driverToLead[hd.id] = hd.lead_id;
        leadIds.add(hd.lead_id);
      }
    }

    // Fetch driver names from driver_leads
    const nameMap: Record<string, string> = {};
    if (leadIds.size > 0) {
      const { data: leads } = await supabase
        .from("driver_leads")
        .select("id, full_name")
        .in("id", Array.from(leadIds));

      const leadNameMap: Record<string, string> = {};
      for (const l of leads ?? []) leadNameMap[l.id] = l.full_name;

      // Map driver_id → name
      for (const [driverId, leadId] of Object.entries(driverToLead)) {
        if (leadNameMap[leadId]) nameMap[driverId] = leadNameMap[leadId];
      }
    }

    return NextResponse.json({ checkins, names: nameMap });
  } catch (err) {
    console.error("[checkins-list] Unexpected error:", err);
    return NextResponse.json({ checkins: [], names: {} });
  }
}
