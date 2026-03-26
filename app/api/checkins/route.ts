import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const supabase = svc();
  const driverId = req.nextUrl.searchParams.get("driver_id");

  let query = supabase.from("checkins").select("*").order("scheduled_at", { ascending: true });

  if (driverId) {
    query = query.eq("driver_id", driverId);
  }

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
    .from("checkins")
    .insert({
      org_id: body.org_id,
      driver_id: body.driver_id,
      checkin_type: body.checkin_type ?? "ad_hoc",
      scheduled_at: body.scheduled_at ?? new Date().toISOString().split("T")[0],
    })
    .select("*")
    .single();

  if (error) {
    console.error("Create checkin error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
  return NextResponse.json(data);
}
