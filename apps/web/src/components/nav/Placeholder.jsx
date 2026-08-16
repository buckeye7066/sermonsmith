import { Link } from 'react-router-dom';

/**
 * A warm, plain-language page for features that aren't finished yet.
 * This is a first-class experience, not an error screen.
 *
 * Props: title, comingSoonMessage, whatYouCanDoNow
 */
export default function Placeholder({ title, comingSoonMessage, whatYouCanDoNow }) {
  return (
    <main
      className="min-h-[60vh] flex items-center justify-center px-6 py-12"
      role="main"
    >
      <div className="max-w-xl w-full text-center bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-5xl mb-4" aria-hidden="true">
          {'\uD83C\uDF31'}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {title}
        </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
          {comingSoonMessage}
        </p>
        <p className="text-base text-gray-600 dark:text-gray-400 mb-8">
          {whatYouCanDoNow}
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
