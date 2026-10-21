import { useCallback, useEffect, useRef, useState } from 'react';
import { BYPASS_AUTH } from '../authConfig';
import type { ReportItemContent } from '../services/contentService';
import { acquireSharePointToken } from '../utils/msalToken';

/**
 * Starred reports for the signed-in user. Synced across devices through a small file in the
 * user's own OneDrive (Files.ReadWrite.All is already consented), with a per-account copy in
 * this browser so stars show instantly and still work when Graph is unreachable.
 * A preference rather than session state, so sign-out leaves it alone.
 */
const storageKey = (email: string) => `report-favorites:v1:${email.toLowerCase()}`;

/** PUT by path creates the Apps/Symphony Intranet folder on first save. */
const REMOTE_URL =
  'https://graph.microsoft.com/v1.0/me/drive/root:/Apps/Symphony%20Intranet/report-favorites.json:/content';

/** Batch quick star/unstar clicks into one upload. */
const SAVE_DELAY_MS = 800;

/** Reports have no id; the link is stable across title/description edits. */
export const reportFavoriteKey = (report: Pick<ReportItemContent, 'link' | 'title'>): string =>
  report.link.trim() || `title:${report.title.trim()}`;

const parseFavorites = (raw: unknown): string[] | null => {
  const list = Array.isArray(raw) ? raw : (raw as { reportFavorites?: unknown })?.reportFavorites;
  return Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : null;
};

function readFavorites(email: string): string[] {
  if (!email) return [];
  try {
    return parseFavorites(JSON.parse(localStorage.getItem(storageKey(email)) || '[]')) || [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(email: string, favorites: string[]): void {
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(favorites));
  } catch {
    /* storage blocked — the star still works until reload */
  }
}

/** The OneDrive copy: a list, null when it doesn't exist yet, undefined when unreachable. */
async function fetchRemoteFavorites(msalInstance: any): Promise<string[] | null | undefined> {
  const token = await acquireSharePointToken(msalInstance);
  if (!token) return undefined;
  try {
    const res = await fetch(REMOTE_URL, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    return parseFavorites(await res.json()) || [];
  } catch {
    return undefined;
  }
}

async function saveRemoteFavorites(msalInstance: any, favorites: string[]): Promise<void> {
  const token = await acquireSharePointToken(msalInstance);
  if (!token) return;
  try {
    const res = await fetch(REMOTE_URL, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportFavorites: favorites }),
    });
    if (!res.ok) console.warn('[reportFavorites] OneDrive save failed:', res.status);
  } catch (err) {
    console.warn('[reportFavorites] OneDrive save failed:', err);
  }
}

export function useReportFavorites(email: string | undefined, msalInstance?: any) {
  const account = (email || '').toLowerCase();
  const syncs = !!account && !!msalInstance && !BYPASS_AUTH;
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites(account));
  const saveTimer = useRef<number>();

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

  // OneDrive is the source of truth once it has a copy; the first device to sync seeds it.
  useEffect(() => {
    if (!syncs) return;
    let cancelled = false;
    fetchRemoteFavorites(msalInstance).then((remote) => {
      if (cancelled || remote === undefined) return;
      if (remote === null) {
        const local = readFavorites(account);
        if (local.length) void saveRemoteFavorites(msalInstance, local);
        return;
      }
      writeLocalFavorites(account, remote);
      setFavorites(remote);
    });
    return () => {
      cancelled = true;
    };
  }, [account, msalInstance, syncs]);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const toggleFavorite = useCallback(
    (key: string) => {
      setFavorites((current) => {
        const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        if (account) writeLocalFavorites(account, next);
        if (syncs) {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(() => void saveRemoteFavorites(msalInstance, next), SAVE_DELAY_MS);
        }
        return next;
      });
    },
    [account, msalInstance, syncs]
  );

  return { favorites, toggleFavorite };
}
