// Client-side helpers for landing-page UTM capture, session identity, and
// funnel event emission. Safe to import in "use client" components; all
// browser-only APIs are guarded so module load on the server is a no-op.

export interface CapturedUtms {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_path: string | null;
}

const UTM_STORAGE_KEY = "maco_utms_v1";
const SESSION_STORAGE_KEY = "maco_session_id_v1";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

function emptyUtms(): CapturedUtms {
  return {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    referrer: null,
    landing_path: null,
  };
}

// Reads utm_* and meta from the current URL. If any utm is present we treat
// the load as the source of truth and overwrite sessionStorage; otherwise we
// preserve whatever was stored (so a second visit within the same session
// keeps its original attribution).
export function captureUtmsFromUrl(): CapturedUtms {
  if (typeof window === "undefined") return emptyUtms();

  const params = new URLSearchParams(window.location.search);
  const fromUrl: CapturedUtms = {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content: params.get("utm_content"),
    utm_term: params.get("utm_term"),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    landing_path: window.location.pathname,
  };

  const hasAnyUtm = UTM_KEYS.some((k) => !!fromUrl[k]);

  if (hasAnyUtm) {
    try {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl));
    } catch {
      // ignore quota / disabled storage
    }
    return fromUrl;
  }

  return getStoredUtms();
}

export function getStoredUtms(): CapturedUtms {
  if (typeof window === "undefined") return emptyUtms();
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return emptyUtms();
    const parsed = JSON.parse(raw) as Partial<CapturedUtms>;
    return { ...emptyUtms(), ...parsed };
  } catch {
    return emptyUtms();
  }
}

// Detects Facebook's in-app browser (FBIOS for iPhone Facebook app, FB4A for
// Android Facebook app, IABMV for both). These browsers strip features that
// break our React form — drivers hit the page, can't interact, bail.
export function isFacebookInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBIOS|FB4A|FB_IAB|IABMV/.test(ua);
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = newSessionId();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return newSessionId();
  }
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type FunnelEventType =
  | "page_view"
  | "form_start"
  | "form_submit"
  | "form_error";

// Fire-and-forget event POST. keepalive lets submit/unload events ship even
// while the page is navigating away.
export async function trackEvent(
  event_type: FunnelEventType,
  extras: Record<string, unknown> = {}
): Promise<void> {
  if (typeof window === "undefined") return;
  const utms = getStoredUtms();
  const body = {
    event_type,
    session_id: getOrCreateSessionId(),
    path: window.location.pathname,
    ...utms,
    extras,
  };
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Funnel tracking is best-effort; never let it block the user.
  }
}
