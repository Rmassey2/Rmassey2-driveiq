import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = svc();
  const userClient = createClient();
  const { data: { user } } = await userClient.auth.getUser();

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

  const updateData: Record<string, unknown> = {};
  if (status) {
    updateData.status = status;
    if (status === "approved" && user) {
      updateData.approved_by = user.id;
      updateData.approved_at = new Date().toISOString();
    }
  }
  // Accept both new (action_description, data_points) and legacy
  // (description, meta) keys from older callers.
  if (body.action_description !== undefined)
    updateData.action_description = body.action_description;
  else if (body.description !== undefined)
    updateData.action_description = body.description;

  if (body.reasoning !== undefined) updateData.reasoning = body.reasoning;

  if (body.data_points !== undefined) updateData.data_points = body.data_points;
  else if (body.meta !== undefined) updateData.data_points = body.meta;

  const { data, error } = await supabase
    .from("cmo_inbox_items")
    .update(updateData)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}
