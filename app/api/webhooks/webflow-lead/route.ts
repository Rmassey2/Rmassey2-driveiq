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

// Webflow may send a GET to verify the endpoint exists
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "webflow-lead" });
}

export async function POST(req: NextRequest) {
  // Parse body — always return 200 to prevent Webflow from disabling the webhook
  let rawBody: string;
  let body: Record<string, unknown>;
  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody);
  } catch {
    console.error("[Webflow Webhook] Failed to parse JSON body");
    return NextResponse.json({ received: true, error: "Invalid JSON" });
  }

  // Log raw payload for debugging
  console.log("[Webflow Webhook] Raw payload:", rawBody.slice(0, 2000));
  console.log("[Webflow Webhook] Top-level keys:", Object.keys(body).join(", "));

  // Optional auth check — skip if header not present (Webflow V2 doesn't send custom headers)
  const secret = req.headers.get("x-webflow-secret");
  const expectedSecret = process.env.WEBFLOW_WEBHOOK_SECRET;
  if (expectedSecret && secret && secret !== expectedSecret) {
    console.warn("[Webflow Webhook] Secret mismatch — rejecting");
    return NextResponse.json({ received: true, error: "Unauthorized" });
  }

  // Extract form data — handle BOTH V1 and V2 formats
  // V2: { formData: { name, phone, ... }, site: {...}, submissionId, ... }
  // V1: { data: { name, phone, ... } } or flat { name, phone, ... }
  let data: Record<string, string>;
  if (body.formData && typeof body.formData === "object") {
    // Webflow API V2 format
    data = body.formData as Record<string, string>;
    console.log("[Webflow Webhook] Using V2 formData format");
  } else if (body.data && typeof body.data === "object") {
    // Webflow V1 / legacy format
    data = body.data as Record<string, string>;
    console.log("[Webflow Webhook] Using V1 data format");
  } else {
    // Flat format — fields directly on body
    data = body as unknown as Record<string, string>;
    console.log("[Webflow Webhook] Using flat body format");
  }

  console.log("[Webflow Webhook] Form fields:", JSON.stringify(data).slice(0, 1000));

  const name = data.name ?? data.Name ?? data["full-name"] ?? data["Full Name"] ?? "";
  const phone = normalizePhone(data.phone ?? data.Phone ?? data["pri-phone"] ?? data["phone-number"] ?? "");
  const email = (data.email ?? data.Email ?? data["email-address"] ?? "").toLowerCase().trim();
  const cdlNumber = data.cdl_number ?? data["cdl-number"] ?? data["CDL Number"] ?? "";

  if (!name || !phone) {
    console.warn("[Webflow Webhook] Missing name or phone — name:", name, "phone:", phone);
    return NextResponse.json({ received: true, error: "name and phone are required", fields_found: Object.keys(data) });
  }

  const zipCode = data["zip-code"] ?? data.zip_code ?? data["Zip Code"] ?? null;
  const cdlRaw = data["do-you-have-a-valid-cdl"] ?? data.cdl_class ?? data["cdl"] ?? "";
  const cdlClass = cdlRaw.toLowerCase().includes("yes") ? "A" : cdlRaw.length <= 2 ? cdlRaw.toUpperCase() : null;
  const yearsRaw = data["years-of-experience"] ?? data.years_experience ?? data["experience"] ?? "";

  let yearsExperience = "less_than_2";
  if (yearsRaw.includes("5+") || yearsRaw.toLowerCase().includes("5 plus")) yearsExperience = "5_plus";
  else if (yearsRaw.includes("4-5") || yearsRaw.includes("4_5")) yearsExperience = "4_5";
  else if (yearsRaw.includes("2-3") || yearsRaw.includes("2_3")) yearsExperience = "2_3";

  const segmentRaw = data["what-type-of-driver-are-you-interested-in-being"] ?? data.segment_interest ?? data["driver-type"] ?? "";
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

  // Determine entry point from site info if available
  const siteName = (body.site as Record<string, string> | undefined)?.displayName ?? "";
  let entryPoint = utmSource ?? "webflow_direct";
  let sourceChannel = utmSource ?? "webflow";
  if (siteName.toLowerCase().includes("getloaded")) {
    entryPoint = "getloaded";
    sourceChannel = "getloaded";
  } else if (siteName.toLowerCase().includes("driveformaco")) {
    entryPoint = "driveformaco";
    sourceChannel = "driveformaco";
  }

  const supabase = svc();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();

  if (!org) {
    console.error("[Webflow Webhook] Organization not found");
    return NextResponse.json({ received: true, error: "Organization not found" });
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
    return NextResponse.json({ received: true, blocked: true, reason: "Do Not Hire" });
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
    const { disposition: _d, do_not_hire: _dnh, pipeline_stage: _ps, ...updateData } = leadData;
    void _d; void _dnh; void _ps;
    const { error } = await supabase
      .from("driver_leads")
      .update(updateData)
      .eq("id", dup.existingId);
    if (error) {
      console.error("[Webflow Webhook] Update lead error:", error);
      return NextResponse.json({ received: true, error: "Failed to update lead" });
    }
    leadId = dup.existingId;
    console.log(`[Webflow Webhook] Dedup: updated existing lead ${leadId}, matched on ${dup.matchedOn}`);
  } else {
    const { data: newLead, error } = await supabase
      .from("driver_leads")
      .insert(leadData)
      .select("id")
      .single();
    if (error || !newLead) {
      console.error("[Webflow Webhook] Insert lead error:", error);
      return NextResponse.json({ received: true, error: "Failed to create lead" });
    }
    leadId = newLead.id;
    console.log(`[Webflow Webhook] Created new lead ${leadId}, score: ${score}`);
  }

  // Send welcome SMS
  await sendSMS(
    phone,
    `Hey ${firstName}, this is your Maco Transport recruiter — got your info and will be in touch shortly. Questions? Reply to this text. Reply STOP to opt out.`
  );

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
    received: true,
    success: true,
    lead_id: leadId,
    score,
    duplicate_detected: !!dup.existingId,
    matched_on: dup.matchedOn,
  });
}
