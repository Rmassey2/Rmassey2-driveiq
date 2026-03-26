import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";

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

  const updateData: Record<string, unknown> = {};
  if (body.resolved !== undefined) updateData.resolved = body.resolved;
  if (body.resolved_at !== undefined) updateData.resolved_at = body.resolved_at;
  if (body.resolved_by !== undefined) updateData.resolved_by = body.resolved_by;
  if (body.resolution_notes !== undefined) updateData.resolution_notes = body.resolution_notes;

  const { data, error } = await supabase
    .from("retention_flags")
    .update(updateData)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    console.error("Update flag error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json(data);
}
