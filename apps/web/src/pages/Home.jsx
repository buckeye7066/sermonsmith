import { Link } from 'react-router-dom';
import AssistantCard from '../components/nav/AssistantCard.jsx';
import { assistants } from '../data/assistants.js';

const startingActions = [
  {
    to: '/read',
    icon: '📖',
    label: 'Read Scripture',
    helper: 'Begin with the passage and gather your first observations.',
  },
  {
    to: '/study',
    icon: '📝',
    label: 'Study the passage',
    helper: 'Collect notes, questions, and context before you draft.',
  },
  {
    to: '/build',
    icon: '✍️',
    label: 'Build a message',
    helper: 'Shape your passage and notes into a draft you can review.',
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 sm:py-14 lg:px-8">
      <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Your calm sermon workspace</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              Prepare sermons and Bible lessons without wrestling with software.
            </h1>
            <p className="mt-5 max-w-3xl text-xl leading-9 text-slate-700 dark:text-slate-300">
              SermonSmith helps you read Scripture, study clearly, and build a message in one simple ministry workflow.
            </p>
          </div>

          <div className="rounded-3xl bg-sky-50 p-6 dark:bg-slate-800">
            <p className="text-lg font-bold text-slate-950 dark:text-white">Begin here</p>
            <p className="mt-2 text-slate-700 dark:text-slate-300">Choose the part of preparation you want to do right now.</p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3" aria-label="Start preparing">
        {startingActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-600 dark:focus-visible:ring-sky-700"
          >
            <span className="text-4xl" aria-hidden="true">{action.icon}</span>
            <span className="mt-4 block text-2xl font-bold text-slate-950 group-hover:text-sky-800 dark:text-white dark:group-hover:text-sky-300">{action.label}</span>
            <span className="mt-3 block text-lg leading-8 text-slate-700 dark:text-slate-300">{action.helper}</span>
          </Link>
        ))}
      </section>

      <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Built for Pastoral Review</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Your judgment stays final.</h2>
          <p className="mt-3 text-lg leading-8 text-slate-700 dark:text-slate-300">
            SermonSmith can help organize a draft, but it does not replace prayer, study, or pastoral care. You review every suggestion, edit what needs work, and decide what is ready to preach or teach.
          </p>
          <Link
            to="/build"
            className="mt-6 inline-flex rounded-full border border-sky-700 px-6 py-3 text-base font-semibold text-sky-800 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 dark:border-sky-300 dark:text-sky-200 dark:hover:bg-slate-800"
          >
            View Example Draft
          </Link>
        </div>
      </section>

      <section className="mt-10 rounded-[2rem] border border-slate-200 bg-slate-100 p-6 dark:border-slate-700 dark:bg-slate-900/70 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Plain-language help</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">What can Larry and Arlynn do?</h2>
          <p className="mt-3 text-lg leading-8 text-slate-700 dark:text-slate-300">
            Larry and Arlynn are named helpers for different kinds of ministry preparation.
          </p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {assistants.map((assistant) => (
            <AssistantCard key={assistant.name} assistant={assistant} />
          ))}
        </div>
      </section>
    </main>
  );
}
