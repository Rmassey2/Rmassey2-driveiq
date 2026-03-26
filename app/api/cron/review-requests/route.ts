import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { sendSMS } from "@/lib/twilio";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = svc();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const googleLink = process.env.GOOGLE_REVIEW_LINK ?? "https://g.page/macotransport/review";

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

  let sent = 0;
  let skipped = 0;

  // Day 30 — Google review request
  const day30 = new Date();
  day30.setDate(day30.getDate() - 30);
  const day30Str = day30.toISOString().split("T")[0];

  const { data: drivers30 } = await supabase
    .from("hired_drivers")
    .select("id, lead_id")
    .eq("status", "active")
    .eq("hire_date", day30Str);

  for (const driver of drivers30 ?? []) {
    const { data: existing } = await supabase
      .from("review_requests")
      .select("id")
      .eq("driver_id", driver.id)
      .eq("platform", "google")
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const { data: lead } = await supabase
      .from("driver_leads")
      .select("full_name, phone")
      .eq("id", driver.lead_id)
      .single();

    if (!lead?.phone) { skipped++; continue; }

    const firstName = lead.full_name?.split(" ")[0] ?? "Driver";
    let smsBody = `Hey ${firstName}, congrats on 30 days with Maco Transport! We'd love your honest review — it helps other drivers find a great home. ${googleLink}`;

    if (apiKey) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 256,
            system: "You write short, friendly SMS messages for Maco Transport. Keep under 160 chars. Include the review link provided.",
            messages: [{
              role: "user",
              content: `Write a personalized Google review request SMS for ${firstName} who just hit 30 days at Maco Transport. Include this link: ${googleLink}`,
            }],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.content?.[0]?.text;
          if (text) smsBody = text;
        }
      } catch { /* fallback to default message */ }
    }

    await sendSMS(lead.phone, smsBody);

    await supabase.from("review_requests").insert({
      org_id: org.id,
      driver_id: driver.id,
      platform: "google",
      sent_via: "sms",
      sent_at: new Date().toISOString(),
      opened: false,
      clicked: false,
      submitted: false,
    });

    await supabase.from("autonomous_actions").insert({
      org_id: org.id,
      action_type: "review_request",
      description: `Google review request sent to ${lead.full_name} (30-day milestone)`,
      reasoning: "Automated review request at 30 days post-hire",
      affected_record_id: driver.id,
      affected_table: "hired_drivers",
    });

    sent++;
  }

  // Day 45 — Facebook review request
  const day45 = new Date();
  day45.setDate(day45.getDate() - 45);
  const day45Str = day45.toISOString().split("T")[0];

  const { data: drivers45 } = await supabase
    .from("hired_drivers")
    .select("id, lead_id")
    .eq("status", "active")
    .eq("hire_date", day45Str);

  for (const driver of drivers45 ?? []) {
    const { data: existing } = await supabase
      .from("review_requests")
      .select("id")
      .eq("driver_id", driver.id)
      .eq("platform", "facebook")
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const { data: lead } = await supabase
      .from("driver_leads")
      .select("full_name, phone")
      .eq("id", driver.lead_id)
      .single();

    if (!lead?.phone) { skipped++; continue; }

    const firstName = lead.full_name?.split(" ")[0] ?? "Driver";
    const fbMsg = `Hey ${firstName}! 45 days in — hope you're settling in great at Maco. Would you mind leaving us a quick review on Facebook? It really helps the team. Thanks!`;

    await sendSMS(lead.phone, fbMsg);

    await supabase.from("review_requests").insert({
      org_id: org.id,
      driver_id: driver.id,
      platform: "facebook",
      sent_via: "sms",
      sent_at: new Date().toISOString(),
      opened: false,
      clicked: false,
      submitted: false,
    });

    await supabase.from("autonomous_actions").insert({
      org_id: org.id,
      action_type: "review_request",
      description: `Facebook review request sent to ${lead.full_name} (45-day milestone)`,
      reasoning: "Automated review request at 45 days post-hire",
      affected_record_id: driver.id,
      affected_table: "hired_drivers",
    });

    sent++;
  }

  return NextResponse.json({ sent, skipped });
}
