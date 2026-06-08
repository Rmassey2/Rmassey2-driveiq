"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { captureUtmsFromUrl, getStoredUtms, isFacebookInAppBrowser, trackEvent } from "@/lib/tracking";

const EXP_OPTIONS = [
  { value: "", label: "Years of experience (optional)" },
  { value: "less_than_2", label: "Less than 2 years" },
  { value: "2_3", label: "2–3 years" },
  { value: "4_5", label: "4–5 years" },
  { value: "5_plus", label: "5+ years" },
];

export default function ApplyOwnerOpPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [inFbBrowser, setInFbBrowser] = useState(false);
  const formStartedRef = useRef(false);

  useEffect(() => {
    captureUtmsFromUrl();
    trackEvent("page_view");
    if (isFacebookInAppBrowser()) {
      setInFbBrowser(true);
      trackEvent("form_error", { reason: "fb_in_app_browser_detected" });
    }
  }, []);

  function handleFormStart() {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackEvent("form_start");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const utms = getStoredUtms();
    const payload = {
      formData: {
        name: fd.get("name") as string,
        phone: fd.get("phone") as string,
        email: (fd.get("email") as string) || "",
        "zip-code": (fd.get("zip") as string) || "",
        "do-you-have-a-valid-cdl": fd.get("cdl") as string,
        "years-of-experience": (fd.get("experience") as string) || "",
        "what-type-of-driver-are-you-interested-in-being": "Owner-Op",
        sms_consent: smsConsent,
        utm_source: utms.utm_source ?? "driveiq_landing",
        utm_medium: utms.utm_medium ?? "direct",
        utm_campaign: utms.utm_campaign ?? "owner_operator_apply",
        utm_content: utms.utm_content ?? undefined,
        utm_term: utms.utm_term ?? undefined,
        referrer: utms.referrer ?? undefined,
      },
    };

    try {
      const res = await fetch("/api/webhooks/webflow-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server returned ${res.status}`);
      }
      setSubmitted(true);
      trackEvent("form_submit", { lead_id: data.lead_id ?? null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Something went wrong: ${msg}. Please try again or call us directly.`);
      trackEvent("form_error", { reason: "submit_failed", message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const fieldCls =
    "w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]";

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#d4a843] flex items-center justify-center font-bold text-[#0a1628]">
              M
            </div>
            <span className="text-lg font-bold tracking-tight">MACO Transport</span>
          </div>
          <a
            href="tel:+16628821593"
            className="text-sm font-semibold text-[#d4a843] hover:underline whitespace-nowrap"
          >
            📞 (662) 882-1593
          </a>
        </div>
      </header>

      {inFbBrowser && (
        <div className="bg-[#d4a843] text-[#0a1628] px-4 py-3">
          <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <p className="text-sm font-semibold">
              ⚠️ Trouble with the form? Tap to call Jacob — he can take your info in 60 seconds.
            </p>
            <a
              href="tel:+16628821593"
              className="inline-block rounded-lg bg-[#0a1628] text-white px-4 py-2 font-bold text-sm whitespace-nowrap hover:bg-[#1a2c4a]"
              onClick={() => trackEvent("form_error", { reason: "fb_browser_tap_to_call" })}
            >
              📞 Call (662) 882-1593
            </a>
          </div>
          <p className="mx-auto max-w-5xl text-xs mt-2 opacity-80 text-center sm:text-left">
            Or for the full form: tap the <strong>⋯</strong> (iPhone) or <strong>⋮</strong> (Android) menu above
            and choose <strong>Open in Safari / Chrome</strong>.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6 md:py-12">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Form — FIRST on mobile, SECOND on desktop */}
          <div className="order-1 md:order-2 rounded-2xl bg-white/5 border border-white/10 p-5 md:p-8 backdrop-blur">
            {submitted ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                  <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold">Thank you!</h2>
                <p className="mt-2 text-gray-300">Jacob will reach out within 24 hours.</p>
                <p className="mt-4 text-sm text-gray-400">
                  Or call him right now at{" "}
                  <a href="tel:+16628821593" className="font-semibold text-[#d4a843]">
                    (662) 882-1593
                  </a>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} onChange={handleFormStart} className="space-y-4">
                <h2 className="text-xl md:text-2xl font-bold text-center">
                  Partner with us in 30 seconds
                </h2>
                <p className="text-center text-sm text-gray-400 -mt-1">
                  Just three quick questions to get started
                </p>

                <input
                  name="name"
                  required
                  placeholder="Full Name"
                  autoComplete="name"
                  className={fieldCls}
                />
                <input
                  name="phone"
                  required
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone Number"
                  autoComplete="tel"
                  className={fieldCls}
                />

                <fieldset>
                  <legend className="text-sm font-medium text-gray-300 mb-2">
                    Do you have a valid CDL?
                  </legend>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-3 cursor-pointer has-[:checked]:border-[#d4a843] has-[:checked]:bg-[#d4a843]/10">
                      <input type="radio" name="cdl" value="Yes" required className="accent-[#d4a843]" />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-3 cursor-pointer has-[:checked]:border-[#d4a843] has-[:checked]:bg-[#d4a843]/10">
                      <input type="radio" name="cdl" value="No" className="accent-[#d4a843]" />
                      <span>No</span>
                    </label>
                  </div>
                </fieldset>

                {/* SMS consent — above the Apply Now button so TCR/A2P sees the consent
                    box during their CTA verification. Optional, never blocks submission. */}
                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-white/30 bg-white/10 accent-[#d4a843]"
                  />
                  <span className="text-gray-300">
                    <span className="text-gray-400">(Optional)</span> I agree to receive SMS
                    messages from Maco Transport about my application and job opportunities.
                    Message and data rates may apply. Reply STOP to opt out, HELP for help.
                  </span>
                </label>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[#d4a843] py-4 text-lg font-bold text-[#0a1628] hover:bg-[#c49a35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Apply Now"}
                </button>

                <p className="text-center text-sm text-gray-400">
                  Or call Jacob at{" "}
                  <a href="tel:+16628821593" className="font-semibold text-[#d4a843] underline">
                    (662) 882-1593
                  </a>
                </p>

                <details className="group pt-2 border-t border-white/10">
                  <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-200 list-none flex items-center justify-between">
                    <span>Help us match you faster (optional)</span>
                    <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    <select name="experience" defaultValue="" className={fieldCls}>
                      {EXP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="bg-[#0a1628]">
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input name="zip" inputMode="numeric" placeholder="Zip Code (optional)" autoComplete="postal-code" className={fieldCls} />
                    <input name="email" type="email" inputMode="email" placeholder="Email (optional)" autoComplete="email" className={fieldCls} />
                  </div>
                </details>

              </form>
            )}
          </div>

          {/* Marketing copy — SECOND on mobile, FIRST on desktop */}
          <div className="order-2 md:order-1">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
              <span className="text-[#d4a843]">Earn 80% of Gross.</span>
              <br />
              Home Weekends.
              <br />
              <span className="text-[#d4a843]">Memphis Based.</span>
            </h1>
            <p className="mt-4 md:mt-6 text-base md:text-lg text-gray-300 leading-relaxed">
              Maco Transport owner-operators run under our own authority hauling light, high-paying
              freight out of Memphis. Keep more, drive less, sleep at home.
            </p>

            <div className="mt-6 md:mt-10 space-y-3 md:space-y-4">
              {[
                "80% of gross revenue — keep more of what you haul",
                "Home weekends — light loads, no forced dispatch",
                "Fuel card provided",
                "Run under our authority — no MC needed",
                "Weekly settlements, direct deposit",
                "High-paying freight, consistent lanes",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <svg className="mt-1 h-5 w-5 flex-shrink-0 text-[#d4a843]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-6 mt-8">
        <div className="mx-auto max-w-5xl text-center text-sm text-gray-500 space-y-2">
          <div>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 underline">
              Privacy Policy
            </a>
            <span className="mx-2">·</span>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 underline">
              Terms
            </a>
          </div>
          <div>
            &copy; {new Date().getFullYear()} Maco Transport, LLC &mdash; Memphis, TN
          </div>
        </div>
      </footer>
    </div>
  );
}
