import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getPlaceholderForRoute } from '../config/placeholders.js'

export default function PlaceholderPage({ content }) {
  const location = useLocation()
  const page = content ?? getPlaceholderForRoute(location.pathname) ?? {
    areaName: 'This page',
    comingSoonMessage: 'This area is being prepared so it can be helpful and easy to use.',
    whatYouCanDoNow: 'You can return Home, read Scripture, study a passage, or build a sermon or lesson right now.',
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900/60 dark:bg-slate-900 sm:p-8">
      <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
        Coming soon
      </p>
      <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">{page.areaName}</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-200">{page.comingSoonMessage}</p>

      <div className="mt-6 rounded-2xl bg-stone-100 p-5 dark:bg-slate-800">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">What you can do right now</h2>
        <p className="mt-2 text-slate-700 dark:text-slate-200">{page.whatYouCanDoNow}</p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          to="/"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-amber-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          Back to Home
        </Link>
        <Link
          to="/read"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
        >
          Read Scripture instead
        </Link>
      </div>
    </section>
  )
}
