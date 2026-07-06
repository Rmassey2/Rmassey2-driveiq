import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/twilio";
import { normalizePhone } from "@/lib/utils";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Twilio inbound SMS webhook — configured on the Messaging Service (not on the
// number itself, since a number in a Messaging Service pool routes inbound
// traffic through the service, not the number's own webhook).
//
// Path in Twilio Console: Messaging → Services → Low Volume Mixed A2P
// Messaging Service → Integration → "Send an inbound message webhook to" →
// POST → https://apply.driveformaco.com/api/twilio/message-incoming
//
// Twilio's Messaging Service still handles STOP/HELP/START automatically
// before those messages reach us. We see everything else — real replies to
// drip campaigns and welcome SMS.
export async function POST(req: NextRequest) {
  const forwardTo = process.env.TWILIO_FORWARD_TO_NUMBER ?? "+16628821593";

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    console.error("[message-incoming] Failed to parse form data:", err);
    return emptyTwiml();
  }

  const messageSid = (form.get("MessageSid") as string) ?? null;
  const fromRaw = (form.get("From") as string) ?? "";
  const toRaw = (form.get("To") as string) ?? "";
  const body = ((form.get("Body") as string) ?? "").trim();

  console.log(
    `[message-incoming] MessageSid=${messageSid} from=${fromRaw} to=${toRaw} body=${JSON.stringify(body).slice(0, 200)}`
  );

  try {
    const supabase = svc();

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "maco-transport")
      .single();

    const fromNormalized = fromRaw ? normalizePhone(fromRaw) : "";
    let matchedLeadId: string | null = null;
    let matchedLeadName: string | null = null;

    if (fromNormalized && org?.id) {
      const { data: leads } = await supabase
        .from("driver_leads")
        .select("id, full_name")
        .eq("org_id", org.id)
        .eq("phone", fromNormalized)
        .order("created_at", { ascending: false })
        .limit(1);
      const lead = leads?.[0];
      if (lead) {
        matchedLeadId = lead.id;
        matchedLeadName = lead.full_name;
      }
    }

    // Forward the reply to the recruiter as an SMS so they can respond in real
    // time. Prefix with driver context — name if known, phone if not.
    const contextPrefix = matchedLeadName
      ? `${matchedLeadName} (${fromRaw})`
      : `Unknown driver (${fromRaw})`;
    const truncated = body.length > 300 ? body.slice(0, 300) + "…" : body;
    const notifyBody = `DriveIQ SMS reply from ${contextPrefix}: "${truncated}"`;

    let forwardedOk = false;
    try {
      const result = await sendSMS(forwardTo, notifyBody);
      forwardedOk = result.success;
      if (!result.success) {
        console.warn("[message-incoming] Recruiter forward failed:", result.error);
      }
    } catch (err) {
      console.error("[message-incoming] Recruiter forward threw:", err);
    }

    if (org?.id) {
      const { error } = await supabase.from("inbound_messages").insert({
        org_id: org.id,
        from_phone: fromRaw,
        to_phone: toRaw,
        body,
        twilio_message_sid: messageSid,
        matched_lead_id: matchedLeadId,
        forwarded_to_recruiter: forwardedOk,
      });
      if (error) console.warn("[message-incoming] Insert failed:", error.message);
    }
  } catch (err) {
    // Never block Twilio on a DB failure — always return valid TwiML.
    console.error("[message-incoming] Handler error:", err);
  }

  // Return an empty Response — Twilio won't auto-reply to the sender. The
  // recruiter reaches out directly (via SMS or call) once they see the ping.
  return emptyTwiml();
}

function emptyTwiml(): Response {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>',
    {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    }
  );
}
