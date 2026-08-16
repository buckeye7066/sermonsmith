import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'sermonsmith.theme';

const ThemeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
  setMode: () => {},
});

function readStoredMode() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch (e) {
    // localStorage blocked (e.g. private browsing). Fall through to default.
  }
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (e) {
    // matchMedia unavailable. Fall through.
  }
  return 'light';
}

function applyModeToDocument(mode) {
  try {
    const root = document.documentElement;
    if (mode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  } catch (e) {
    // Ignore; nothing to apply outside a browser.
  }
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => readStoredMode());

  useEffect(() => {
    applyModeToDocument(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {
      // If we cannot save, the choice still works for this session.
    }
  }, [mode]);

  const value = useMemo(() => {
    const setMode = (next) => {
      if (next === 'light' || next === 'dark') setModeState(next);
    };
    const toggleTheme = () => setModeState((m) => (m === 'dark' ? 'light' : 'dark'));
    return { mode, toggleTheme, setMode };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;
