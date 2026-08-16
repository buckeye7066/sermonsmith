import React from 'react'
import { useTheme } from '../theme/ThemeProvider.jsx'

export default function ThemeToggle() {
  const { mode, toggleTheme } = useTheme()
  const isDark = mode === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-950"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span aria-hidden="true" className="text-lg">{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}
