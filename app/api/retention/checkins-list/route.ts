import { NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET() {
  const supabase = svc();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();

  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

  const { data, error } = await supabase
    .from("checkins")
    .select("id, driver_id, checkin_type, scheduled_at, completed_at, missed, org_id, hired_drivers(lead_id)")
    .eq("org_id", org.id)
    .order("scheduled_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  // Fetch driver names
  const leadIds = new Set<string>();
  for (const c of data ?? []) {
    const hd = c.hired_drivers as unknown as { lead_id: string | null } | null;
    if (hd?.lead_id) leadIds.add(hd.lead_id);
  }

  let nameMap: Record<string, string> = {};
  if (leadIds.size > 0) {
    const { data: leads } = await supabase
      .from("driver_leads")
      .select("id, full_name")
      .in("id", Array.from(leadIds));
    nameMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l.full_name]));
  }

  return NextResponse.json({ checkins: data ?? [], names: nameMap });
}
