import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl text-center">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        We couldn\u2019t find that page
      </h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        The page you were looking for isn\u2019t here. It may have moved, or the link was
        mistyped. Let\u2019s get you back to a good starting point.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center rounded-lg bg-sky-600 px-5 py-3 text-base font-semibold text-white shadow hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        Go back to Home
      </Link>
    </div>
  );
}
