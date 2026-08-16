import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../theme/ThemeProvider.jsx';

export default function ThemeToggle() {
  const { mode, toggleTheme } = useTheme();
  const isDark = mode === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
