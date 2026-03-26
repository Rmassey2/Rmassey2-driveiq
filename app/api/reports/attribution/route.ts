import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const supabase = svc();
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

  // Get all leads in date range
  const { data: leads } = await supabase
    .from("driver_leads")
    .select("id, source_channel, disposition, pipeline_stage, created_at")
    .eq("org_id", org.id)
    .gte("created_at", cutoffStr);

  // Get all hires in date range
  const { data: hires } = await supabase
    .from("hired_drivers")
    .select("id, lead_id, hire_date")
    .eq("org_id", org.id)
    .gte("hire_date", cutoffStr.split("T")[0]);

  const hireLeadIds = new Set((hires ?? []).map((h) => h.lead_id));

  // Group by source channel
  const channels: Record<string, { leads: number; apps: number; hires: number }> = {};
  for (const lead of leads ?? []) {
    const ch = lead.source_channel ?? "Direct";
    if (!channels[ch]) channels[ch] = { leads: 0, apps: 0, hires: 0 };
    channels[ch].leads++;
    // pipeline_stage >= 3 counts as "app started"
    if (lead.pipeline_stage >= 3) channels[ch].apps++;
    if (hireLeadIds.has(lead.id)) channels[ch].hires++;
  }

  const totalLeads = (leads ?? []).length;
  const totalApps = (leads ?? []).filter((l) => l.pipeline_stage >= 3).length;
  const totalHires = hires?.length ?? 0;

  // Build channel rows
  const channelRows = Object.entries(channels).map(([channel, stats]) => ({
    channel,
    leads: stats.leads,
    apps: stats.apps,
    hires: stats.hires,
    lead_to_app_pct: stats.leads > 0 ? Math.round((stats.apps / stats.leads) * 100) : 0,
    app_to_hire_pct: stats.apps > 0 ? Math.round((stats.hires / stats.apps) * 100) : 0,
    lead_to_hire_pct: stats.leads > 0 ? Math.round((stats.hires / stats.leads) * 100) : 0,
  }));

  // Determine best channel by lead-to-hire %
  const bestChannel = channelRows.length > 0
    ? channelRows.reduce((a, b) => (b.lead_to_hire_pct > a.lead_to_hire_pct ? b : a)).channel
    : "N/A";

  return NextResponse.json({
    days,
    total_leads: totalLeads,
    total_apps: totalApps,
    total_hires: totalHires,
    best_channel: bestChannel,
    channels: channelRows.sort((a, b) => b.leads - a.leads),
  });
}
