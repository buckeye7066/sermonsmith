import React from 'react'
import { Link } from 'react-router-dom'
import PrimaryNav from './PrimaryNav.jsx'
import ThemeToggle from './ThemeToggle.jsx'

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-stone-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="group rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950">
              <span className="block text-2xl font-black tracking-tight text-slate-950 dark:text-white">SermonSmith</span>
              <span className="block text-sm text-slate-600 dark:text-slate-300">
                From reading Scripture to preaching.
              </span>
            </Link>
            <ThemeToggle />
          </div>
          <PrimaryNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8" id="main-content">
        {children}
      </main>
    </div>
  )
}
