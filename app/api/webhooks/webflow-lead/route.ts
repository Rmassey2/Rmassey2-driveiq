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
  const secret = req.headers.get("x-webflow-secret");
  if (secret !== process.env.WEBFLOW_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = (body.data ?? body) as Record<string, string>;
  const name = data.name ?? data.Name ?? "";
  const phone = (data.phone ?? data.Phone ?? "").replace(/\D/g, "");
  const email = data.email ?? data.Email ?? "";

  if (!name || !phone) {
    return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
  }

  const zipCode = data["zip-code"] ?? data.zip_code ?? null;
  const cdlRaw = data["do-you-have-a-valid-cdl"] ?? data.cdl_class ?? "";
  const cdlClass = cdlRaw.toLowerCase().includes("yes") ? "A" : cdlRaw.length <= 2 ? cdlRaw.toUpperCase() : null;
  const yearsRaw = data["years-of-experience"] ?? data.years_experience ?? "";

  let yearsExperience = "less_than_2";
  if (yearsRaw.includes("5+") || yearsRaw.toLowerCase().includes("5 plus")) yearsExperience = "5_plus";
  else if (yearsRaw.includes("4-5") || yearsRaw.includes("4_5")) yearsExperience = "4_5";
  else if (yearsRaw.includes("2-3") || yearsRaw.includes("2_3")) yearsExperience = "2_3";

  const segmentRaw = data["what-type-of-driver-are-you-interested-in-being"] ?? data.segment_interest ?? "";
  const segLower = segmentRaw.toLowerCase();
  let segment = "OTR";
  if (segLower.includes("regional")) segment = "Regional";
  else if (segLower.includes("local")) segment = "Local";
  else if (segLower.includes("owner") || segLower.includes("op")) segment = "Owner-Op";
  else if (segLower.includes("dedicated")) segment = "Dedicated";

  const utmSource = data.utm_source ?? null;
  const utmCampaign = data.utm_campaign ?? null;
  const utmMedium = data.utm_medium ?? null;
  const utmContent = data.utm_content ?? null;

  const entryPoint = utmSource ?? "webflow_direct";
  const sourceChannel = utmSource ?? "webflow";

  const supabase = svc();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 500 });
  }

  const firstName = name.trim().split(/\s+/)[0];
  const score = calculateLeadScore({ cdlClass, yearsExperience, source: utmSource });

  // Check existing by phone or email
  let existingId: string | null = null;
  const { data: byPhone } = await supabase
    .from("driver_leads")
    .select("id")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  if (byPhone) {
    existingId = byPhone.id;
  } else if (email) {
    const { data: byEmail } = await supabase
      .from("driver_leads")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (byEmail) existingId = byEmail.id;
  }

  const leadData = {
    org_id: org.id,
    full_name: name.trim(),
    phone,
    email: email || null,
    zip_code: zipCode,
    cdl_class: cdlClass,
    years_experience: yearsExperience,
    segment_interest: segment,
    entry_point: entryPoint,
    source_channel: sourceChannel,
    source_campaign: utmCampaign,
    utm_medium: utmMedium,
    utm_content: utmContent,
    lead_score: score,
    pipeline_stage: 1,
    disposition: "active",
    cold_flag: false,
    do_not_hire: false,
    updated_at: new Date().toISOString(),
  };

  let leadId: string;

  if (existingId) {
    const { error } = await supabase
      .from("driver_leads")
      .update(leadData)
      .eq("id", existingId);
    if (error) {
      console.error("Update lead error:", error);
      return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
    }
    leadId = existingId;
  } else {
    const { data: newLead, error } = await supabase
      .from("driver_leads")
      .insert(leadData)
      .select("id")
      .single();
    if (error || !newLead) {
      console.error("Insert lead error:", error);
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
    }
    leadId = newLead.id;
  }

  // Send welcome SMS
  const smsBody = `Hey ${firstName}, this is your Maco Transport recruiter — got your info and will be in touch shortly. Questions? Reply to this text. Reply STOP to opt out.`;
  await sendSMS(phone, smsBody);

  // Enroll in drip campaign
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
      driver_id: leadId,
      campaign_id: campaign.id,
      status: "active",
      messages_sent: 0,
      next_message_id: firstMsg?.id ?? null,
      next_send_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return NextResponse.json({
    success: true,
    lead_id: leadId,
    score,
    campaign: campaign ? `${segment} Active Recruiting` : "no matching campaign",
  });
}
