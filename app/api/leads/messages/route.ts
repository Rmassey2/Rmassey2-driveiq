import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Inbound SMS replies for a specific lead — surfaced on the slide-over
// Call Log tab so the recruiter can see what the driver said in-app.
export async function GET(req: NextRequest) {
  const supabase = svc();
  const leadId = req.nextUrl.searchParams.get("lead_id");
  if (!leadId) {
    return NextResponse.json({ error: "lead_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("inbound_messages")
    .select("id, from_phone, body, forwarded_to_recruiter, occurred_at")
    .eq("matched_lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[api/leads/messages] Query error:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
