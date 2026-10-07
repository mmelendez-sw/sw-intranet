/**
 * Detects a newer deploy from an already-open tab. dist/version.json is written at build
 * time (webpack BuildVersionPlugin) with the same id baked into this bundle as __BUILD_ID__.
 */

const VERSION_URL = '/version.json';
/** Poll interval; also re-checked when the window regains focus. */
export const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Only production builds check (dev server rebuilds via HMR). */
export const VERSION_CHECK_ENABLED =
  process.env.NODE_ENV === 'production' && typeof __BUILD_ID__ === 'string' && !!__BUILD_ID__;

/** True when the deployed build differs from the running one; false on any error. */
export async function isNewVersionAvailable(): Promise<boolean> {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return false;
    // SPA rewrites can answer with index.html — treat anything non-JSON as "unknown".
    const data = (await res.json()) as { buildId?: unknown };
    return typeof data.buildId === 'string' && !!data.buildId && data.buildId !== __BUILD_ID__;
  } catch {
    return false;
  }
}
