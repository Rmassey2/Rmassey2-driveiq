import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { scheduleCheckins } from "@/lib/checkin-scheduler";

export async function GET(req: NextRequest) {
  const supabase = svc();
  const orgSlug = req.nextUrl.searchParams.get("org") ?? "maco-transport";

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .single();

  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

  const { data, error } = await supabase
    .from("hired_drivers")
    .select("*, driver_leads:lead_id(full_name, phone)")
    .eq("org_id", org.id)
    .order("hire_date", { ascending: false });

  if (error) {
    // Fallback without join
    const { data: simple } = await supabase
      .from("hired_drivers")
      .select("*")
      .eq("org_id", org.id)
      .order("hire_date", { ascending: false });
    return NextResponse.json(simple ?? []);
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = svc();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leadId = body.lead_id as string;
  if (!leadId) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const { data: lead } = await supabase
    .from("driver_leads")
    .select("org_id, segment_interest")
    .eq("id", leadId)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const hireDate = (body.hire_date as string) ?? new Date().toISOString().split("T")[0];

  const { data: hired, error } = await supabase
    .from("hired_drivers")
    .insert({
      org_id: lead.org_id,
      lead_id: leadId,
      hire_date: hireDate,
      segment: lead.segment_interest ?? (body.segment as string) ?? null,
      assigned_dm_id: (body.assigned_dm_id as string) ?? null,
      truck_number: (body.truck_number as string) ?? null,
      status: "active",
      retention_risk_score: 0,
      active_flags: [],
    })
    .select("*")
    .single();

  if (error) {
    console.error("Create hired_driver error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }

  // Schedule all check-ins
  await scheduleCheckins(supabase, lead.org_id, hired.id, hireDate);

  return NextResponse.json(hired);
}
