import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/twilio";
import { sendEmail } from "@/lib/resend";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function replaceMergeFields(body: string, vars: Record<string, string>): string {
  let out = body;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, val);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = svc();
  const now = new Date().toISOString();

  const { data: enrollments, error: enrollErr } = await supabase
    .from("drip_enrollments")
    .select("*, driver_leads:driver_id(*), drip_messages:next_message_id(*)")
    .eq("status", "active")
    .not("next_message_id", "is", null)
    .lte("next_send_at", now)
    .limit(100);

  if (enrollErr) {
    console.error("Drip query error:", enrollErr);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const enrollment of enrollments ?? []) {
    const lead = enrollment.driver_leads;
    const message = enrollment.drip_messages;

    if (!lead || !message) {
      failed++;
      continue;
    }

    const mergeVars: Record<string, string> = {
      first_name: lead.full_name?.split(" ")[0] ?? "Driver",
      recruiter_name: "Your Maco Recruiter",
      segment: lead.segment_interest ?? "OTR",
      apply_link: "https://apply.tenstreet.com/maco",
      recruiter_phone: process.env.TWILIO_FROM_NUMBER ?? "",
    };

    const body = replaceMergeFields(message.body, mergeVars);

    let sendResult: { success: boolean };

    if (message.channel === "email" && lead.email) {
      const subject = replaceMergeFields(message.subject ?? "From Maco Transport", mergeVars);
      sendResult = await sendEmail(lead.email, subject, body);
    } else {
      sendResult = await sendSMS(lead.phone, body);
    }

    // Log send
    await supabase.from("drip_sends").insert({
      org_id: enrollment.org_id,
      enrollment_id: enrollment.id,
      message_id: message.id,
      driver_id: lead.id,
      channel: message.channel ?? "sms",
      sent_at: now,
      delivered: sendResult.success,
    });

    if (!sendResult.success) {
      failed++;
      continue;
    }

    sent++;

    // Update message total_sent
    await supabase
      .from("drip_messages")
      .update({ total_sent: (message.total_sent ?? 0) + 1 })
      .eq("id", message.id);

    // Find next message in sequence
    const { data: nextMsg } = await supabase
      .from("drip_messages")
      .select("id, delay_days")
      .eq("campaign_id", message.campaign_id)
      .gt("sequence_order", message.sequence_order)
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    const newMessagesSent = (enrollment.messages_sent ?? 0) + 1;

    if (nextMsg) {
      const nextSendAt = new Date(
        Date.now() + (nextMsg.delay_days ?? 2) * 24 * 60 * 60 * 1000
      ).toISOString();

      await supabase
        .from("drip_enrollments")
        .update({
          messages_sent: newMessagesSent,
          last_sent_at: now,
          next_message_id: nextMsg.id,
          next_send_at: nextSendAt,
        })
        .eq("id", enrollment.id);
    } else {
      await supabase
        .from("drip_enrollments")
        .update({
          messages_sent: newMessagesSent,
          last_sent_at: now,
          next_message_id: null,
          next_send_at: null,
          status: "completed",
          completed_at: now,
        })
        .eq("id", enrollment.id);
    }

    // Cold flag after 3 messages with no reply
    if (newMessagesSent >= 3) {
      const { count } = await supabase
        .from("drip_sends")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", lead.id)
        .eq("replied", true);

      if ((count ?? 0) === 0) {
        await supabase
          .from("driver_leads")
          .update({ cold_flag: true, cold_flagged_at: now })
          .eq("id", lead.id);
      }
    }
  }

  return NextResponse.json({ sent, failed, total: enrollments?.length ?? 0 });
}
