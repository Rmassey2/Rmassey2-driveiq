import { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/utils";

interface DedupeResult {
  existingId: string | null;
  matchedOn: string | null;
}

/**
 * Check for duplicate driver leads in priority order:
 * 1. tenstreet_applicant_id
 * 2. phone (normalized)
 * 3. email (lowercased)
 * 4. cdl_number
 */
export async function findDuplicateLead(
  supabase: SupabaseClient,
  opts: {
    tenstreet_applicant_id?: string | null;
    phone?: string | null;
    email?: string | null;
    cdl_number?: string | null;
  }
): Promise<DedupeResult> {
  // 1. Tenstreet Applicant ID
  if (opts.tenstreet_applicant_id) {
    const { data } = await supabase
      .from("driver_leads")
      .select("id")
      .eq("tenstreet_applicant_id", opts.tenstreet_applicant_id)
      .limit(1)
      .maybeSingle();
    if (data) return { existingId: data.id, matchedOn: "tenstreet_applicant_id" };
  }

  // 2. Phone (normalized)
  if (opts.phone) {
    const normalized = normalizePhone(opts.phone);
    if (normalized.length >= 10) {
      const { data } = await supabase
        .from("driver_leads")
        .select("id, phone")
        .limit(100);
      // Normalize stored phones and compare
      const match = (data ?? []).find(
        (row: { id: string; phone: string }) => normalizePhone(row.phone ?? "") === normalized
      );
      if (match) return { existingId: match.id, matchedOn: "phone" };
    }
  }

  // 3. Email (lowercased)
  if (opts.email) {
    const emailLower = opts.email.toLowerCase().trim();
    if (emailLower) {
      const { data } = await supabase
        .from("driver_leads")
        .select("id")
        .ilike("email", emailLower)
        .limit(1)
        .maybeSingle();
      if (data) return { existingId: data.id, matchedOn: "email" };
    }
  }

  // 4. CDL number
  if (opts.cdl_number) {
    const cdl = opts.cdl_number.trim().toUpperCase();
    if (cdl) {
      const { data } = await supabase
        .from("driver_leads")
        .select("id")
        .ilike("cdl_number", cdl)
        .limit(1)
        .maybeSingle();
      if (data) return { existingId: data.id, matchedOn: "cdl_number" };
    }
  }

  return { existingId: null, matchedOn: null };
}

/**
 * Check if any DNH-flagged lead matches by phone, email, or CDL number.
 * Returns the matching DNH lead ID if found, null otherwise.
 */
export async function checkDNH(
  supabase: SupabaseClient,
  opts: {
    phone?: string | null;
    email?: string | null;
    cdl_number?: string | null;
  }
): Promise<{ blocked: boolean; matchedOn: string | null; matchedId: string | null }> {
  // Phone match
  if (opts.phone) {
    const normalized = normalizePhone(opts.phone);
    if (normalized.length >= 10) {
      const { data } = await supabase
        .from("driver_leads")
        .select("id, phone")
        .eq("do_not_hire", true)
        .limit(200);
      const match = (data ?? []).find(
        (row: { id: string; phone: string }) => normalizePhone(row.phone ?? "") === normalized
      );
      if (match) return { blocked: true, matchedOn: "phone", matchedId: match.id };
    }
  }

  // Email match
  if (opts.email) {
    const emailLower = opts.email.toLowerCase().trim();
    if (emailLower) {
      const { data } = await supabase
        .from("driver_leads")
        .select("id")
        .eq("do_not_hire", true)
        .ilike("email", emailLower)
        .limit(1)
        .maybeSingle();
      if (data) return { blocked: true, matchedOn: "email", matchedId: data.id };
    }
  }

  // CDL match
  if (opts.cdl_number) {
    const cdl = opts.cdl_number.trim().toUpperCase();
    if (cdl) {
      const { data } = await supabase
        .from("driver_leads")
        .select("id")
        .eq("do_not_hire", true)
        .ilike("cdl_number", cdl)
        .limit(1)
        .maybeSingle();
      if (data) return { blocked: true, matchedOn: "cdl_number", matchedId: data.id };
    }
  }

  return { blocked: false, matchedOn: null, matchedId: null };
}
