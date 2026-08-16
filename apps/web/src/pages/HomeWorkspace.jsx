import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Static assistant descriptions. Kept here (co-located with Home) so the
 * plain-language wording is easy to review. Larry helps with a SINGLE message;
 * Arlynn helps plan a MULTI-WEEK series. The difference is stated plainly.
 */
export const assistants = [
  {
    name: 'Larry',
    role: 'Single message helper',
    oneLineDescription:
      'Larry helps you draft one sermon or lesson from start to finish.',
    emoji: '\u270D\uFE0F', // writing hand
    to: '/SermonBuilder',
    action: 'Start a message with Larry',
  },
  {
    name: 'Arlynn',
    role: 'Series planning helper',
    oneLineDescription:
      'Arlynn helps you plan a whole series that runs over several weeks.',
    emoji: '\uD83D\uDCC5', // calendar
    to: '/PlanLibrary',
    action: 'Plan a series with Arlynn',
  },
];

/**
 * The three big "where do I begin" starting points. Routes point at pages that
 * already exist in this app so nothing is a dead link.
 */
const startHere = [
  {
    key: 'read',
    label: 'Read Scripture',
    description: 'Open the Bible and read any passage.',
    emoji: '\uD83D\uDCD6', // open book
    to: '/Reader',
  },
  {
    key: 'study',
    label: 'Study',
    description: 'Dig deeper into a passage or topic.',
    emoji: '\uD83D\uDD0D', // magnifying glass
    to: '/BibleStudy',
  },
  {
    key: 'build',
    label: 'Build a message',
    description: 'Write a sermon or lesson with help.',
    emoji: '\uD83D\uDEE0\uFE0F', // hammer and wrench
    to: '/SermonBuilder',
  },
];

function AssistantCard({ assistant }) {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {assistant.emoji}
        </span>
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {assistant.name}
          </h3>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {assistant.role}
          </p>
        </div>
      </div>
      <p className="mt-4 text-base leading-relaxed text-gray-700 dark:text-gray-300">
        {assistant.oneLineDescription}
      </p>
      <Link
        to={assistant.to}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:focus-visible:ring-blue-800"
      >
        {assistant.action}
      </Link>
    </div>
  );
}

export default function HomeWorkspace() {
  const navigate = useNavigate();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      {/* Headline + one-sentence purpose */}
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
          Welcome to SermonSmith
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-gray-700 dark:text-gray-300">
          SermonSmith is your calm, plain-language workspace for reading
          Scripture, studying, and building a sermon or lesson.
        </p>
      </section>

      {/* Three big obvious starting buttons */}
      <section className="mt-10" aria-label="Choose where to begin">
        <h2 className="sr-only">Where would you like to begin?</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {startHere.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.to)}
              className="flex h-full flex-col items-center rounded-2xl border-2 border-blue-600 bg-white px-6 py-8 text-center transition hover:bg-blue-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 dark:border-blue-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus-visible:ring-blue-800"
            >
              <span className="text-4xl" aria-hidden="true">
                {item.emoji}
              </span>
              <span className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {item.label}
              </span>
              <span className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {item.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* What can Larry and Arlynn do? */}
      <section className="mt-14" aria-labelledby="assistants-heading">
        <div className="text-center">
          <h2
            id="assistants-heading"
            className="text-2xl font-bold text-gray-900 dark:text-gray-100"
          >
            What can Larry and Arlynn do?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600 dark:text-gray-400">
            SermonSmith has two friendly helpers. Larry works on a single
            message. Arlynn plans a series across several weeks. Pick whichever
            fits what you are working on today.
          </p>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {assistants.map((assistant) => (
            <AssistantCard key={assistant.name} assistant={assistant} />
          ))}
        </div>
      </section>
    </main>
  );
}
