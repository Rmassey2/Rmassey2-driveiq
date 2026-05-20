import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET() {
  const supabase = svc();
  const { data, error } = await supabase
    .from("ai_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
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

  // Accept both new (campaign_name, ad_copy_headline, ad_copy_body, cta_text,
  // target_audience) and legacy (name, headline, body, cta,
  // targeting_suggestion) keys so older callers keep working.
  const campaign_name =
    (body.campaign_name as string | undefined) ?? (body.name as string | undefined);
  if (!campaign_name) {
    return NextResponse.json(
      { error: "campaign_name (or name) required" },
      { status: 400 }
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();
  if (!org)
    return NextResponse.json({ error: "Org not found" }, { status: 500 });

  const { data, error } = await supabase
    .from("ai_campaigns")
    .insert({
      org_id: org.id,
      campaign_name,
      segment: (body.segment as string) ?? null,
      platform: (body.platform as string) ?? "facebook",
      status: (body.status as string) ?? "draft",
      ad_copy_headline:
        (body.ad_copy_headline as string | undefined) ??
        (body.headline as string | undefined) ??
        null,
      ad_copy_body:
        (body.ad_copy_body as string | undefined) ??
        (body.body as string | undefined) ??
        null,
      cta_text:
        (body.cta_text as string | undefined) ??
        (body.cta as string | undefined) ??
        null,
      target_audience:
        (body.target_audience as string | undefined) ??
        (body.targeting_suggestion as string | undefined) ??
        null,
      apply_link: (body.apply_link as string) ?? null,
      utm_campaign: (body.utm_campaign as string) ?? null,
      ai_generated: body.ai_generated === undefined ? false : !!body.ai_generated,
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json(
      { error: error.message ?? "Insert failed" },
      { status: 500 }
    );
  return NextResponse.json(data, { status: 201 });
}
