import { Link } from 'react-router-dom';

export default function Placeholder({ title, comingSoonMessage, whatYouCanDoNow }) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm dark:bg-slate-900" aria-hidden="true">🌱</div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-4 text-lg leading-8 text-slate-700 dark:text-slate-200">{comingSoonMessage}</p>
        <p className="mt-4 text-lg leading-8 text-slate-700 dark:text-slate-200">{whatYouCanDoNow}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link className="rounded-2xl bg-sky-700 px-6 py-4 text-base font-bold text-white shadow-sm hover:bg-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400" to="/build">
            Build a sermon or lesson
          </Link>
          <Link className="rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-bold text-slate-900 shadow-sm hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800" to="/read">
            Read Scripture instead
          </Link>
        </div>
      </div>
    </section>
  );
}
