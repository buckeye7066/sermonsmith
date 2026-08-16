import { Link } from 'react-router-dom';

/**
 * Shown when someone lands on a web address that doesn't exist here.
 * Plain language, one clear next step \u2014 never a raw 404.
 */
export default function FriendlyNotFound() {
  return (
    <main
      className="min-h-[60vh] flex items-center justify-center px-6 py-12"
      role="main"
    >
      <div className="max-w-xl w-full text-center bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-5xl mb-4" aria-hidden="true">
          {'\uD83E\uDDED'}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          We couldn\u2019t find that page
        </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
          The page you were looking for isn\u2019t here. It may have moved, or the
          address might have a small typo. No harm done \u2014 let\u2019s get you back.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-3 rounded-xl text-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-colors"
        >
          Go back Home
        </Link>
      </div>
    </main>
  );
}
