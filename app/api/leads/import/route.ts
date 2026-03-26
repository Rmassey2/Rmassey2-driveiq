import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/utils";
import { findDuplicateLead, checkDNH } from "@/lib/dedup";

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
  let dnhBlocked = 0;

  for (const row of rows) {
    const firstName = row["First Name"] ?? "";
    const lastName = row["Last Name"] ?? "";
    const phone = normalizePhone(row["Phone"] ?? "");
    const email = (row["Email"] ?? "").toLowerCase().trim();
    const applicantId = row["Applicant ID"] ?? "";
    const status = row["Status"] ?? "";
    const source = row["Source"] ?? "";
    const cdlNumber = row["CDL Number"] ?? row["CDL"] ?? "";

    if (!phone && !email) {
      skipped++;
      continue;
    }

    // DNH check
    const dnh = await checkDNH(supabase, {
      phone: phone || null,
      email: email || null,
      cdl_number: cdlNumber || null,
    });
    if (dnh.blocked) {
      const fullName = `${firstName} ${lastName}`.trim();
      await supabase.from("autonomous_actions").insert({
        org_id: org.id,
        action_type: "dnh_block",
        description: `Blocked CSV import "${fullName}" — matches DNH record on ${dnh.matchedOn}`,
        reasoning: `DNH match on ${dnh.matchedOn}, existing lead ID: ${dnh.matchedId}`,
        affected_record_id: dnh.matchedId,
        affected_table: "driver_leads",
      });
      dnhBlocked++;
      continue;
    }

    // Dedup check
    const dup = await findDuplicateLead(supabase, {
      tenstreet_applicant_id: applicantId || null,
      phone: phone || null,
      email: email || null,
      cdl_number: cdlNumber || null,
    });

    if (dup.existingId) {
      const updateFields: Record<string, string> = {};
      if (applicantId) updateFields.tenstreet_applicant_id = applicantId;
      if (status) updateFields.tenstreet_status = status;
      if (cdlNumber) updateFields.cdl_number = cdlNumber;
      updateFields.updated_at = new Date().toISOString();

      await supabase
        .from("driver_leads")
        .update(updateFields)
        .eq("id", dup.existingId);
      updated++;
    } else {
      const fullName = `${firstName} ${lastName}`.trim();
      await supabase.from("driver_leads").insert({
        org_id: org.id,
        full_name: fullName || "Unknown",
        phone: phone || null,
        email: email || null,
        cdl_number: cdlNumber || null,
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

  return NextResponse.json({ processed: rows.length, created, updated, skipped, dnh_blocked: dnhBlocked });
}
