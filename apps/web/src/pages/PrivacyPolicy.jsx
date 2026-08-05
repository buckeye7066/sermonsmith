// Public privacy policy page.
//
// This page is mounted outside the authentication gate. Keep it self-contained:
// no auth hooks, API calls, or authenticated Layout wrapper. Update this text
// whenever collection, retention, processors, or deletion behavior changes.

import React from 'react';

const EFFECTIVE_DATE = 'August 5, 2026';

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
          <a className="text-sm text-indigo-600 dark:text-indigo-400 underline" href="/">
            Return to SermonSmith
          </a>
          <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-gray-100">
            SermonSmith Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        <p className="mt-6 text-gray-700 dark:text-gray-300 leading-relaxed">
          This policy explains how SermonSmith (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;) handles information when you use its website and installed
          applications (the &ldquo;Service&rdquo;).
        </p>

        <Section title="Information We Collect">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Account information</strong> — email address, the display name and profile
              details you provide, subscription state, settings, and security/account status.
            </li>
            <li>
              <strong>Content you create</strong> — sermons, studies, quizzes, prayers, notes,
              highlights, messages, community posts, uploads, and other material you submit or save.
              Material you choose to share through a community or sharing feature can be visible to
              the audience indicated by that feature.
            </li>
            <li>
              <strong>AI requests and results</strong> — prompts and relevant content sent to an AI
              feature, plus the generated response.
            </li>
            <li>
              <strong>Payments</strong> — our payment provider processes website subscription
              payments. We receive transaction and subscription status but do not receive or store
              your full card number.
            </li>
            <li>
              <strong>First-party operational activity</strong> — for signed-in accounts we record
              a server-attached account ID, a coarse action type, page name, optional resource type,
              event time, and success/failure outcome. New activity events do not include prompt or
              sermon content, resource IDs, email addresses, full URLs, URL queries or fragments,
              screen size, or detailed error text. Logged-out public-page visits do not create these
              first-party UserActivity records or trigger an additional account lookup, although
              hosting and security logs can still be created as described below. Older operational
              records may contain an account email and are handled under the retention and deletion
              practices below.
            </li>
            <li>
              <strong>Technical and security data</strong> — server and hosting logs can include IP
              address, user agent, request time, route, response status, and fault or security
              information needed to operate and protect the Service.
            </li>
          </ul>
        </Section>

        <Section title="How We Use Information">
          <ul className="list-disc pl-6 space-y-2">
            <li>Authenticate accounts and provide requested features.</li>
            <li>Generate, save, synchronize, display, export, and share content at your direction.</li>
            <li>Process subscriptions and send essential account or service messages.</li>
            <li>Diagnose faults, measure coarse feature use, prevent abuse, and secure the Service.</li>
            <li>Comply with law and enforce applicable agreements.</li>
          </ul>
          <p>We do not sell personal information or use it for third-party advertising.</p>
        </Section>

        <Section title="AI and Scripture">
          <p>
            Text submitted to an AI feature and relevant saved content needed for that request may
            be sent to the configured AI provider, including OpenAI, to generate a response. Do not
            submit confidential counseling details, health information, children&apos;s information,
            or other sensitive personal data unless you are authorized to do so and accept that
            processing.
          </p>
          <p>
            AI output can be incomplete or wrong. Scripture references, quotations, translations,
            historical claims, citations, and theological interpretations must be checked against
            an authorized translation, surrounding context, and trusted sources before use.
          </p>
        </Section>

        <Section title="Service Providers and Sharing">
          <p>We use providers only as needed to operate the Service, including:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>OpenAI or the configured AI provider</strong> — processes AI requests.</li>
            <li><strong>Stripe</strong> — processes website subscription payments.</li>
            <li><strong>Resend</strong> — delivers transactional email such as password resets.</li>
            <li><strong>Vercel and Railway</strong> — host application, API, logs, and data services.</li>
            <li>
              <strong>Configured Scripture-data providers</strong> — receive the passage or source
              request needed to retrieve text when that source is used.
            </li>
          </ul>
          <p>
            We may also disclose information when required by law, to protect users or the Service,
            or in connection with a business transfer subject to appropriate safeguards.
          </p>
        </Section>

        <Section title="Cookies, Local Storage, and Offline Data">
          <p>
            We use essential authentication cookies and local device storage or caches for login,
            settings, performance, and supported offline behavior. We do not use third-party
            advertising cookies or a third-party behavioral analytics SDK.
          </p>
          <p>
            Browser and operating-system caches can be cleared outside our control. Verify important
            passages and keep your own copy of important work before clearing app data or relying on
            offline access.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Passwords are stored with one-way hashing, and supported network traffic is encrypted
            with HTTPS. Access controls, server-side authorization, and operational monitoring are
            used to protect the Service. No storage or transmission method is perfectly secure.
          </p>
        </Section>

        <Section title="Retention, Account Deactivation, and Deletion">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              The in-app account-deletion action immediately revokes access and marks the account
              deleted. It is a soft deletion and does not by itself immediately erase every database
              row, shared copy, operational record, or backup.
            </li>
            <li>
              To request hard deletion or a copy/correction of personal information, email the
              address below. We will verify the request and delete or de-identify applicable account
              data from active systems, subject to legal, security, fraud-prevention, transaction,
              shared-content, and backup exceptions.
            </li>
            <li>
              Content you shared with others may persist in their copies or where removal would
              affect the integrity of a conversation; we may de-identify it where appropriate.
            </li>
          </ul>
        </Section>

        <Section title="Children&rsquo;s Privacy">
          <p>
            The Service is not directed to children under 13, and we do not knowingly collect
            personal information from children under 13. Contact us if you believe a child has
            provided personal information so we can investigate and remove it where required.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this policy as the Service changes. We will revise the effective date and,
            when appropriate, provide additional notice.
          </p>
        </Section>

        <Section title="Contact Us">
          <p>
            For privacy questions or data access, correction, or deletion requests, email{' '}
            <a
              className="text-indigo-600 dark:text-indigo-400 underline"
              href="mailto:dr.johnwhite@axiombiolabs.org"
            >
              dr.johnwhite@axiombiolabs.org
            </a>
            .
          </p>
        </Section>

        <footer className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-6 text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} SermonSmith. All rights reserved.
        </footer>
      </article>
    </main>
  );
}
