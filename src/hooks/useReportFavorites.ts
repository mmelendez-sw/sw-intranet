import { useCallback, useEffect, useState } from 'react';
import type { ReportItemContent } from '../services/contentService';

/**
 * Starred reports for the signed-in user, kept in this browser (per account, not synced
 * across devices). A preference rather than session state, so sign-out leaves it alone.
 */
const storageKey = (email: string) => `report-favorites:v1:${email.toLowerCase()}`;

/** Reports have no id; the link is stable across title/description edits. */
export const reportFavoriteKey = (report: Pick<ReportItemContent, 'link' | 'title'>): string =>
  report.link.trim() || `title:${report.title.trim()}`;

function readFavorites(email: string): string[] {
  if (!email) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(email)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export function useReportFavorites(email: string | undefined) {
  const account = (email || '').toLowerCase();
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites(account));

  useEffect(() => {
    setFavorites(readFavorites(account));
    if (!account) return;
    // Another tab starred/unstarred a report.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(account)) setFavorites(readFavorites(account));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [account]);

  const toggleFavorite = useCallback(
    (key: string) => {
      setFavorites((current) => {
        const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        if (account) {
          try {
            localStorage.setItem(storageKey(account), JSON.stringify(next));
          } catch {
            /* storage blocked — the star still works until reload */
          }
        }
        return next;
      });
    },
    [account]
  );

  return { favorites, toggleFavorite };
}
