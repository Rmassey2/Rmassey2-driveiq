import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const supabase = svc();
  const leadId = req.nextUrl.searchParams.get("lead_id");
  if (!leadId) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("call_log")
    .select("*")
    .eq("driver_id", leadId)
    .order("logged_at", { ascending: false });

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

  const driverId = body.driver_lead_id as string;

  // Get driver's org_id
  const { data: driver } = await supabase
    .from("driver_leads")
    .select("org_id")
    .eq("id", driverId)
    .single();

  const { data, error } = await supabase
    .from("call_log")
    .insert({
      org_id: driver?.org_id,
      driver_id: driverId,
      recruiter_id: (body.org_member_id as string) ?? null,
      contact_type: body.contact_type ?? "phone",
      outcome: body.outcome ?? "no_answer",
      callback_date: body.callback_date ?? null,
      notes: body.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Call log error:", error);
    return NextResponse.json({ error: "Failed to log call" }, { status: 500 });
  }

  return NextResponse.json(data);
}
