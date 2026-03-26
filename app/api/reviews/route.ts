import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { sendSMS } from "@/lib/twilio";

export async function GET() {
  const supabase = svc();
  const { data, error } = await supabase
    .from("review_requests")
    .select("*, hired_drivers!inner(lead_id, driver_leads:lead_id(full_name))")
    .order("sent_at", { ascending: false });

  if (error) {
    // Fallback without join if relation fails
    const { data: simple, error: err2 } = await supabase
      .from("review_requests")
      .select("*")
      .order("sent_at", { ascending: false });
    if (err2) return NextResponse.json({ error: "Query failed" }, { status: 500 });
    return NextResponse.json(simple ?? []);
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = svc();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const driverId = body.driver_id as string | undefined;
  const platform = (body.platform as string) ?? "google";
  if (!driverId) {
    return NextResponse.json({ error: "driver_id required" }, { status: 400 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

  const { data: driver } = await supabase
    .from("hired_drivers")
    .select("id, lead_id")
    .eq("id", driverId)
    .single();
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const { data: lead } = await supabase
    .from("driver_leads")
    .select("full_name, phone")
    .eq("id", driver.lead_id)
    .single();
  if (!lead?.phone) return NextResponse.json({ error: "No phone for driver" }, { status: 400 });

  const firstName = lead.full_name?.split(" ")[0] ?? "Driver";
  const googleLink = process.env.GOOGLE_REVIEW_LINK ?? "https://g.page/macotransport/review";
  const msg = platform === "google"
    ? `Hey ${firstName}, we'd love your honest Google review — it helps other drivers find Maco! ${googleLink}`
    : `Hey ${firstName}, would you leave us a quick review on Facebook? It really helps the team!`;

  await sendSMS(lead.phone, msg);

  const { data: rr, error } = await supabase
    .from("review_requests")
    .insert({
      org_id: org.id,
      driver_id: driverId,
      platform,
      sent_via: "sms",
      sent_at: new Date().toISOString(),
      opened: false,
      clicked: false,
      submitted: false,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json(rr, { status: 201 });
}
