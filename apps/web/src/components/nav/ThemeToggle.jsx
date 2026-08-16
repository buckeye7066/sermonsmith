import { useEffect, useState } from 'react';

const THEME_KEY = 'theme';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

function safeStorage() {
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      return globalThis.localStorage;
    }
  } catch {
    // Use the in-memory fallback below.
  }

  const fallback = createMemoryStorage();
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: fallback,
      configurable: true,
      writable: true,
    });
  } catch {
    // Some runtimes do not allow defining globals; returning the fallback is enough.
  }
  return fallback;
}

const storage = safeStorage();

function readInitialTheme() {
  try {
    const saved = storage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.body?.classList?.toggle('dark', theme === 'dark');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      storage.setItem(THEME_KEY, theme);
    } catch {
      // If storage is blocked, the visible theme still changes for this visit.
    }
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

export default ThemeToggle;
