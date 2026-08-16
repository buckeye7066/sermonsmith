import React from 'react'
import { NavLink } from 'react-router-dom'
import { navItems } from '../config/navItems.js'

const iconByName = {
  book: '📖',
  search: '🔎',
  pen: '✍️',
  calendar: '🗓️',
  library: '📚',
  present: '🕊️',
}

export default function PrimaryNav() {
  return (
    <nav aria-label="Primary" className="w-full">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-stretch lg:justify-center">
        {navItems.map((item) => (
          <li key={item.id} className="min-w-0 lg:w-auto">
            <NavLink
              to={item.route}
              className={({ isActive }) =>
                [
                  'group flex h-full min-h-14 items-start gap-2 rounded-2xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950',
                  isActive
                    ? 'border-amber-500 bg-amber-100 text-slate-950 shadow-sm dark:border-amber-300 dark:bg-amber-900/40 dark:text-amber-50'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-amber-500 dark:hover:bg-slate-800',
                ].join(' ')
              }
              title={`${item.label}: ${item.shortDescription}`}
            >
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-xl">
                {iconByName[item.iconName] ?? '•'}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight">{item.label}</span>
                <span className="hidden max-w-48 text-xs leading-snug text-slate-600 dark:text-slate-300 xl:block">
                  {item.shortDescription}
                </span>
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
