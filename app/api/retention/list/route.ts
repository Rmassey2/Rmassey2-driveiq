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

  // Try the view first, fall back to hired_drivers + join
  const { data, error } = await supabase
    .from("v_retention_dashboard")
    .select("*")
    .order("retention_risk_score", { ascending: false });

  if (error) {
    // Fallback: query hired_drivers directly
    const { data: drivers, error: err2 } = await supabase
      .from("hired_drivers")
      .select("*, driver_leads:lead_id(full_name, phone)")
      .eq("org_id", org.id)
      .order("retention_risk_score", { ascending: false });

    if (err2) return NextResponse.json({ error: "Query failed" }, { status: 500 });
    return NextResponse.json(drivers ?? []);
  }

  return NextResponse.json(data ?? []);
}
