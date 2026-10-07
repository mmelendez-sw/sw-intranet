/**
 * Cached Entra group membership for fast first paint (stale-while-revalidate).
 */

// Keys use the lowercased email so "Jane@x.com" and "jane@x.com" share one entry.
// Reads fall back to the pre-normalization mixed-case key once (see readFlag).
const ELITE_KEY = (email: string) => `elite_status_${email}`;
const ELITE_TS_KEY = (email: string) => `elite_status_timestamp_${email}`;
const EDITOR_KEY = (email: string) => `editor_status_${email}`;
const EDITOR_TS_KEY = (email: string) => `editor_status_timestamp_${email}`;

const normalizeEmail = (email: string): string => (email || '').trim().toLowerCase();

/** Remove both the normalized and legacy mixed-case entries (debug helpers / sign-out). */
export function clearCachedGroupStatus(email: string): void {
  const keys = new Set([email, normalizeEmail(email)]);
  try {
    keys.forEach((k) => {
      localStorage.removeItem(ELITE_KEY(k));
      localStorage.removeItem(ELITE_TS_KEY(k));
      localStorage.removeItem(EDITOR_KEY(k));
      localStorage.removeItem(EDITOR_TS_KEY(k));
    });
  } catch {
    // ignore
  }
}

/** Fresh cache window — still used for "should we skip network?" decisions. */
export const GROUP_STATUS_TTL_MS = 24 * 60 * 60 * 1000;

export type CachedFlag = {
  value: boolean | null;
  /** True when a value exists and is within TTL. */
  fresh: boolean;
  /** True when any value exists (even expired) — safe for optimistic first paint. */
  present: boolean;
};

function readFlag(
  keyFn: (email: string) => string,
  tsKeyFn: (email: string) => string,
  email: string
): CachedFlag {
  const normalized = readFlagAt(keyFn(normalizeEmail(email)), tsKeyFn(normalizeEmail(email)));
  if (normalized.present || normalizeEmail(email) === email) return normalized;
  return readFlagAt(keyFn(email), tsKeyFn(email));
}

function readFlagAt(valueKey: string, tsKey: string): CachedFlag {
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
  return readFlag(ELITE_KEY, ELITE_TS_KEY, email);
}

export function readCachedEditorStatus(email: string): CachedFlag {
  return readFlag(EDITOR_KEY, EDITOR_TS_KEY, email);
}

export function writeCachedEliteStatus(email: string, isElite: boolean): void {
  try {
    const key = normalizeEmail(email);
    localStorage.setItem(ELITE_KEY(key), String(isElite));
    localStorage.setItem(ELITE_TS_KEY(key), String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
}

export function writeCachedEditorStatus(email: string, isEditor: boolean): void {
  try {
    const key = normalizeEmail(email);
    localStorage.setItem(EDITOR_KEY(key), String(isEditor));
    localStorage.setItem(EDITOR_TS_KEY(key), String(Date.now()));
  } catch {
    // ignore
  }
}
