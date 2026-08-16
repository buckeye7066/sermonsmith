import React from 'react';
import { PenLine, CalendarDays } from 'lucide-react';

/**
 * Static description of the two helpers, kept as plain data.
 * If a config file for assistants is added later at
 * apps/web/src/config/assistants.ts it can be imported here, but we keep a
 * safe built-in copy so this section is never blank for the user.
 */
export const ASSISTANTS = [
  {
    name: 'Larry',
    role: 'Single message helper',
    oneLineDescription:
      'Larry helps you draft one sermon or Bible lesson from start to finish.',
    iconName: 'PenLine',
  },
  {
    name: 'Arlynn',
    role: 'Series planner',
    oneLineDescription:
      'Arlynn helps you plan a whole series of messages across several weeks.',
    iconName: 'CalendarDays',
  },
];

const ICONS = {
  PenLine,
  CalendarDays,
};

/**
 * AssistantExplainer
 * Shows the short "What can Larry and Arlynn do?" section on the Home screen.
 * Each helper is described in one plain sentence so a non-technical user can
 * tell them apart at a glance.
 *
 * Props:
 *   assistants (optional) - array of { name, role, oneLineDescription, iconName }.
 *     Falls back to the built-in ASSISTANTS list when not provided or empty.
 */
export default function AssistantExplainer({ assistants }) {
  const list =
    Array.isArray(assistants) && assistants.length > 0 ? assistants : ASSISTANTS;

  return (
    <section
      aria-labelledby="assistant-explainer-heading"
      className="mt-12"
    >
      <h2
        id="assistant-explainer-heading"
        className="text-2xl font-semibold text-slate-900 dark:text-slate-100"
      >
        What can Larry and Arlynn do?
      </h2>
      <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
        These are your two helpers. Pick the one that matches what you want to
        prepare today.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {list.map((assistant) => {
          const Icon = ICONS[assistant.iconName] || PenLine;
          return (
            <div
              key={assistant.name}
              className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                <Icon size={28} aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {assistant.name}
                </h3>
                {assistant.role ? (
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {assistant.role}
                  </p>
                ) : null}
                <p className="mt-1 text-base text-slate-700 dark:text-slate-200">
                  {assistant.oneLineDescription}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
