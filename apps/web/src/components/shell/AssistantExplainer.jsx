import React from 'react';
import { assistants } from '../../config/assistants.js';

export default function AssistantExplainer() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        What can Larry and Arlynn do?
      </h2>
      <ul className="mt-4 space-y-3">
        {assistants.map((a) => (
          <li key={a.name} className="text-base text-slate-700 dark:text-slate-200">
            <span className="font-semibold text-sky-700 dark:text-sky-300">{a.name}:</span>{' '}
            {a.oneLineDescription}
          </li>
        ))}
      </ul>
    </section>
  );
}
