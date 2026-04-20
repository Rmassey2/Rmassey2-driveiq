import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/twilio";
import { normalizePhone } from "@/lib/utils";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = svc();
  let body: { lead_id?: string; to?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const from = process.env.TWILIO_901_NUMBER ?? process.env.TWILIO_FROM_NUMBER;
  if (!from) {
    return NextResponse.json(
      { error: "TWILIO_901_NUMBER and TWILIO_FROM_NUMBER are both unset" },
      { status: 500 }
    );
  }

  // Resolve destination phone — explicit `to` wins, else pull from the lead record.
  let to = body.to ? normalizePhone(body.to) : null;
  let leadName: string | null = null;
  let orgId: string | null = null;

  if (body.lead_id) {
    const { data: lead } = await supabase
      .from("driver_leads")
      .select("id, org_id, full_name, phone")
      .eq("id", body.lead_id)
      .single();
    if (lead) {
      leadName = lead.full_name;
      orgId = lead.org_id;
      if (!to) to = lead.phone ? normalizePhone(lead.phone) : null;
    }
  }

  if (!to) {
    return NextResponse.json({ error: "No destination phone available" }, { status: 400 });
  }

  const destination = to.startsWith("+") ? to : `+1${to.replace(/^1/, "")}`;
  const message =
    body.message?.trim() ||
    `DriveIQ test from Maco Transport via 901 line. If you got this, Twilio is working. Reply STOP to opt out.`;

  const result = await sendSMS(destination, message, from);

  if (orgId) {
    await supabase.from("autonomous_actions").insert({
      org_id: orgId,
      action_type: "sms_test",
      description: `Test SMS via 901 to ${destination}${leadName ? ` (${leadName})` : ""}`,
      reasoning: result.success
        ? `Twilio SID ${result.sid ?? "unknown"}`
        : `Failed: ${result.error ?? "unknown error"}`,
      affected_record_id: body.lead_id ?? null,
      affected_table: "driver_leads",
    });
  }

  if (!result.success) {
    return NextResponse.json(
      { success: false, from, to: destination, error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, from, to: destination, sid: result.sid });
}
