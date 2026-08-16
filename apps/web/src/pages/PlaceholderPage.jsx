import React from 'react';
import { Link } from 'react-router-dom';
import { getPlaceholder } from '../config/placeholders.js';

export default function PlaceholderPage({ route }) {
  const content = getPlaceholder(route);
  return (
    <div className="mx-auto max-w-xl text-center">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {content.areaName} is on the way
      </h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        {content.comingSoonMessage}
      </p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-left dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          What you can do right now
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{content.whatYouCanDoNow}</p>
      </div>
      <Link
        to="/"
        className="mt-8 inline-flex items-center rounded-lg bg-sky-600 px-5 py-3 text-base font-semibold text-white shadow hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        Go back to Home
      </Link>
    </div>
  );
}
