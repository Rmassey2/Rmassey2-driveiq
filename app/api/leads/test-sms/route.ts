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

  const messagingService = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_901_NUMBER ?? process.env.TWILIO_FROM_NUMBER;
  if (!messagingService && !from) {
    return NextResponse.json(
      {
        error:
          "No Twilio sender configured (TWILIO_MESSAGING_SERVICE_SID, TWILIO_901_NUMBER, or TWILIO_FROM_NUMBER required)",
      },
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

  // Numbers assigned to a Messaging Service cannot be used as a raw From (Twilio
  // error 21606). The 901 number is in the A2P Messaging Service pool, so prefer
  // the service when set and fall back to the raw From only if it isn't.
  const result = messagingService
    ? await sendSMS(destination, message)
    : await sendSMS(destination, message, from);

  const sentVia = messagingService ? `messaging_service ${messagingService}` : `from ${from}`;

  if (orgId) {
    await supabase.from("autonomous_actions").insert({
      org_id: orgId,
      action_type: "sms_test",
      description: `Test SMS via 901 to ${destination}${leadName ? ` (${leadName})` : ""}`,
      reasoning: result.success
        ? `Twilio SID ${result.sid ?? "unknown"} (${sentVia})`
        : `Failed: ${result.error ?? "unknown error"} (${sentVia})`,
      affected_record_id: body.lead_id ?? null,
      affected_table: "driver_leads",
    });
  }

  if (!result.success) {
    return NextResponse.json(
      { success: false, sentVia, to: destination, error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, sentVia, to: destination, sid: result.sid });
}
