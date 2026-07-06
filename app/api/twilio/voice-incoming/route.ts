import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/utils";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Twilio voice webhook — configured in Twilio Console under
// Phone Numbers → +19015828745 → Voice → "A CALL COMES IN" → POST to this URL.
// Use the SAME URL for the StatusCallback field; we detect which event we got
// by the presence of CallDuration (only sent when a call ends).
//
// Initial ring: insert an inbound_calls row + return TwiML that forwards to
// the recruiter. Status callback: update the row with duration + final status.
export async function POST(req: NextRequest) {
  const forwardTo = process.env.TWILIO_FORWARD_TO_NUMBER ?? "+16628821593";
  const trackedNumber = process.env.TWILIO_901_NUMBER ?? "+19015828745";

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    console.error("[voice-incoming] Failed to parse form data:", err);
    return twiml(fallbackTwiml(forwardTo));
  }

  const callSid = (form.get("CallSid") as string) ?? null;
  const fromRaw = (form.get("From") as string) ?? "";
  const toRaw = (form.get("To") as string) ?? trackedNumber;
  const callStatus = (form.get("CallStatus") as string) ?? "ringing";
  const durationRaw = form.get("CallDuration") as string | null;
  const isStatusCallback = durationRaw !== null;

  const supabase = svc();

  if (isStatusCallback) {
    // Call has ended. Update the row Twilio started earlier.
    console.log(
      `[voice-incoming] StatusCallback CallSid=${callSid} status=${callStatus} duration=${durationRaw}s`
    );
    if (callSid) {
      const { error } = await supabase
        .from("inbound_calls")
        .update({
          call_status: callStatus,
          duration_seconds: Number(durationRaw) || 0,
        })
        .eq("twilio_call_sid", callSid);
      if (error) console.warn("[voice-incoming] Update failed:", error.message);
    }
    // Twilio doesn't need TwiML back for a status callback, but a valid empty
    // Response is a safe reply.
    return twiml('<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>');
  }

  // Initial call — log it, then return TwiML that forwards to the recruiter.
  console.log(
    `[voice-incoming] Ring CallSid=${callSid} from=${fromRaw} to=${toRaw} status=${callStatus}`
  );

  try {
    const from = fromRaw ? normalizePhone(fromRaw) : "";
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "maco-transport")
      .single();

    let matchedLeadId: string | null = null;
    if (from && org?.id) {
      const { data: leads } = await supabase
        .from("driver_leads")
        .select("id")
        .eq("org_id", org.id)
        .eq("phone", from)
        .order("created_at", { ascending: false })
        .limit(1);
      matchedLeadId = leads?.[0]?.id ?? null;
    }

    if (org?.id) {
      const { error } = await supabase.from("inbound_calls").insert({
        org_id: org.id,
        caller_phone: fromRaw,
        called_number: toRaw,
        twilio_call_sid: callSid,
        matched_lead_id: matchedLeadId,
        call_status: callStatus,
        forwarded_to: forwardTo,
      });
      if (error) console.warn("[voice-incoming] Insert failed:", error.message);
    }
  } catch (err) {
    // Never block the phone call on a DB failure — always return valid TwiML.
    console.error("[voice-incoming] Log error:", err);
  }

  // Forward the call. answerOnBridge keeps the caller hearing ringback until
  // Jacob picks up. callerId passes the caller's number so Jacob's phone shows
  // who's ringing; if the carrier rejects the spoof, Twilio falls back to the
  // tracked number.
  const twimlXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20" callerId="${fromRaw || trackedNumber}" answerOnBridge="true">
    <Number>${forwardTo}</Number>
  </Dial>
  <Say voice="alice">Sorry, we could not reach a recruiter right now. Please try again in a few minutes, or apply online at drive for maco dot com.</Say>
</Response>`;

  return twiml(twimlXml);
}

function fallbackTwiml(forwardTo: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20">
    <Number>${forwardTo}</Number>
  </Dial>
</Response>`;
}

function twiml(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
