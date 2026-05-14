import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  fontScale: 1,
  setFontScale: () => {},
});

const STORAGE_KEY = 'sermonsmith.theme.v1';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');
  const [fontScale, setFontScaleState] = useState(1);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.theme) setThemeState(parsed.theme);
        if (typeof parsed.fontScale === 'number') setFontScaleState(parsed.fontScale);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, fontScale }));
    } catch {
      // ignore
    }
  }, [theme, fontScale]);

  const value = {
    theme,
    setTheme: setThemeState,
    fontScale,
    setFontScale: setFontScaleState,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
