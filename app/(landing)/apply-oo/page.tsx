"use client";

import { useState, FormEvent } from "react";

const EXP_OPTIONS = [
  { value: "", label: "Select experience" },
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log("[Apply-OO] handleSubmit fired");

    if (!smsConsent) {
      setError("Please agree to receive SMS messages to continue.");
      return;
    }

    setSubmitting(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const payload = {
      formData: {
        name: fd.get("name") as string,
        phone: fd.get("phone") as string,
        email: fd.get("email") as string,
        "zip-code": fd.get("zip") as string,
        "do-you-have-a-valid-cdl": fd.get("cdl") as string,
        "years-of-experience": fd.get("experience") as string,
        "what-type-of-driver-are-you-interested-in-being": "Owner-Op",
        sms_consent: true,
        utm_source: "driveiq_landing",
        utm_medium: "direct",
        utm_campaign: "owner_operator_apply",
      },
    };

    try {
      console.log("[Apply-OO] Posting to /api/webhooks/webflow-lead", payload);
      const res = await fetch("/api/webhooks/webflow-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("[Apply-OO] Response status:", res.status);
      const data = await res.json();
      console.log("[Apply-OO] Response body:", data);
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server returned ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Apply-OO] Submit error:", msg);
      setError(`Something went wrong: ${msg}. Please try again or call us directly.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#d4a843] flex items-center justify-center font-bold text-[#0a1628] text-lg">
              M
            </div>
            <span className="text-xl font-bold tracking-tight">MACO Transport</span>
          </div>
          <a href="tel:+16628821593" className="text-sm text-[#d4a843] hover:underline hidden sm:block">
            Questions? Call (662) 882-1593
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Left — copy */}
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
              <span className="text-[#d4a843]">Earn 80% of Gross.</span>
              <br />
              Home Weekends.
              <br />
              <span className="text-[#d4a843]">Memphis Based.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-300 leading-relaxed">
              Maco Transport owner-operators run under our own authority hauling light, high-paying
              freight out of Memphis. Keep more, drive less, sleep at home.
            </p>

            <a
              href="tel:+16628821593"
              className="mt-6 block text-lg text-gray-200 hover:text-white"
            >
              Prefer to call? Reach Jacob at{" "}
              <span className="font-bold text-xl text-[#d4a843]">(662) 882-1593</span>
            </a>

            <div className="mt-10 space-y-4">
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

          {/* Right — form */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 backdrop-blur">
            {submitted ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                  <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold">Thank you!</h2>
                <p className="mt-2 text-gray-300">We&apos;ll be in touch within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="text-xl font-bold text-center mb-2">Partner With Us</h2>

                <input name="name" required placeholder="Full Name" className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]" />
                <input name="phone" required type="tel" placeholder="Phone Number" className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]" />
                <input name="email" type="email" placeholder="Email (optional)" className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]" />
                <input name="zip" placeholder="Zip Code" className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-gray-400 focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]" />

                {/* CDL radio */}
                <fieldset>
                  <legend className="text-sm font-medium text-gray-300 mb-2">Do you have a valid CDL?</legend>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="cdl" value="Yes" required className="accent-[#d4a843]" />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="cdl" value="No" className="accent-[#d4a843]" />
                      <span>No</span>
                    </label>
                  </div>
                </fieldset>

                <select name="experience" required defaultValue="" className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]">
                  {EXP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} hidden={!o.value} className="bg-[#0a1628]">
                      {o.label}
                    </option>
                  ))}
                </select>

                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-white/20 bg-white/5 p-3 hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-white/30 bg-white/10 accent-[#d4a843] cursor-pointer"
                  />
                  <span className="text-xs text-gray-300 leading-relaxed">
                    <span className="text-[#d4a843]">*</span> I agree to receive SMS messages from Maco Transport about my application and job opportunities. Message and data rates may apply. Reply STOP to opt out, HELP for help.
                  </span>
                </label>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting || !smsConsent}
                  className="w-full rounded-lg bg-[#d4a843] py-3.5 font-bold text-[#0a1628] hover:bg-[#c49a35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Apply Now"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 mt-12">
        <div className="mx-auto max-w-5xl text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Maco Transport, LLC &mdash; Memphis, TN
        </div>
      </footer>
    </div>
  );
}
