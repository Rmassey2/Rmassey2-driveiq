import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const supabase = svc();
  const status = req.nextUrl.searchParams.get("status") || "pending";

  let query = supabase
    .from("cmo_inbox_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") {
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
  const item_type = body.item_type as string | undefined;
  if (!title || !item_type) {
    return NextResponse.json(
      { error: "title and item_type required" },
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

  // Accept both new and legacy field names from callers.
  const action_description =
    (body.action_description as string | undefined) ??
    (body.description as string | undefined) ??
    title;
  const reasoning =
    (body.reasoning as string | undefined) ?? action_description;
  const data_points =
    (body.data_points as Record<string, unknown> | undefined) ??
    (body.meta as Record<string, unknown> | undefined) ??
    null;

  const { data, error } = await supabase
    .from("cmo_inbox_items")
    .insert({
      org_id: org.id,
      item_type,
      title,
      action_description,
      reasoning,
      priority: (body.priority as string) ?? "medium",
      status: "pending",
      data_points,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(data, { status: 201 });
}
