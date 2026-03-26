import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const supabase = svc();
  const status = req.nextUrl.searchParams.get("status");

  let query = supabase
    .from("content_posts")
    .select("*")
    .order("scheduled_for", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
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

  const title = body.title as string | undefined;
  const postBody = body.body as string | undefined;
  if (!title || !postBody) {
    return NextResponse.json(
      { error: "title and body required" },
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
    .from("content_posts")
    .insert({
      org_id: org.id,
      post_type: (body.post_type as string) ?? "job_post",
      title,
      body: postBody,
      platform: (body.platform as string) ?? "facebook",
      scheduled_for: (body.scheduled_for as string) ?? null,
      status: (body.status as string) ?? "draft",
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
