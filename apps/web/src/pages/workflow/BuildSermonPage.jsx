import React from 'react';
import { PenLine } from 'lucide-react';

export default function BuildSermonPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200">
          <PenLine size={26} aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Build Sermon/Lesson
        </h1>
      </div>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        Draft a single sermon or lesson step by step. Larry helps you draft a single sermon or
        lesson, so you can start from a passage and shape it into a clear message.
      </p>
    </div>
  );
}
