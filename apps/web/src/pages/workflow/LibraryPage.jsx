import React from 'react';
import { Library } from 'lucide-react';

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200">
          <Library size={26} aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Library</h1>
      </div>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        Find sermons, lessons, and series you have saved. Everything you create is kept here so
        you can open it again whenever you need it.
      </p>
    </div>
  );
}
