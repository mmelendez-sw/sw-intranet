import { useCallback, useEffect, useState } from 'react';

export type UserTheme = 'light' | 'dark';

const storageKey = (email: string) => `sw-intranet-theme:${email.toLowerCase()}`;

const readTheme = (email?: string): UserTheme => {
  if (!email) return 'light';
  try {
    return localStorage.getItem(storageKey(email)) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

/**
 * Per-user light/dark preference, stored per signed-in account (not the OS setting).
 * Applies `data-theme` on <html> only while the calling component is mounted, so
 * pages that don't use this hook always render light.
 */
export function useUserTheme(email?: string) {
  const [theme, setThemeState] = useState<UserTheme>(() => readTheme(email));

  useEffect(() => {
    setThemeState(readTheme(email));
  }, [email]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    return () => root.removeAttribute('data-theme');
  }, [theme]);

  const setTheme = useCallback(
    (next: UserTheme) => {
      setThemeState(next);
      if (!email) return;
      try {
        localStorage.setItem(storageKey(email), next);
      } catch {
        // Storage blocked — preference just won't persist.
      }
    },
    [email]
  );

  const toggleTheme = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme]
  );

  return { theme, setTheme, toggleTheme };
}
