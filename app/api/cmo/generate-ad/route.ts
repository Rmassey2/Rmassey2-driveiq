import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

const SYSTEM_PROMPT = `You are an expert trucking recruiter copywriter for Maco Transport, a Memphis TN-based asset trucking company.

Key selling points:
- New 2024 Freightliners
- Up to 61 cents/mile
- 2,500+ miles/week guaranteed
- Home time guaranteed (weekends for Regional/Local, bi-weekly for OTR)
- No touch freight
- 75% medical paid by company
- 401k match
- $500 referral bonus ($250 at first dispatch, $250 at 90 days)

You write compelling Facebook/social media ad copy that speaks directly to CDL-A drivers.
Always respond with valid JSON only — no markdown, no code fences.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const segment = (body.segment as string) ?? "OTR";
  const ad_type = (body.ad_type as string) ?? "Job Opening";

  const userPrompt = `Generate a Facebook ad for Maco Transport targeting ${segment} drivers.
Ad type: ${ad_type}

Return a JSON object with these exact keys:
{
  "headline": "short attention-grabbing headline (under 40 chars)",
  "body": "compelling ad body copy (2-3 sentences, under 200 chars)",
  "cta": "call to action text (under 30 chars)",
  "targeting_suggestion": "Facebook targeting recommendation for this segment"
}`;

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
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errData = await res.json();
      return NextResponse.json(
        { error: errData.error?.message ?? "Claude API error" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    let adJson: {
      headline: string;
      body: string;
      cta: string;
      targeting_suggestion: string;
    };
    try {
      adJson = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Claude response", raw: text },
        { status: 502 }
      );
    }

    // Save to ai_campaigns
    const supabase = svc();
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "maco-transport")
      .single();

    if (org) {
      await supabase.from("ai_campaigns").insert({
        org_id: org.id,
        name: `${segment} - ${ad_type}`,
        segment,
        ad_type,
        headline: adJson.headline,
        body: adJson.body,
        cta: adJson.cta,
        targeting_suggestion: adJson.targeting_suggestion,
        platform: "facebook",
        status: "draft",
      });
    }

    return NextResponse.json(adJson);
  } catch (err) {
    return NextResponse.json(
      { error: `Claude API request failed: ${String(err)}` },
      { status: 502 }
    );
  }
}
