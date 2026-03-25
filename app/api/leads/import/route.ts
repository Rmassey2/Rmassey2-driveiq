import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

function mapSource(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("indeed")) return "indeed";
  if (s.includes("zip")) return "ziprecruiter";
  if (s.includes("facebook") || s.includes("meta")) return "facebook";
  if (s.includes("google")) return "google";
  if (s.includes("referral")) return "referral";
  if (s.includes("company") || s.includes("website")) return "website";
  return "job_board";
}

export async function POST(req: NextRequest) {
  const supabase = svc();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Empty or invalid CSV" }, { status: 400 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();

  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const firstName = row["First Name"] ?? "";
    const lastName = row["Last Name"] ?? "";
    const phone = (row["Phone"] ?? "").replace(/\D/g, "");
    const email = row["Email"] ?? "";
    const applicantId = row["Applicant ID"] ?? "";
    const status = row["Status"] ?? "";
    const source = row["Source"] ?? "";

    if (!phone && !email) {
      skipped++;
      continue;
    }

    let existing: { id: string } | null = null;
    if (phone) {
      const { data } = await supabase
        .from("driver_leads")
        .select("id")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      existing = data;
    }
    if (!existing && email) {
      const { data } = await supabase
        .from("driver_leads")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      const updateFields: Record<string, string> = {};
      if (applicantId) updateFields.tenstreet_applicant_id = applicantId;
      if (status) updateFields.tenstreet_status = status;
      updateFields.updated_at = new Date().toISOString();

      await supabase
        .from("driver_leads")
        .update(updateFields)
        .eq("id", existing.id);
      updated++;
    } else {
      const fullName = `${firstName} ${lastName}`.trim();
      await supabase.from("driver_leads").insert({
        org_id: org.id,
        full_name: fullName || "Unknown",
        phone: phone || null,
        email: email || null,
        tenstreet_applicant_id: applicantId || null,
        tenstreet_status: status || null,
        entry_point: "tenstreet_direct",
        source_channel: source ? mapSource(source) : "job_board",
        lead_score: 0,
        pipeline_stage: 1,
        disposition: "active",
        cold_flag: false,
        do_not_hire: false,
      });
      created++;
    }
  }

  await supabase.from("tenstreet_sync_log").insert({
    org_id: org.id,
    sync_type: "csv_import",
    records_processed: rows.length,
    records_created: created,
    records_updated: updated,
    records_skipped: skipped,
  });

  return NextResponse.json({ processed: rows.length, created, updated, skipped });
}
