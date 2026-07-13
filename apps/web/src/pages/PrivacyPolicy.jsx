// Public privacy policy page.
//
// IMPORTANT: this page is mounted OUTSIDE the authentication gate (see the
// short-circuit at the top of AuthenticatedApp in App.jsx). Legal/store pages
// must be readable by anyone — app-store reviewers and logged-out visitors —
// without an account, and without the app shell/navigation (which assumes an
// authenticated user). Keep this component self-contained: no auth hooks, no
// API calls, no Layout wrapper.
//
// Content reflects the app's ACTUAL data practices as of the effective date
// below. If you change what data is collected or which processors are used,
// update this page (Google Play's Data safety form must stay consistent with it).

import React from 'react';

const EFFECTIVE_DATE = 'July 13, 2026';

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="mt-3 space-y-3 text-gray-700 dark:text-gray-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <article className="mx-auto max-w-3xl">
        <header className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Sermon Smith — Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        <p className="mt-6 text-gray-700 dark:text-gray-300 leading-relaxed">
          This Privacy Policy explains how Sermon Smith (&ldquo;Sermon Smith,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and protects
          your information when you use our website and mobile application (together, the
          &ldquo;Service&rdquo;). By using the Service, you agree to the practices described here.
        </p>

        <Section title="Information We Collect">
          <p>We collect only what we need to provide the Service:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Account information</strong> — your email address, the name you choose to
              display, and an optional profile photo. You provide these when you register.
            </li>
            <li>
              <strong>Content you create</strong> — the sermons, Bible studies, quizzes, prayers,
              notes, and community posts you generate or save in the Service. This content is
              stored so we can show it back to you across your devices.
            </li>
            <li>
              <strong>Payment information</strong> — if you purchase a subscription on our website,
              payment is processed by our payment provider (Stripe). We do not receive or store your
              full card number. Purchases are not offered inside the mobile app.
            </li>
            <li>
              <strong>Basic technical data</strong> — standard server logs (such as timestamps and
              error information) used to keep the Service secure and reliable. We do not use
              third-party advertising or tracking/analytics SDKs.
            </li>
          </ul>
        </Section>

        <Section title="How We Use Your Information">
          <ul className="list-disc pl-6 space-y-2">
            <li>To create your account and sign you in securely.</li>
            <li>To generate, save, and display the content you create.</li>
            <li>To process subscription payments made on our website.</li>
            <li>To send you essential account and service email (for example, password resets).</li>
            <li>To protect the Service against abuse, fraud, and technical faults.</li>
          </ul>
          <p>We do not sell your personal information, and we do not use it for advertising.</p>
        </Section>

        <Section title="AI-Generated Content">
          <p>
            Some features let you generate sermons, studies, and related content with the help of
            artificial intelligence. When you use these features, the text you submit as a prompt is
            sent to our AI provider (OpenAI) solely to produce your result and return it to you.
            Please avoid submitting sensitive personal information in these prompts that you would
            not want processed by a third-party AI service.
          </p>
        </Section>

        <Section title="How We Share Information">
          <p>
            We share information only with the service providers that help us operate the Service,
            and only to the extent needed to provide it:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>OpenAI</strong> — processes prompts to generate AI content.</li>
            <li><strong>Stripe</strong> — processes website subscription payments.</li>
            <li><strong>Resend</strong> — delivers transactional email (e.g. password resets).</li>
            <li><strong>Vercel and Railway</strong> — host the application and database.</li>
          </ul>
          <p>
            We do not sell your data or share it with third parties for their own marketing or
            advertising. We may disclose information if required by law or to protect the rights,
            safety, and security of our users and the Service.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use a single essential, secure (httpOnly) cookie to keep you signed in. We do not use
            advertising or third-party tracking cookies.
          </p>
        </Section>

        <Section title="Data Security">
          <p>
            We protect your account with industry-standard measures: passwords are stored using
            one-way hashing (bcrypt) and are never stored in plain text, and data is encrypted in
            transit using HTTPS. No method of transmission or storage is perfectly secure, but we
            work to safeguard your information.
          </p>
        </Section>

        <Section title="Your Choices and Data Retention">
          <ul className="list-disc pl-6 space-y-2">
            <li>You can review and update your account details in the app&rsquo;s Settings.</li>
            <li>
              You can delete your account, which revokes access and begins removal of your personal
              account data. Some records may be retained where required for legal, security, or
              audit purposes.
            </li>
            <li>
              You may request a copy of your personal information, or ask us to delete it, by
              contacting us using the details below.
            </li>
          </ul>
        </Section>

        <Section title="Children&rsquo;s Privacy">
          <p>
            The Service is not directed to children under 13, and we do not knowingly collect
            personal information from children under 13. If you believe a child has provided us
            personal information, please contact us and we will delete it.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. When we do, we will revise the
            &ldquo;Effective&rdquo; date at the top of this page. Your continued use of the Service
            after changes take effect constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section title="Contact Us">
          <p>
            If you have questions about this Privacy Policy or your data, contact us through the
            in-app <strong>Contact Support</strong> page, or by email at{' '}
            <a
              className="text-indigo-600 dark:text-indigo-400 underline"
              href="mailto:support@sermonsmith.app"
            >
              support@sermonsmith.app
            </a>
            .
          </p>
        </Section>

        <footer className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-6 text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} Sermon Smith. All rights reserved.
        </footer>
      </article>
    </main>
  );
}
