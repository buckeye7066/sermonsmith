export default function NotFound() {
  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-3xl flex-col items-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-12">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-4xl dark:bg-amber-900/40" aria-hidden="true">
          🕊️
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Page not found
        </p>

        <h1 className="mb-4 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          We couldn&apos;t find that page.
        </h1>

        <p className="mb-8 max-w-2xl text-lg leading-8 text-slate-700 dark:text-slate-300">
          The page may have moved, or the link may be out of date. You can go back Home and choose where you want to begin.
        </p>

        <a
          href="/"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-blue-700 px-7 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus:ring-blue-800"
        >
          Go back Home
        </a>
      </section>
    </main>
  );
}
