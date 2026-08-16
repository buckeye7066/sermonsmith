import { Link, useLocation } from 'react-router-dom';
import { getPlaceholder } from '../../data/placeholders.js';

export function PlaceholderRoute({ page }) {
  const location = useLocation();
  const details = page || getPlaceholder(location.pathname);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Coming soon</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">{details.title}</h1>
        <p className="mt-5 text-lg leading-8 text-slate-700 dark:text-slate-300">{details.comingSoonMessage}</p>
        <p className="mt-4 text-lg leading-8 text-slate-700 dark:text-slate-300">{details.nextStep}</p>
        <Link
          to={details.actionTo || '/'}
          className="mt-8 inline-flex rounded-full bg-sky-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
        >
          {details.actionLabel || 'Go Home'}
        </Link>
      </section>
    </main>
  );
}

export default PlaceholderRoute;
