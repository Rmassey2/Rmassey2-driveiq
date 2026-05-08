import Link from "next/link";

export const metadata = {
  title: "Terms and Conditions — Maco Transport",
  description:
    "Terms governing use of Maco Transport's recruiting sites and the SMS messaging program (Maco Transport Recruiting & Driver Communications).",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <Link href="/apply" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-lg bg-[#d4a843] flex items-center justify-center font-bold text-[#0a1628] text-lg">
              M
            </div>
            <span className="text-xl font-bold tracking-tight">MACO Transport</span>
          </Link>
          <a
            href="tel:+16628821593"
            className="text-sm text-gray-200 hover:text-white text-right hidden sm:block"
          >
            Prefer to call? Reach Jacob at{" "}
            <span className="font-bold text-[#d4a843]">(662) 882-1593</span>
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
          <span className="text-[#d4a843]">Terms and Conditions</span>
        </h1>
        <p className="mt-2 text-sm text-gray-400">Effective May 7, 2026</p>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">1. Acceptance of Terms</h2>
          <p className="text-gray-300 leading-relaxed">
            By accessing or using apply.driveformaco.com, driveformaco.com, or getloaded.net (the
            &ldquo;Sites&rdquo;), or by submitting a driver application or otherwise communicating
            with Maco Transport, LLC (&ldquo;Maco Transport&rdquo;), you agree to these Terms and
            Conditions.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">2. Driver Application Program</h2>
          <p className="text-gray-300 leading-relaxed">
            The Sites allow commercial drivers and owner-operators to apply for employment or
            contractor opportunities with Maco Transport. Submission of an application does not
            guarantee employment, contracting, or any specific outcome. All applications are
            subject to verification, background checks, motor-vehicle-record review, drug
            screening, and DOT compliance review.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">
            3. SMS Messaging Program — Maco Transport Recruiting &amp; Driver Communications
          </h2>
          <ul className="ml-6 list-disc space-y-2 text-gray-300 leading-relaxed">
            <li>
              <strong className="text-white">Program Name:</strong> Maco Transport Recruiting
              &amp; Driver Communications
            </li>
            <li>
              <strong className="text-white">Program Description:</strong> Recurring SMS messages
              from Maco Transport related to driver applications, recruiter follow-up, job
              opportunities, onboarding, and operational driver communications.
            </li>
            <li>
              <strong className="text-white">Message Frequency:</strong> Message frequency varies
              based on your application status and ongoing employment. You may receive several
              messages per week during the recruiting process.
            </li>
            <li>
              <strong className="text-white">Message and Data Rates:</strong> Message and data
              rates may apply. Please contact your wireless carrier for details about your plan.
            </li>
            <li>
              <strong className="text-white">Opt-Out Instructions:</strong> You can cancel the SMS
              service at any time by replying <strong className="text-white">STOP</strong> to any
              message you receive from us. After you reply STOP, we will send a confirmation
              message and you will no longer receive SMS messages from us. To opt back in, reply{" "}
              <strong className="text-white">START</strong>.
            </li>
            <li>
              <strong className="text-white">Help Instructions:</strong> For help, reply{" "}
              <strong className="text-white">HELP</strong> to any message, or contact us at{" "}
              <a href="tel:+16628821593" className="text-[#d4a843] hover:underline">
                (662) 882-1593
              </a>{" "}
              or{" "}
              <a
                href="mailto:jacob@driveformaco.com"
                className="text-[#d4a843] hover:underline"
              >
                jacob@driveformaco.com
              </a>
              .
            </li>
            <li>
              <strong className="text-white">Supported Carriers:</strong> Carriers are not liable
              for delayed or undelivered messages.
            </li>
            <li>
              <strong className="text-white">Privacy:</strong> Information collected through the
              SMS program is governed by our{" "}
              <Link href="/privacy" className="text-[#d4a843] hover:underline">
                Privacy Policy
              </Link>
              .
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">4. Accuracy of Information</h2>
          <p className="text-gray-300 leading-relaxed">
            You agree that all information you provide to Maco Transport in your application or in
            subsequent communications is true, accurate, and complete to the best of your
            knowledge. Misrepresentation may result in denial of your application or termination
            of employment.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">5. Authorization</h2>
          <p className="text-gray-300 leading-relaxed">
            By submitting an application, you authorize Maco Transport and its designated vendors
            to verify the information you provide, contact previous employers and references, and
            obtain motor-vehicle records, criminal-background reports, drug-screening results, and
            PSP reports in accordance with applicable law.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">6. Intellectual Property</h2>
          <p className="text-gray-300 leading-relaxed">
            The content, design, logos, and trademarks on the Sites are owned by Maco Transport or
            our licensors and are protected by intellectual-property laws. You may not reproduce,
            modify, or distribute Site content without our written permission.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">7. Disclaimer of Warranties</h2>
          <p className="text-gray-300 leading-relaxed">
            The Sites and the SMS program are provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind. We do not warrant that the Sites or
            SMS program will be uninterrupted or error-free.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">8. Limitation of Liability</h2>
          <p className="text-gray-300 leading-relaxed">
            To the maximum extent permitted by law, Maco Transport will not be liable for any
            indirect, incidental, consequential, or punitive damages arising out of your use of
            the Sites or the SMS program.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">9. Governing Law</h2>
          <p className="text-gray-300 leading-relaxed">
            These Terms are governed by the laws of the State of Tennessee, without regard to
            conflict-of-laws principles.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">10. Changes to These Terms</h2>
          <p className="text-gray-300 leading-relaxed">
            We may update these Terms from time to time. The effective date at the top of this
            page reflects the most recent revision.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">11. Contact Us</h2>
          <div className="text-gray-300 leading-relaxed">
            <p>Maco Transport, LLC</p>
            <p>P.O. Box 382</p>
            <p>Nesbit, MS 38651</p>
            <p>
              Phone:{" "}
              <a href="tel:+16628821593" className="text-[#d4a843] hover:underline">
                (662) 882-1593
              </a>
            </p>
            <p>
              Email:{" "}
              <a
                href="mailto:jacob@driveformaco.com"
                className="text-[#d4a843] hover:underline"
              >
                jacob@driveformaco.com
              </a>
            </p>
          </div>
        </section>

        <div className="mt-12 border-t border-white/10 pt-6 text-sm text-gray-400">
          See also our{" "}
          <Link href="/privacy" className="text-[#d4a843] hover:underline">
            Privacy Policy
          </Link>
          .
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
