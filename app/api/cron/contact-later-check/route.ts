import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = svc();
  const today = new Date().toISOString().split("T")[0];

  const { data: leads, error } = await supabase
    .from("driver_leads")
    .select("id, full_name, contact_later_reason, notes")
    .eq("disposition", "contact_later")
    .lte("contact_later_date", today);

  if (error) {
    console.error("Contact later check error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let surfaced = 0;

  for (const lead of leads ?? []) {
    const autoNote = `AUTO: Contact Later date reached - ${lead.contact_later_reason ?? "no reason provided"}`;
    const existingNotes = lead.notes ? `${lead.notes}\n${autoNote}` : autoNote;

    await supabase
      .from("driver_leads")
      .update({
        notes: existingNotes,
        cold_flag: false,
        disposition: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    surfaced++;
  }

  return NextResponse.json({ surfaced });
}
