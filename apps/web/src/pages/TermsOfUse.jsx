// Public terms of use page.
//
// Mounted outside the authentication gate. Keep self-contained: no auth hooks,
// API calls, or authenticated Layout wrapper.

import React from 'react';

const EFFECTIVE_DATE = 'August 8, 2026';

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

export default function TermsOfUse() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <article className="mx-auto max-w-3xl">
        <header className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <a className="text-sm text-indigo-600 dark:text-indigo-400 underline" href="/">
            Return to SermonSmith
          </a>
          <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-gray-100">
            SermonSmith Terms of Use
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        <p className="mt-6 text-gray-700 dark:text-gray-300 leading-relaxed">
          These Terms govern use of SermonSmith by Axiom BioLabs (the &ldquo;Service&rdquo;).
          By creating an account or using the Service you agree to them.
        </p>

        <Section title="Pastoral responsibility">
          <p>
            SermonSmith assists sermon and study preparation. It does not replace pastoral
            judgment, prayer, exegesis, denominational discipline, or congregational care.
            You remain responsible for every teaching decision and every Scripture citation
            you deliver.
          </p>
        </Section>

        <Section title="AI-assisted drafts">
          <p>
            AI features produce editable drafts and suggestions. They are not autonomous
            sermons or doctrinal authority. You control whether and how drafts are saved,
            presented, published, or shared.
          </p>
        </Section>

        <Section title="Scripture sources">
          <p>
            Exact verse wording shown through the Service comes from registered Bible
            providers for the selected translation. Canon and reference checks confirm that
            a citation exists in a selected canon; they do not by themselves prove that a
            freely typed or AI-suggested quotation matches provider text. Compare any
            quotation directly against the provider wording shown in the app, or use the
            wording verification API.
          </p>
        </Section>

        <Section title="Accounts, billing, and cancellation">
          <p>
            You must provide accurate registration details and keep credentials secure.
            Paid features are billed through Stripe where configured. You may manage or
            cancel a subscription through the billing portal linked from Settings, and you
            may delete your account from Settings (soft-delete with session revocation).
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            Do not abuse rate limits, attempt to bypass authentication, scrape provider
            content beyond normal personal study use, or use the Service to generate
            harassing, illegal, or deceptive content.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            Personal data handling is described in the{' '}
            <a className="text-indigo-600 dark:text-indigo-400 underline" href="/privacy">
              Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these Terms: contact the operator listed on the SermonSmith
            site for your deployment. Related:{' '}
            <a className="text-indigo-600 dark:text-indigo-400 underline" href="/privacy">
              Privacy Policy
            </a>
            .
          </p>
        </Section>
      </article>
    </main>
  );
}
