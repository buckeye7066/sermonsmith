import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export default function ReadScripturePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200">
          <BookOpen size={26} aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Read Scripture</h1>
      </div>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        Open the Bible and read any passage in a calm, easy-to-read view. Pick a book and
        chapter, and start reading.
      </p>
      <Link
        to="/build"
        className="mt-6 inline-flex items-center rounded-lg border border-slate-300 px-5 py-3 text-base font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        When you\u2019re ready, build a message from what you read
      </Link>
    </div>
  );
}
