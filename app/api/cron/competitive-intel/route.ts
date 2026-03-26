import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const supabase = svc();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

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
        system: "You are a competitive intelligence analyst for Maco Transport, a Memphis TN trucking company competing for CDL-A drivers. Respond with valid JSON only — no markdown, no code fences.",
        messages: [{
          role: "user",
          content: `Search for recent CDL recruiting news and competitor activity in the Memphis TN market. Competitors: Werner, Schneider, JB Hunt, Swift, and regional carriers.

Look for:
- Sign-on bonus changes
- Pay increases or decreases
- Home time policy changes
- New terminal openings or closures near Memphis
- Major fleet expansions or contractions

If you find significant competitive intelligence, return JSON:
{"status":"SIGNIFICANT","findings":[{"competitor":"name","intel_type":"pay_change|bonus_change|policy_change|expansion|other","description":"what changed","significance":"high|medium|low"}]}

If nothing significant, return: {"status":"NO_SIGNIFICANT_INTEL","findings":[]}`,
        }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Claude API error" }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";

    let parsed: { status: string; findings: { competitor: string; intel_type: string; description: string; significance: string }[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Failed to parse Claude response", raw: text }, { status: 502 });
    }

    if (parsed.status === "NO_SIGNIFICANT_INTEL" || !parsed.findings?.length) {
      return NextResponse.json({ status: "no_intel", findings: 0 });
    }

    let saved = 0;
    for (const finding of parsed.findings) {
      const { error } = await supabase.from("competitive_intel").insert({
        org_id: org.id,
        competitor: finding.competitor,
        intel_type: finding.intel_type,
        description: finding.description,
        source: "claude_ai_scan",
        significance: finding.significance,
      });

      if (!error) {
        // Create inbox item for admin review
        await supabase.from("cmo_inbox_items").insert({
          org_id: org.id,
          item_type: "competitive_intel",
          title: `${finding.competitor}: ${finding.intel_type.replace(/_/g, " ")}`,
          description: finding.description,
          priority: finding.significance === "high" ? "high" : "medium",
          status: "pending",
        });
        saved++;
      }
    }

    return NextResponse.json({ status: "intel_found", findings: saved });
  } catch (err) {
    return NextResponse.json({ error: `Request failed: ${String(err)}` }, { status: 502 });
  }
}
