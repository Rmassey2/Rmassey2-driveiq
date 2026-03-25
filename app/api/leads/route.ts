import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateLeadScore } from "@/lib/scoring";
import { sendSMS } from "@/lib/twilio";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = svc();
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullName = (body.full_name as string) ?? "";
  const phone = ((body.phone as string) ?? "").replace(/\D/g, "");

  if (!fullName || !phone) {
    return NextResponse.json({ error: "full_name and phone required" }, { status: 400 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();

  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 500 });
  }

  const firstName = fullName.trim().split(/\s+/)[0];
  const score = calculateLeadScore({
    cdlClass: body.cdl_class as string,
    yearsExperience: body.years_experience as string,
    source: body.source as string,
  });

  const segment = (body.segment_interest as string) ?? "OTR";
  const source = (body.source as string) ?? "manual";

  const { data: lead, error } = await supabase
    .from("driver_leads")
    .insert({
      org_id: org.id,
      full_name: fullName.trim(),
      phone,
      email: (body.email as string) || null,
      zip_code: (body.zip_code as string) || null,
      cdl_class: (body.cdl_class as string) || null,
      years_experience: (body.years_experience as string) || null,
      segment_interest: segment,
      entry_point: source,
      source_channel: source,
      lead_score: score,
      pipeline_stage: 1,
      disposition: "active",
      cold_flag: false,
      do_not_hire: false,
      notes: (body.notes as string) || null,
      referral_driver_id: (body.referral_driver_id as string) || null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    console.error("Create lead error:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }

  await sendSMS(
    phone,
    `Hey ${firstName}, this is your Maco Transport recruiter — got your info and will be in touch shortly. Questions? Reply to this text. Reply STOP to opt out.`
  );

  // Enroll in drip
  const { data: campaign } = await supabase
    .from("drip_campaigns")
    .select("id")
    .eq("org_id", org.id)
    .ilike("name", `%${segment}%`)
    .limit(1)
    .maybeSingle();

  if (campaign) {
    const { data: firstMsg } = await supabase
      .from("drip_messages")
      .select("id")
      .eq("campaign_id", campaign.id)
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    await supabase.from("drip_enrollments").insert({
      org_id: org.id,
      driver_id: lead.id,
      campaign_id: campaign.id,
      status: "active",
      messages_sent: 0,
      next_message_id: firstMsg?.id ?? null,
      next_send_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return NextResponse.json({ success: true, lead_id: lead.id, score });
}
