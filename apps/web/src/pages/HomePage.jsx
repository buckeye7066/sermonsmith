import React from 'react';
import { Link } from 'react-router-dom';
import { navItems } from '../config/navItems.js';
import WorkflowCard from '../components/shell/WorkflowCard.jsx';
import AssistantExplainer from '../components/shell/AssistantExplainer.jsx';

const START_BUTTON_IDS = ['read', 'study', 'build'];

export default function HomePage() {
  const startButtons = START_BUTTON_IDS.map((id) =>
    navItems.find((n) => n.id === id),
  ).filter(Boolean);

  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 md:text-4xl">
          SermonSmith
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          SermonSmith is your calm, plain-language workspace for preparing sermons and Bible
          lessons \u2014 from reading Scripture all the way to preaching.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-4 sm:flex-row">
          {startButtons.map((item) => (
            <Link
              key={item.id}
              to={item.route}
              className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-8 py-4 text-lg font-semibold text-white shadow hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Not sure where to begin? Any button above is a good first step.
        </p>
      </section>

      <AssistantExplainer />

      <section>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Everything you need, in one place
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => (
            <WorkflowCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
