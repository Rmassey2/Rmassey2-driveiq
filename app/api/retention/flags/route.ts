import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const supabase = svc();
  const driverId = req.nextUrl.searchParams.get("driver_id");
  const resolved = req.nextUrl.searchParams.get("resolved");

  let query = supabase.from("retention_flags").select("*").order("flagged_at", { ascending: false });

  if (driverId) query = query.eq("driver_id", driverId);
  if (resolved === "false") query = query.eq("resolved", false);
  if (resolved === "true") query = query.eq("resolved", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });
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

  const { data, error } = await supabase
    .from("retention_flags")
    .insert({
      org_id: body.org_id,
      driver_id: body.driver_id,
      trigger_type: body.trigger_type,
      risk_points: body.risk_points,
      alert_level: body.alert_level ?? "yellow",
      notes: body.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Create flag error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
  return NextResponse.json(data);
}
