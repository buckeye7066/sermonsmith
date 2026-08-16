import { Link } from 'react-router-dom';

const libraryLinks = [
  {
    title: 'Saved sermons',
    description: 'Open sermons and lessons you have already started or saved.',
    to: '/my-sermons',
    icon: '📝',
  },
  {
    title: 'Saved studies',
    description: 'Return to Bible studies and notes you have collected.',
    to: '/my-studies',
    icon: '📚',
  },
  {
    title: 'Series plans',
    description: 'Review plans for multi-week sermons or lessons.',
    to: '/plan-library',
    icon: '🗓️',
  },
  {
    title: 'Sermon library',
    description: 'Browse sermon resources that are already available in SermonSmith.',
    to: '/sermon-library',
    icon: '🗂️',
  },
];

export default function Library() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Choose what you want to open.</h2>
        <p className="mt-3 text-lg leading-8 text-slate-700 dark:text-slate-300">
          Your existing SermonSmith work is still here. Pick the kind of saved work you want to continue.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {libraryLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-6 transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-sky-600 dark:hover:bg-slate-800 dark:focus-visible:ring-sky-700"
          >
            <span className="text-3xl" aria-hidden="true">{item.icon}</span>
            <span className="mt-3 block text-xl font-bold text-slate-950 dark:text-white">{item.title}</span>
            <span className="mt-2 block text-base leading-7 text-slate-700 dark:text-slate-300">{item.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
