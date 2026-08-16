import React from 'react';
import { Link } from 'react-router-dom';
import { getVisibleNavItems } from '../routes/routes.js';
import { ASSISTANTS } from '../data/assistants.js';
import AssistantCard from '../components/AssistantCard.jsx';

// The very first thing a non-technical person sees. It states what the app
// does in one sentence and makes the next action obvious with three big
// buttons — no instructions needed.
export default function WorkspaceHome() {
  const items = getVisibleNavItems();
  const findRoute = (id, fallback) => {
    const match = items.find((i) => i.id === id);
    return match ? match.route : fallback;
  };

  const assistantEmoji = { Larry: '✍️', Arlynn: '🗓️' };

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 text-gray-900 dark:text-gray-100">
      <section className="text-center">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Welcome to SermonSmith</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-gray-700 dark:text-gray-300">
          SermonSmith is your calm, plain-language workspace for reading Scripture,
          studying, and building a sermon or lesson.
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-4 sm:flex-row">
          <Link
            to={findRoute('read', '/reader')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span aria-hidden="true">📖</span> Start Reading
          </Link>
          <Link
            to={findRoute('study', '/bible-study')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <span aria-hidden="true">🔍</span> Start Studying
          </Link>
          <Link
            to={findRoute('build', '/sermon-builder')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <span aria-hidden="true">✍️</span> Start Building
          </Link>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">What can Larry and Arlynn do?</h2>
        <p className="mt-2 text-base text-gray-700 dark:text-gray-300">
          SermonSmith has two friendly helpers. Larry helps with one message; Arlynn
          helps with a whole series.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ASSISTANTS.map((a) => (
            <AssistantCard
              key={a.name}
              name={a.name}
              role={a.role}
              oneLineDescription={a.oneLineDescription}
              emoji={assistantEmoji[a.name] || '🤝'}
            />
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">Where would you like to go?</h2>
        <p className="mt-2 text-base text-gray-700 dark:text-gray-300">
          Each area below is a step in preparing a message. Pick any one to begin.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.route}
              className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500"
            >
              <span className="text-3xl" aria-hidden="true">
                {item.icon}
              </span>
              <span className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {item.label}
              </span>
              <span className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {item.description}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
