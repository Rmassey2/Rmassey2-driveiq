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

  const name = body.name as string | undefined;
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
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
      name,
      segment: (body.segment as string) ?? null,
      ad_type: (body.ad_type as string) ?? null,
      headline: (body.headline as string) ?? null,
      body: (body.body as string) ?? null,
      cta: (body.cta as string) ?? null,
      targeting_suggestion: (body.targeting_suggestion as string) ?? null,
      platform: (body.platform as string) ?? "facebook",
      status: (body.status as string) ?? "draft",
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
