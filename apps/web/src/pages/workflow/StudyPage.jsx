import React from 'react';
import { Search } from 'lucide-react';

export default function StudyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200">
          <Search size={26} aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Study</h1>
      </div>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        Dig deeper into a passage with helpful study tools and notes. Explore the meaning,
        context, and background so you understand the text well before you teach it.
      </p>
    </div>
  );
}
