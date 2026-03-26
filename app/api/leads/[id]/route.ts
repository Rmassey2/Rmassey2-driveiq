import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scheduleCheckins } from "@/lib/checkin-scheduler";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = svc();
  const { data, error } = await supabase
    .from("driver_leads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
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

  // Get current record for event logging
  const { data: current } = await supabase
    .from("driver_leads")
    .select("pipeline_stage, disposition, org_id")
    .eq("id", params.id)
    .single();

  if (current) {
    // Log stage change
    if (body.pipeline_stage !== undefined && current.pipeline_stage !== body.pipeline_stage) {
      await supabase.from("pipeline_events").insert({
        org_id: current.org_id,
        driver_id: params.id,
        from_stage: current.pipeline_stage,
        to_stage: body.pipeline_stage as number,
        changed_by: (body._performed_by as string) ?? null,
      });
    }

    // Log disposition change
    if (body.disposition !== undefined && current.disposition !== body.disposition) {
      await supabase.from("pipeline_events").insert({
        org_id: current.org_id,
        driver_id: params.id,
        from_disposition: current.disposition,
        to_disposition: body.disposition as string,
        changed_by: (body._performed_by as string) ?? null,
        note: (body.dnh_reason as string) ?? (body.contact_later_reason as string) ?? null,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _performed_by: _omit, ...rest } = body as Record<string, unknown> & { _performed_by?: string };
  const updateData = { ...rest, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("driver_leads")
    .update(updateData)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    console.error("Update lead error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Auto-create hired_drivers when disposition changes to hired
  if (
    current &&
    body.disposition === "hired" &&
    current.disposition !== "hired"
  ) {
    const hireDate = new Date().toISOString().split("T")[0];

    // Check if already exists
    const { data: existing } = await supabase
      .from("hired_drivers")
      .select("id")
      .eq("lead_id", params.id)
      .maybeSingle();

    if (!existing) {
      const { data: hired } = await supabase
        .from("hired_drivers")
        .insert({
          org_id: current.org_id,
          lead_id: params.id,
          hire_date: hireDate,
          segment: data?.segment_interest ?? null,
          status: "active",
          retention_risk_score: 0,
          active_flags: [],
        })
        .select("id")
        .single();

      if (hired) {
        await scheduleCheckins(supabase, current.org_id, hired.id, hireDate);
      }
    }
  }

  return NextResponse.json(data);
}
