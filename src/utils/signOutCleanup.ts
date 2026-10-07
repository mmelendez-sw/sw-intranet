/**
 * Clears browser state tied to the signed-in user so the next person on a shared device
 * starts clean. Pair with a full reload (window.location.assign('/')) to drop module caches.
 */
import { clearCachedGroupStatus } from './groupStatusCache';

// Per-tab state: edit mode (EditMenuContext), alert dismissal, LeadGeneration redirect draft.
const SESSION_KEYS = ['intranet_edit_mode', 'alert-dismissed', 'leadgen_pending_restore'];
// Per-user localStorage prefixes (term-sheet leaderboard counts, v1 shared + v2 per-email).
const LOCAL_PREFIXES = ['term-sheet-leaderboard:'];

export function clearUserSessionState(email?: string): void {
  try {
    SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore private mode
  }
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
  if (email) clearCachedGroupStatus(email);
}
