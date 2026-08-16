import React from 'react';
import { Link } from 'react-router-dom';
import { pageDescriptions } from './pageDescriptions.js';

/**
 * WorkflowPage renders a consistent, never-blank frame for every workflow area.
 *
 * Props:
 *  - title: friendly page heading (plain language)
 *  - descriptionKey: key into pageDescriptions for the one-line explainer
 *  - isBuilt: when false, show the warm placeholder instead of children
 *  - comingSoonMessage: plain-language note about what will go here
 *  - whatYouCanDoNow: a helpful, available action to suggest right now
 *  - homeToText / homeToRoute: label + route for the suggested action button
 *  - children: the real feature content for built pages
 */
export default function WorkflowPage({
  title,
  descriptionKey,
  isBuilt = true,
  comingSoonMessage,
  whatYouCanDoNow,
  actionText = 'Go back Home',
  actionRoute = '/',
  children,
}) {
  const description = pageDescriptions[descriptionKey] || '';

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 text-gray-900 dark:text-gray-100">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        {description ? (
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">{description}</p>
        ) : null}
      </header>

      {isBuilt ? (
        <section aria-label={title} className="space-y-4">
          {children}
        </section>
      ) : (
        <section
          aria-label={`${title} — coming soon`}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h2 className="text-xl font-semibold">This part is on its way</h2>
          <p className="mt-3 text-base text-gray-700 dark:text-gray-200">
            {comingSoonMessage ||
              'We are still building this area. Nothing is broken — it just is not ready yet.'}
          </p>
          <div className="mt-5 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              What you can do right now
            </p>
            <p className="mt-1 text-blue-800 dark:text-blue-200">
              {whatYouCanDoNow ||
                'Head back Home and start reading Scripture or building a message.'}
            </p>
          </div>
          <Link
            to={actionRoute}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-lg font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
          >
            {actionText}
          </Link>
        </section>
      )}
    </main>
  );
}
