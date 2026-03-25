import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const supabase = svc();

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = [30, 60, 90, 180].includes(Number(daysParam)) ? Number(daysParam) : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Get org — for now use Maco Transport
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();

  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 500 });
  }

  const { data: leads, error } = await supabase
    .from("driver_leads")
    .select("source_channel, disposition, tenstreet_applicant_id")
    .eq("org_id", org.id)
    .gte("created_at", since);

  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const channels: Record<
    string,
    { leads: number; apps: number; hires: number }
  > = {};

  for (const lead of leads ?? []) {
    const ch = lead.source_channel ?? "unknown";
    if (!channels[ch]) channels[ch] = { leads: 0, apps: 0, hires: 0 };
    channels[ch].leads++;
    if (lead.tenstreet_applicant_id) channels[ch].apps++;
    if (lead.disposition === "hired") channels[ch].hires++;
  }

  const result = Object.entries(channels).map(([channel, stats]) => ({
    channel,
    ...stats,
    conversion_pct:
      stats.leads > 0
        ? Math.round((stats.hires / stats.leads) * 1000) / 10
        : 0,
  }));

  return NextResponse.json({ days, data: result });
}
