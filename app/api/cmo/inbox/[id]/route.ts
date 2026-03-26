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

  const allowedStatuses = ["approved", "edited", "dismissed"];
  const status = body.status as string | undefined;
  if (status && !allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${allowedStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (status) updateData.status = status;
  if (body.description !== undefined)
    updateData.description = body.description;
  if (body.meta !== undefined) updateData.meta = body.meta;

  const { data, error } = await supabase
    .from("cmo_inbox_items")
    .update(updateData)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !data)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json(data);
}
