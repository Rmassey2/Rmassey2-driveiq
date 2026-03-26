"use client";

import { useState, FormEvent } from "react";

const EXP_OPTIONS = [
  { value: "", label: "Select experience" },
  { value: "less_than_2", label: "Less than 2 years" },
  { value: "2_3", label: "2–3 years" },
  { value: "4_5", label: "4–5 years" },
  { value: "5_plus", label: "5+ years" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Select driver type" },
  { value: "Local", label: "Local" },
  { value: "Regional", label: "Regional" },
  { value: "OTR", label: "OTR (Over the Road)" },
  { value: "Dedicated", label: "Dedicated" },
];

export default function ApplyPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log("[Apply] handleSubmit fired");
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
        "what-type-of-driver-are-you-interested-in-being": fd.get("type") as string,
        utm_source: "driveiq_landing",
        utm_medium: "direct",
        utm_campaign: "company_driver_apply",
      },
    };

    try {
      const res = await fetch("/api/webhooks/webflow-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Server error");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again or call us directly.");
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
          <a href="tel:+19013551234" className="text-sm text-[#d4a843] hover:underline hidden sm:block">
            Questions? Call us
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Left — copy */}
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
              <span className="text-[#d4a843]">61&#162; Per Mile.</span>
              <br />
              Home Every Weekend.
              <br />
              <span className="text-[#d4a843]">Memphis Based.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-300 leading-relaxed">
              MACO Transportation is hiring local, regional, and OTR company drivers.
              Top pay, new equipment, and a team that respects your time.
            </p>

            <div className="mt-10 space-y-4">
              {[
                "Up to 61 CPM — minimum 2,500 miles/week",
                "Weekends home guaranteed (Regional & Local)",
                "Brand new 2024 Freightliners",
                "$500 referral bonus per hire",
                "Full benefits from day one",
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
                <h2 className="text-xl font-bold text-center mb-2">Start Your Application</h2>

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

                <select name="type" required defaultValue="" className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white focus:border-[#d4a843] focus:outline-none focus:ring-1 focus:ring-[#d4a843]">
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} hidden={!o.value} className="bg-[#0a1628]">
                      {o.label}
                    </option>
                  ))}
                </select>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[#d4a843] py-3.5 font-bold text-[#0a1628] hover:bg-[#c49a35] transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Apply Now"}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  By submitting, you agree to receive SMS messages from Maco Transport. Reply STOP to opt out.
                </p>
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
