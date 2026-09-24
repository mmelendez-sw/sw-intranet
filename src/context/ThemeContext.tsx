import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UserTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: UserTheme;
  /** False when no user is signed in (the preference is stored per account). */
  canToggle: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  canToggle: false,
  toggleTheme: () => {},
});

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
 * Pass the signed-in user's email; with no email the site always renders light.
 * Sets `data-theme="dark"` on <html>, which activates styles/dark-theme.css site-wide.
 */
export const ThemeProvider: React.FC<{ email?: string; children: React.ReactNode }> = ({
  email,
  children,
}) => {
  const [theme, setTheme] = useState<UserTheme>(() => readTheme(email));

  useEffect(() => {
    setTheme(readTheme(email));
  }, [email]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    return () => root.removeAttribute('data-theme');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    if (!email) return;
    setTheme((prev) => {
      const next: UserTheme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(storageKey(email), next);
      } catch {
        // Storage blocked — preference just won't persist.
      }
      return next;
    });
  }, [email]);

  return (
    <ThemeContext.Provider value={{ theme, canToggle: !!email, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
