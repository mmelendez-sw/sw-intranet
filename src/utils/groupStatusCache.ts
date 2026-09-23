/**
 * Cached Entra group membership for fast first paint (stale-while-revalidate).
 */

const ELITE_KEY = (email: string) => `elite_status_${email}`;
const ELITE_TS_KEY = (email: string) => `elite_status_timestamp_${email}`;
const EDITOR_KEY = (email: string) => `editor_status_${email}`;
const EDITOR_TS_KEY = (email: string) => `editor_status_timestamp_${email}`;

/** Fresh cache window — still used for "should we skip network?" decisions. */
export const GROUP_STATUS_TTL_MS = 24 * 60 * 60 * 1000;

export type CachedFlag = {
  value: boolean | null;
  /** True when a value exists and is within TTL. */
  fresh: boolean;
  /** True when any value exists (even expired) — safe for optimistic first paint. */
  present: boolean;
};

function readFlag(valueKey: string, tsKey: string): CachedFlag {
  try {
    const raw = localStorage.getItem(valueKey);
    if (raw !== 'true' && raw !== 'false') {
      return { value: null, fresh: false, present: false };
    }
    const ts = parseInt(localStorage.getItem(tsKey) || '', 10);
    const fresh = Number.isFinite(ts) && Date.now() - ts < GROUP_STATUS_TTL_MS;
    return { value: raw === 'true', fresh, present: true };
  } catch {
    return { value: null, fresh: false, present: false };
  }
}

export function readCachedEliteStatus(email: string): CachedFlag {
  return readFlag(ELITE_KEY(email), ELITE_TS_KEY(email));
}

export function readCachedEditorStatus(email: string): CachedFlag {
  return readFlag(EDITOR_KEY(email), EDITOR_TS_KEY(email));
}

export function writeCachedEliteStatus(email: string, isElite: boolean): void {
  try {
    localStorage.setItem(ELITE_KEY(email), String(isElite));
    localStorage.setItem(ELITE_TS_KEY(email), String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
}

export function writeCachedEditorStatus(email: string, isEditor: boolean): void {
  try {
    localStorage.setItem(EDITOR_KEY(email), String(isEditor));
    localStorage.setItem(EDITOR_TS_KEY(email), String(Date.now()));
  } catch {
    // ignore
  }
}
