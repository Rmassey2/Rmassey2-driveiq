import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/supabase/service";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const ALLOWED_EVENTS = new Set([
  "page_view",
  "form_start",
  "form_submit",
  "form_error",
]);

function trim(value: unknown, max = 512): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v.length > max ? v.slice(0, max) : v;
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  // Hash with a per-day salt so we can dedupe within a day without storing PII.
  const salt = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  const event_type = trim(body.event_type, 32);
  const session_id = trim(body.session_id, 128);
  if (!event_type || !ALLOWED_EVENTS.has(event_type)) {
    return NextResponse.json({ ok: false, error: "invalid event_type" }, { status: 400, headers: corsHeaders });
  }
  if (!session_id) {
    return NextResponse.json({ ok: false, error: "session_id required" }, { status: 400, headers: corsHeaders });
  }

  const supabase = svc();

  // Best-effort org lookup; fall back to null so a misconfigured org slug
  // never silently drops events (we'd rather see orphan rows than nothing).
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "maco-transport")
    .maybeSingle();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent");

  const extrasInput = body.extras;
  const extras =
    extrasInput && typeof extrasInput === "object"
      ? (extrasInput as Record<string, unknown>)
      : null;

  const { error } = await supabase.from("landing_page_events").insert({
    org_id: org?.id ?? null,
    session_id,
    event_type,
    path: trim(body.path, 256),
    utm_source: trim(body.utm_source, 128),
    utm_medium: trim(body.utm_medium, 128),
    utm_campaign: trim(body.utm_campaign, 128),
    utm_content: trim(body.utm_content, 128),
    utm_term: trim(body.utm_term, 128),
    referrer: trim(body.referrer, 512),
    user_agent: trim(userAgent, 512),
    ip_hash: hashIp(ip),
    extras,
  });

  if (error) {
    console.error("[track] insert error:", error);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
