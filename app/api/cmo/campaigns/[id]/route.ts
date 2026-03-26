import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = svc();
  const { data, error } = await supabase
    .from("ai_campaigns")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = svc();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    ...body,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("ai_campaigns")
    .update(updateData)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !data)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json(data);
}
