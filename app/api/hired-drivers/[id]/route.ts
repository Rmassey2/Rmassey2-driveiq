import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = svc();
  const { data, error } = await supabase
    .from("hired_drivers")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const { data, error } = await supabase
    .from("hired_drivers")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    console.error("Update hired_driver error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json(data);
}
