import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'app-theme';

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: 'light',
  toggle: () => {},
  setTheme: () => {},
});

function apply(t: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.documentElement.style.colorScheme = t;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) as Theme | null;
    const initial: Theme = stored ?? (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setThemeState(initial);
    apply(initial);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    apply(t);
    try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  };

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
