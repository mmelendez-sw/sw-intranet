import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import {
  CONTENT_UPDATED_EVENT,
  ContentUpdatedDetail,
  getCachedContent,
  getContent,
  localContentStorageKey,
} from '../services/contentService';

export interface UseSharePointContentOptions<T> {
  /** Value used when nothing is cached/saved yet. */
  fallback: T;
  /** Raw JSON → typed value (defaults to a cast). Only called with non-null raw content. */
  parse?: (raw: unknown) => T;
  /** Fetch + listen only while true (e.g. once signed in). Defaults to true. */
  enabled?: boolean;
  /** Skip the browser cache on the initial fetch (see ContentSyncOptions.remoteOnly). */
  remoteOnly?: boolean;
  /** Return false to ignore an incoming value (e.g. while the user is editing it). */
  shouldApply?: (next: T) => boolean;
}

export interface UseSharePointContentResult<T> {
  data: T;
  /** Local override after a save; a later content-updated event may replace it. */
  setData: Dispatch<SetStateAction<T>>;
  /** Re-fetch from SharePoint (cache first unless remoteOnly). */
  reload: () => Promise<void>;
}

/**
 * Cached-first SharePoint content block: paints from localStorage immediately, fetches on
 * enable, and re-renders when the background refresh (or a save in another widget/tab)
 * changes the cached copy for `key`.
 */
export function useSharePointContent<T>(
  key: string,
  options: UseSharePointContentOptions<T>
): UseSharePointContentResult<T> {
  const { instance } = useMsal();
  const { enabled = true, remoteOnly = false } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const toValue = (raw: unknown): T => {
    const { parse, fallback } = optionsRef.current;
    if (raw === null || raw === undefined) return fallback;
    return parse ? parse(raw) : (raw as T);
  };

  const lastRawRef = useRef<string | null>(null);
  const [data, setData] = useState<T>(() => {
    const raw = getCachedContent<unknown>(key);
    lastRawRef.current = raw === null ? null : JSON.stringify(raw);
    return toValue(raw);
  });

  /** Apply raw content unless it matches what's already shown or the caller vetoes it. */
  const applyRaw = useCallback((raw: unknown) => {
    if (raw === null || raw === undefined) return;
    const json = JSON.stringify(raw);
    if (json === lastRawRef.current) return;
    const next = toValue(raw);
    const { shouldApply } = optionsRef.current;
    if (shouldApply && !shouldApply(next)) return;
    lastRawRef.current = json;
    setData(next);
  }, []);

  const reload = useCallback(async () => {
    const raw = await getContent<unknown>(instance, key, remoteOnly ? { remoteOnly: true } : undefined);
    applyRaw(raw);
  }, [instance, key, remoteOnly, applyRaw]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void getContent<unknown>(instance, key, remoteOnly ? { remoteOnly: true } : undefined).then(
      (raw) => {
        if (!cancelled) applyRaw(raw);
      }
    );

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ContentUpdatedDetail>).detail;
      if (detail?.key === key) applyRaw(getCachedContent<unknown>(key));
    };
    // Another tab saved or refreshed the same block.
    const onStorage = (event: StorageEvent) => {
      if (event.key === localContentStorageKey(key)) applyRaw(getCachedContent<unknown>(key));
    };
    window.addEventListener(CONTENT_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(CONTENT_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled, instance, key, remoteOnly, applyRaw]);

  return { data, setData, reload };
}
