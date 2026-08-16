import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  PenLine,
  CalendarDays,
  Library,
  MonitorPlay,
} from 'lucide-react';

const ICONS = {
  BookOpen,
  Search,
  PenLine,
  CalendarDays,
  Library,
  MonitorPlay,
};

/**
 * A big, obvious card the user can tap to enter a workflow area.
 * Shows the plain one-line description so they know what it's for first.
 */
export default function WorkflowCard({ item }) {
  const Icon = ICONS[item.iconName] || BookOpen;
  return (
    <Link
      to={item.route}
      className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-500"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
        <Icon size={24} aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold">{item.label}</span>
      <span className="text-sm text-slate-600 dark:text-slate-400">
        {item.shortDescription}
        {!item.isBuilt ? ' (coming soon)' : ''}
      </span>
    </Link>
  );
}
