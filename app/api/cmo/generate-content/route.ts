import { NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

const SYSTEM_PROMPT = `You are a social media content manager for Maco Transport, a Memphis TN-based asset trucking company.

You create engaging Facebook/social media posts for driver recruiting.

Key facts about Maco Transport:
- New 2024 Freightliners
- Up to 61 cents/mile, 2,500+ miles/week
- Home time guaranteed
- No touch freight
- 75% medical paid, 401k match
- $500 referral bonus
- Segments: OTR, Regional, Local, Dedicated, Owner-Op

Always respond with valid JSON only — no markdown, no code fences.`;

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday

  const userPrompt = `Generate a week of social media content for Maco Transport's Facebook page, starting ${weekStart.toISOString().split("T")[0]}.

Create exactly 4 posts:
1. A job opening post for OTR drivers
2. A job opening post for Regional drivers
3. A job opening post for Local drivers
4. A driver spotlight/culture post celebrating team drivers

For each post return:
{
  "post_type": "job_post" or "driver_spotlight",
  "title": "short internal title for the post",
  "body": "the full social media post text (150-250 words, include emojis, hashtags)",
  "platform": "facebook",
  "day_offset": 0-6 (0=Monday, 1=Tuesday, etc.)
}

Return a JSON array of 4 objects.`;

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
        max_tokens: 2048,
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

    let posts: {
      post_type: string;
      title: string;
      body: string;
      platform: string;
      day_offset: number;
    }[];
    try {
      posts = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Claude response", raw: text },
        { status: 502 }
      );
    }

    if (!Array.isArray(posts)) {
      return NextResponse.json(
        { error: "Expected array from Claude", raw: text },
        { status: 502 }
      );
    }

    // Save to content_posts
    const supabase = svc();
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "maco-transport")
      .single();

    if (!org) {
      return NextResponse.json({ error: "Org not found" }, { status: 500 });
    }

    const rows = posts.map((p) => {
      const schedDate = new Date(weekStart);
      schedDate.setDate(schedDate.getDate() + (p.day_offset ?? 0));
      return {
        org_id: org.id,
        post_type: p.post_type,
        title: p.title,
        body: p.body,
        platform: p.platform ?? "facebook",
        scheduled_for: schedDate.toISOString().split("T")[0],
        status: "draft",
      };
    });

    const { data: inserted, error } = await supabase
      .from("content_posts")
      .insert(rows)
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: "Failed to save posts", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      posts_created: inserted?.length ?? 0,
      posts: inserted,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Claude API request failed: ${String(err)}` },
      { status: 502 }
    );
  }
}
