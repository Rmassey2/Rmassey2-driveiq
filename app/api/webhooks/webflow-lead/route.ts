import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateLeadScore } from "@/lib/scoring";
import { sendSMS } from "@/lib/twilio";
import { normalizePhone } from "@/lib/utils";
import { findDuplicateLead, checkDNH } from "@/lib/dedup";

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
  const phone = normalizePhone(data.phone ?? data.Phone ?? "");
  const email = (data.email ?? data.Email ?? "").toLowerCase().trim();
  const cdlNumber = data.cdl_number ?? data["cdl-number"] ?? "";

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
  const tenstreetId = data.tenstreet_applicant_id ?? null;

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

  // DNH check before anything else
  const dnh = await checkDNH(supabase, { phone, email: email || null, cdl_number: cdlNumber || null });
  if (dnh.blocked) {
    await supabase.from("autonomous_actions").insert({
      org_id: org.id,
      action_type: "dnh_block",
      description: `Blocked webflow lead "${name}" — matches DNH record on ${dnh.matchedOn}`,
      reasoning: `DNH match on ${dnh.matchedOn}, existing lead ID: ${dnh.matchedId}`,
      affected_record_id: dnh.matchedId,
      affected_table: "driver_leads",
    });
    return NextResponse.json(
      { error: "This driver is flagged Do Not Hire" },
      { status: 403 }
    );
  }

  const firstName = name.trim().split(/\s+/)[0];
  const score = calculateLeadScore({ cdlClass, yearsExperience, source: utmSource });

  // Dedup check
  const dup = await findDuplicateLead(supabase, {
    tenstreet_applicant_id: tenstreetId,
    phone,
    email: email || null,
    cdl_number: cdlNumber || null,
  });

  const leadData = {
    org_id: org.id,
    full_name: name.trim(),
    phone,
    email: email || null,
    zip_code: zipCode,
    cdl_class: cdlClass,
    cdl_number: cdlNumber || null,
    years_experience: yearsExperience,
    segment_interest: segment,
    entry_point: entryPoint,
    source_channel: sourceChannel,
    source_campaign: utmCampaign,
    utm_medium: utmMedium,
    utm_content: utmContent,
    tenstreet_applicant_id: tenstreetId,
    lead_score: score,
    pipeline_stage: 1,
    disposition: "active" as const,
    cold_flag: false,
    do_not_hire: false,
    updated_at: new Date().toISOString(),
  };

  let leadId: string;

  if (dup.existingId) {
    // Update existing — don't overwrite disposition or do_not_hire
    const { disposition: _d, do_not_hire: _dnh, pipeline_stage: _ps, ...updateData } = leadData;
    void _d; void _dnh; void _ps;
    const { error } = await supabase
      .from("driver_leads")
      .update(updateData)
      .eq("id", dup.existingId);
    if (error) {
      console.error("Update lead error:", error);
      return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
    }
    leadId = dup.existingId;
    console.log(`Webflow dedup: updated existing lead ${leadId}, matched on ${dup.matchedOn}`);
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

  // Alert recruiter on priority leads (score 70+)
  if (score >= 70) {
    const { data: recruiter } = await supabase
      .from("org_members")
      .select("phone")
      .eq("org_id", org.id)
      .eq("role", "recruiter")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (recruiter?.phone) {
      await sendSMS(
        recruiter.phone,
        `PRIORITY LEAD — ${name.trim()} just applied. Score: ${score}. Segment: ${segment}. Phone: ${phone}. Check DriveIQ now.`
      );
    }
  }

  // Enroll in drip campaign (only for new leads)
  if (!dup.existingId) {
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
  }

  return NextResponse.json({
    success: true,
    lead_id: leadId,
    score,
    duplicate_detected: !!dup.existingId,
    matched_on: dup.matchedOn,
  });
}
