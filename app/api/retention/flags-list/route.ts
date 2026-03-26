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

  const { data: flags, error } = await supabase
    .from("retention_flags")
    .select("*")
    .eq("org_id", org.id)
    .order("flagged_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  // Fetch hired driver options for the "add flag" form
  const { data: drivers } = await supabase
    .from("hired_drivers")
    .select("id, lead_id")
    .eq("org_id", org.id)
    .eq("status", "active");

  const leadIds = (drivers ?? []).map((d) => d.lead_id).filter(Boolean);
  let driverOptions: { id: string; full_name: string }[] = [];
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from("driver_leads")
      .select("id, full_name")
      .in("id", leadIds);

    driverOptions = (drivers ?? []).map((d) => {
      const lead = (leads ?? []).find((l) => l.id === d.lead_id);
      return { id: d.id, full_name: lead?.full_name ?? "Unknown" };
    });
  }

  return NextResponse.json({ flags: flags ?? [], drivers: driverOptions });
}
