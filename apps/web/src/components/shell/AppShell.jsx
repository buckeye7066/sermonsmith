import React from 'react';
import { Link } from 'react-router-dom';
import PrimaryNav from './PrimaryNav.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link
              to="/"
              className="text-xl font-bold text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:text-sky-300"
            >
              SermonSmith
            </Link>
            <div className="md:hidden">
              <ThemeToggle />
            </div>
          </div>
          <div className="flex flex-1 items-center justify-between gap-4 md:justify-end">
            <PrimaryNav />
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
