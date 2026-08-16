import React from 'react'
import { Link } from 'react-router-dom'
import { assistants } from '../config/assistants.js'
import { navItems, startingNavItems } from '../config/navItems.js'

const iconByName = {
  book: '📖',
  search: '🔎',
  pen: '✍️',
  calendar: '🗓️',
  library: '📚',
  present: '🕊️',
}

function StartButton({ item }) {
  return (
    <Link
      to={item.route}
      className="group flex min-h-36 flex-col justify-between rounded-3xl border border-amber-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-amber-500 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
    >
      <span aria-hidden="true" className="text-4xl">{iconByName[item.iconName] ?? '•'}</span>
      <span>
        <span className="mt-5 block text-2xl font-black text-slate-950 dark:text-white">{item.label}</span>
        <span className="mt-2 block text-base leading-7 text-slate-700 dark:text-slate-200">{item.shortDescription}</span>
      </span>
    </Link>
  )
}

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-stone-100 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 sm:p-10 lg:p-12">
        <div className="max-w-4xl">
          <p className="mb-4 inline-flex rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            Your sermon and Bible lesson workspace
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
            Prepare a sermon or Bible lesson with a calm, guided place to begin.
          </h1>
          <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-700 dark:text-slate-200">
            SermonSmith helps you read Scripture, study the passage, and build a clear message from first reading to preaching.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {startingNavItems.map((item) => (
            <StartButton key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">What can Larry and Arlynn do?</h2>
          <div className="mt-5 grid gap-4">
            {assistants.map((assistant) => (
              <article key={assistant.name} className="rounded-2xl bg-stone-100 p-5 dark:bg-slate-800">
                <h3 className="text-xl font-black text-slate-950 dark:text-white">{assistant.name}</h3>
                <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-200">{assistant.role}</p>
                <p className="mt-3 text-slate-700 dark:text-slate-200">{assistant.oneLineDescription}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Choose the part of the work you are doing</h2>
          <div className="mt-5 grid gap-3">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.route}
                className="flex items-start gap-3 rounded-2xl border border-transparent p-3 transition hover:border-amber-300 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:hover:border-amber-700 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
              >
                <span aria-hidden="true" className="text-2xl">{iconByName[item.iconName] ?? '•'}</span>
                <span>
                  <span className="block font-bold text-slate-950 dark:text-white">{item.label}</span>
                  <span className="block text-sm leading-6 text-slate-600 dark:text-slate-300">{item.shortDescription}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
