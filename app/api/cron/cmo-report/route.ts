import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/resend";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = svc();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

  // Prior month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const monthLabel = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

  // Leads by source
  const { data: leads } = await supabase
    .from("driver_leads")
    .select("id, source_channel, disposition, pipeline_stage")
    .eq("org_id", org.id)
    .gte("created_at", monthStart.toISOString())
    .lte("created_at", monthEnd.toISOString());

  const totalLeads = leads?.length ?? 0;
  const totalApps = (leads ?? []).filter((l) => l.pipeline_stage >= 3).length;

  // Hires
  const { data: hires } = await supabase
    .from("hired_drivers")
    .select("id, hire_date, status")
    .eq("org_id", org.id)
    .gte("hire_date", monthStart.toISOString().split("T")[0])
    .lte("hire_date", monthEnd.toISOString().split("T")[0]);
  const totalHires = hires?.length ?? 0;

  // Separations
  const { data: seps } = await supabase
    .from("hired_drivers")
    .select("id, departure_reason")
    .eq("org_id", org.id)
    .eq("status", "separated")
    .gte("separation_date", monthStart.toISOString().split("T")[0])
    .lte("separation_date", monthEnd.toISOString().split("T")[0]);
  const totalSeps = seps?.length ?? 0;

  const departureCounts: Record<string, number> = {};
  for (const s of seps ?? []) {
    const reason = (s.departure_reason as string) ?? "Unknown";
    departureCounts[reason] = (departureCounts[reason] ?? 0) + 1;
  }
  const topDepartureReason = Object.entries(departureCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

  // Review requests
  const { data: reviews } = await supabase
    .from("review_requests")
    .select("id, clicked, submitted")
    .eq("org_id", org.id)
    .gte("sent_at", monthStart.toISOString())
    .lte("sent_at", monthEnd.toISOString());
  const totalReviews = reviews?.length ?? 0;
  const reviewClicks = (reviews ?? []).filter((r) => r.clicked).length;
  const reviewCtr = totalReviews > 0 ? Math.round((reviewClicks / totalReviews) * 100) : 0;

  // Source breakdown
  const sourceBreakdown: Record<string, { leads: number; hires: number }> = {};
  for (const l of leads ?? []) {
    const ch = (l.source_channel as string) ?? "Direct";
    if (!sourceBreakdown[ch]) sourceBreakdown[ch] = { leads: 0, hires: 0 };
    sourceBreakdown[ch].leads++;
  }
  const hireLeadIds = new Set((hires ?? []).map((h) => h.id));
  for (const l of leads ?? []) {
    if (hireLeadIds.has(l.id)) {
      const ch = (l.source_channel as string) ?? "Direct";
      if (sourceBreakdown[ch]) sourceBreakdown[ch].hires++;
    }
  }

  const metrics = {
    month: monthLabel,
    total_leads: totalLeads,
    total_apps: totalApps,
    total_hires: totalHires,
    total_separations: totalSeps,
    top_departure_reason: topDepartureReason,
    review_requests_sent: totalReviews,
    review_ctr_pct: reviewCtr,
    sources: sourceBreakdown,
  };

  // Call Claude for executive summary
  let summary = `${monthLabel}: ${totalLeads} leads, ${totalApps} apps, ${totalHires} hires, ${totalSeps} separations.`;
  let recommendations: { priority: string; recommendation: string; urgency: string }[] = [];

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
          max_tokens: 1024,
          system: "You are the AI CMO for Maco Transport, a Memphis TN trucking company. Analyze recruiting metrics and provide actionable insights. Respond with valid JSON only — no markdown, no code fences.",
          messages: [{
            role: "user",
            content: `Here are last month's recruiting metrics:\n${JSON.stringify(metrics, null, 2)}\n\nReturn JSON:\n{"summary":"2-3 sentence executive summary","recommendations":[{"priority":"high|medium|low","recommendation":"specific action","urgency":"this week|this month|this quarter"}]}`,
          }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text ?? "";
        try {
          const parsed = JSON.parse(text);
          if (parsed.summary) summary = parsed.summary;
          if (Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations;
        } catch { /* use defaults */ }
      }
    } catch { /* use defaults */ }
  }

  if (recommendations.length === 0) {
    recommendations = [
      { priority: "medium", recommendation: "Review source channel performance and reallocate budget to top performers", urgency: "this month" },
      { priority: "medium", recommendation: "Audit drip campaign reply rates and refresh underperforming messages", urgency: "this month" },
      { priority: "low", recommendation: "Analyze departure reasons and address top cause proactively", urgency: "this quarter" },
    ];
  }

  // Save report
  const { data: report, error } = await supabase
    .from("cmo_reports")
    .insert({
      org_id: org.id,
      report_month: monthLabel,
      summary,
      recommendations,
      metrics,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save report", detail: error.message }, { status: 500 });
  }

  // Send email to admin
  const htmlBody = `
    <h2>Monthly CMO Report — ${monthLabel}</h2>
    <h3>Executive Summary</h3>
    <p>${summary}</p>
    <h3>Key Metrics</h3>
    <ul>
      <li>Leads: ${totalLeads}</li>
      <li>Applications: ${totalApps}</li>
      <li>Hires: ${totalHires}</li>
      <li>Separations: ${totalSeps}</li>
      <li>Top Departure Reason: ${topDepartureReason}</li>
      <li>Review Requests Sent: ${totalReviews} (CTR: ${reviewCtr}%)</li>
    </ul>
    <h3>Recommendations</h3>
    <ol>
      ${recommendations.map((r) => `<li><strong>[${r.priority.toUpperCase()}]</strong> ${r.recommendation} <em>(${r.urgency})</em></li>`).join("")}
    </ol>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://driveiq-virid.vercel.app"}/dashboard/reports/cmo-report">View Full Report in DriveIQ</a></p>
  `;

  await sendEmail("rmassey@macotransport.com", `DriveIQ CMO Report — ${monthLabel}`, htmlBody);

  return NextResponse.json({ success: true, report_id: report?.id, summary, recommendations });
}
