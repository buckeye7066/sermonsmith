import React from 'react';
import { Link } from 'react-router-dom';
import { NavIcon } from './iconMap.jsx';

export default function WorkflowCard({ item }) {
  return (
    <Link
      to={item.route}
      className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-500"
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200">
        <NavIcon name={item.iconName} size={26} />
      </span>
      <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {item.label}
      </span>
      <span className="text-sm text-slate-600 dark:text-slate-300">
        {item.shortDescription}
      </span>
    </Link>
  );
}
