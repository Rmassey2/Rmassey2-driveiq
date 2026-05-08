import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Maco Transport",
  description:
    "How Maco Transport collects, uses, and protects information from driver applicants and the SMS messaging program.",
};

export default function PrivacyPage() {
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
          <span className="text-[#d4a843]">Privacy Policy</span>
        </h1>
        <p className="mt-2 text-sm text-gray-400">Effective May 7, 2026</p>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">1. Introduction</h2>
          <p className="text-gray-300 leading-relaxed">
            Maco Transport, LLC (&ldquo;Maco Transport,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;) operates apply.driveformaco.com, driveformaco.com, and getloaded.net
            (the &ldquo;Sites&rdquo;) to recruit and communicate with commercial drivers and
            owner-operators. This Privacy Policy explains what information we collect, how we use
            it, and your rights regarding that information.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">2. Information We Collect</h2>
          <p className="text-gray-300 leading-relaxed">
            When you submit a driver application or contact us through our Sites, we may collect:
          </p>
          <ul className="ml-6 list-disc space-y-1 text-gray-300 leading-relaxed">
            <li>Name</li>
            <li>Phone number</li>
            <li>Email address</li>
            <li>Zip code</li>
            <li>CDL status, driving experience, and driver type preference</li>
            <li>Information about your job history, qualifications, and eligibility to work</li>
            <li>Communications you send us via SMS, email, or phone</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">3. How We Use Your Information</h2>
          <p className="text-gray-300 leading-relaxed">We use the information you provide to:</p>
          <ul className="ml-6 list-disc space-y-1 text-gray-300 leading-relaxed">
            <li>Process and evaluate your driver application</li>
            <li>Contact you regarding your application, employment opportunities, and onboarding</li>
            <li>
              Send you SMS messages, emails, and phone calls related to your application and ongoing
              employment, when you have consented to receive them
            </li>
            <li>Comply with Department of Transportation, FMCSA, and state regulatory requirements</li>
            <li>Improve our recruiting and operations</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">4. SMS Messaging Program</h2>
          <p className="text-gray-300 leading-relaxed">
            By checking the SMS consent box on our application form, you agree to receive recurring
            SMS messages from Maco Transport related to your application, recruiter follow-up, job
            opportunities, onboarding, and operational communications. Message frequency varies.
            Message and data rates may apply. You can opt out at any time by replying STOP to any
            message. Reply HELP for assistance. Your phone number and SMS consent status are stored
            with your application record. We do not share your phone number with third parties for
            their marketing purposes.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">5. How We Share Information</h2>
          <p className="text-gray-300 leading-relaxed">
            We do not sell your personal information. We share information only with:
          </p>
          <ul className="ml-6 list-disc space-y-1 text-gray-300 leading-relaxed">
            <li>
              Service providers who help us operate our recruiting program (such as Twilio for SMS,
              Resend for email, Tenstreet for application processing, and Supabase for data
              storage), under contractual obligations to protect your information
            </li>
            <li>
              Background-check and motor-vehicle-record vendors when you have authorized us to
              obtain those reports as part of your application
            </li>
            <li>Government agencies and regulators when required by law</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">6. Data Retention</h2>
          <p className="text-gray-300 leading-relaxed">
            We retain application and driver records as required by federal and state law,
            typically a minimum of three years from the date of application or termination of
            employment, and longer where required by DOT regulations.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">7. Your Rights</h2>
          <p className="text-gray-300 leading-relaxed">
            You may request access to, correction of, or deletion of your personal information by
            contacting us at{" "}
            <a
              href="mailto:jacob@driveformaco.com"
              className="text-[#d4a843] hover:underline"
            >
              jacob@driveformaco.com
            </a>{" "}
            or{" "}
            <a href="tel:+16628821593" className="text-[#d4a843] hover:underline">
              (662) 882-1593
            </a>
            . Some information may be retained where required by law.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">8. Children&apos;s Privacy</h2>
          <p className="text-gray-300 leading-relaxed">
            Our Sites are not directed to individuals under 18, and we do not knowingly collect
            information from anyone under 18.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">9. Changes to This Policy</h2>
          <p className="text-gray-300 leading-relaxed">
            We may update this Privacy Policy from time to time. The effective date at the top of
            this page reflects the most recent revision.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">10. Contact Us</h2>
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
          <Link href="/terms" className="text-[#d4a843] hover:underline">
            Terms and Conditions
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
