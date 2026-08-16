import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-4xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-3xl dark:bg-slate-800" aria-hidden="true">🧭</div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">We could not find that page.</h1>
        <p className="mt-4 text-lg leading-8 text-slate-700 dark:text-slate-300">
          The page may have moved, or the link may not be quite right. Go back Home and choose where you want to begin.
        </p>
        <Link className="mt-8 inline-flex rounded-2xl bg-sky-700 px-6 py-4 text-base font-bold text-white shadow-sm hover:bg-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400" to="/">
          Go back Home
        </Link>
      </section>
    </main>
  );
}
