import React from 'react';
import { Link } from 'react-router-dom';

// Shown for any web address that doesn't match one of our pages. Calm,
// plain-language, and always offers a clear way back.
export default function FriendlyNotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center text-gray-900 dark:text-gray-100">
      <p className="text-5xl" aria-hidden="true">
        🧭
      </p>
      <h1 className="mt-4 text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-lg text-gray-700 dark:text-gray-300">
        The page you were looking for isn&apos;t here. It may have moved, or the address
        might have a small typo.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span aria-hidden="true">🏠</span>
        <span>Back to Home</span>
      </Link>
    </main>
  );
}
