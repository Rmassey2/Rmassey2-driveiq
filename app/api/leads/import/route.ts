import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
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
    // Handle quoted fields with commas inside them
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

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

/** Parse "Last, First" format into { first, last } */
function parseLastCommaFirst(name: string): { first: string; last: string } {
  const parts = name.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    return { first: parts[1], last: parts[0] };
  }
  // Fallback: treat as "First Last"
  const spaceParts = name.trim().split(/\s+/);
  return { first: spaceParts[0] ?? "", last: spaceParts.slice(1).join(" ") };
}

/** Map Tenstreet Worklist to segment_interest */
function mapWorklist(worklist: string): string | null {
  const w = worklist.toLowerCase().trim();
  if (w.includes("contractor for owner") || w.includes("owner operator") || w.includes("owner-op")) {
    return "Owner-Op";
  }
  if (w.includes("company driver")) return null; // unassigned
  if (w.includes("regional")) return "Regional";
  if (w.includes("local")) return "Local";
  if (w.includes("dedicated")) return "Dedicated";
  if (w.includes("otr")) return "OTR";
  return null;
}

/** Map Tenstreet Status to DriveIQ disposition + cold_flag */
function mapStatus(status: string): { disposition: string; coldFlag: boolean } {
  const s = status.toLowerCase().trim();
  if (s.includes("no response") || s.includes("no answer") || s.includes("unreachable")) {
    return { disposition: "active", coldFlag: true };
  }
  if (s.includes("recruiting") || s.includes("attempting") || s.includes("wants local") || s.includes("new lead") || s.includes("pending")) {
    return { disposition: "active", coldFlag: false };
  }
  if (s.includes("hired") || s.includes("orientation")) {
    return { disposition: "hired", coldFlag: false };
  }
  if (s.includes("not qualified") || s.includes("dq") || s.includes("disqualif")) {
    return { disposition: "archived", coldFlag: false };
  }
  if (s.includes("withdrew") || s.includes("declined") || s.includes("not interested")) {
    return { disposition: "withdrew", coldFlag: false };
  }
  return { disposition: "active", coldFlag: false };
}

export async function POST(req: NextRequest) {
  const supabase = svc();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const fileName = file.name.toLowerCase();
  const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel";

  let rows: Record<string, string>[];

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return NextResponse.json({ error: "Empty spreadsheet" }, { status: 400 });
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]);
    // Convert all values to strings
    rows = rawRows.map((row) => {
      const stringRow: Record<string, string> = {};
      for (const [key, val] of Object.entries(row)) {
        stringRow[key] = val != null ? String(val) : "";
      }
      return stringRow;
    });
  } else {
    const text = await file.text();
    rows = parseCSV(text);
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "Empty or invalid file" }, { status: 400 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .single();

  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 500 });

  // Pre-fetch org members for recruiter matching
  const { data: orgMembers } = await supabase
    .from("org_members")
    .select("id, full_name, role")
    .eq("org_id", org.id)
    .eq("is_active", true);

  const defaultRecruiter = (orgMembers ?? []).find((m) => m.role === "recruiter");

  function matchRecruiter(recruiterName: string): string | null {
    if (!recruiterName) return defaultRecruiter?.id ?? null;
    // Tenstreet format: "Last, First"
    const parsed = parseLastCommaFirst(recruiterName);
    const searchName = `${parsed.first} ${parsed.last}`.toLowerCase().trim();
    const match = (orgMembers ?? []).find((m) =>
      m.full_name.toLowerCase().trim() === searchName
    );
    return match?.id ?? defaultRecruiter?.id ?? null;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let dnhBlocked = 0;

  for (const row of rows) {
    // --- Extract fields with column name variations ---

    // Name: try "First Name"/"Last Name" first, then "Name" (Last, First)
    let firstName = row["First Name"] ?? "";
    let lastName = row["Last Name"] ?? "";
    if (!firstName && !lastName && row["Name"]) {
      const parsed = parseLastCommaFirst(row["Name"]);
      firstName = parsed.first;
      lastName = parsed.last;
    }

    // Phone: "Phone" or "Pri Phone"
    const phoneRaw = row["Phone"] ?? row["Pri Phone"] ?? "";
    const phone = normalizePhone(phoneRaw);

    const email = (row["Email"] ?? "").toLowerCase().trim();
    const applicantId = row["Applicant ID"] ?? "";
    const statusRaw = row["Status"] ?? "";
    const source = row["Source"] ?? "";
    const cdlNumber = row["CDL Number"] ?? row["CDL"] ?? "";
    const worklist = row["Worklist"] ?? "";
    const recruiterName = row["Recruiter"] ?? "";
    const dob = row["DOB"] ?? "";

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

    // Map status and segment
    const { disposition, coldFlag } = statusRaw ? mapStatus(statusRaw) : { disposition: "active", coldFlag: false };
    const segment = worklist ? mapWorklist(worklist) : null;
    const recruiterId = matchRecruiter(recruiterName);

    // Build notes with DOB if provided
    const noteParts: string[] = [];
    if (dob) noteParts.push(`DOB: ${dob}`);
    const notes = noteParts.length > 0 ? noteParts.join("; ") : null;

    if (dup.existingId) {
      const updateFields: Record<string, unknown> = {};
      if (applicantId) updateFields.tenstreet_applicant_id = applicantId;
      if (statusRaw) updateFields.tenstreet_status = statusRaw;
      if (cdlNumber) updateFields.cdl_number = cdlNumber;
      if (segment) updateFields.segment_interest = segment;
      if (recruiterId) updateFields.recruiter_id = recruiterId;
      if (notes) updateFields.notes = notes;
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
        tenstreet_status: statusRaw || null,
        segment_interest: segment,
        recruiter_id: recruiterId,
        entry_point: "tenstreet_direct",
        source_channel: source ? mapSource(source) : "job_board",
        lead_score: 0,
        pipeline_stage: 1,
        disposition,
        cold_flag: coldFlag,
        do_not_hire: false,
        notes,
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
