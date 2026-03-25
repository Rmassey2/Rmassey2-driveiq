import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

  const leadId = body.lead_id as string;
  const sentBy = body.sent_by as string;

  if (!leadId) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const { data: lead } = await supabase
    .from("driver_leads")
    .select("phone, first_name, full_name")
    .eq("id", leadId)
    .single();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const firstName = lead.first_name ?? lead.full_name?.split(" ")[0] ?? "Driver";
  const applyLink = "https://apply.tenstreet.com/maco";

  await sendSMS(
    lead.phone,
    `Hey ${firstName}, ready to get rolling with Maco Transport? Start your application here: ${applyLink} — Your Maco Recruiter`
  );

  await supabase
    .from("driver_leads")
    .update({
      tenstreet_link_sent_at: new Date().toISOString(),
      tenstreet_link_sent_by: sentBy ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  return NextResponse.json({ success: true });
}
