import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { sendYellowAlert, sendRedAlert } from "@/lib/alerts";

export async function POST(req: NextRequest) {
  const supabase = svc();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const alertType = body.alert_type as string;
  const driverId = body.driver_id as string;
  const orgId = body.org_id as string;
  const driverName = body.driver_name as string;
  const score = body.score as number;
  const dmPhone = (body.dm_phone as string) ?? null;
  const flags = (body.flags as { trigger_type: string; risk_points: number }[]) ?? [];

  if (alertType === "yellow") {
    await sendYellowAlert(supabase, orgId, driverId, driverName, score, dmPhone);
  } else if (alertType === "red") {
    await sendRedAlert(supabase, orgId, driverId, driverName, score, flags, dmPhone);
  }

  return NextResponse.json({ success: true });
}
