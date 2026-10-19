/**
 * Weekly sign-in: an interactive login is good for 7 days, then the browser's MSAL session is
 * dropped and the welcome page asks the user to log in again. Silent token refresh would
 * otherwise keep a tab signed in indefinitely, along with its cached per-user state.
 */
import { EventType, type AuthenticationResult, type IPublicClientApplication } from '@azure/msal-browser';
import { clearUserSessionState } from './signOutCleanup';

export const SIGN_IN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const STAMP_KEY = (homeAccountId: string) => `intranet_signed_in_at:${homeAccountId}`;

function readStamp(homeAccountId: string): number | null {
  try {
    const value = parseInt(localStorage.getItem(STAMP_KEY(homeAccountId)) || '', 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStamp(homeAccountId: string, at = Date.now()): void {
  try {
    localStorage.setItem(STAMP_KEY(homeAccountId), String(at));
  } catch {
    // ignore private mode
  }
}

function removeStamp(homeAccountId: string): void {
  try {
    localStorage.removeItem(STAMP_KEY(homeAccountId));
  } catch {
    // ignore
  }
}

/**
 * Stamp each interactive login. Register before handleRedirectPromise() so redirect logins
 * (mobile) are stamped too.
 */
export function trackInteractiveSignIns(instance: IPublicClientApplication): void {
  instance.addEventCallback((event) => {
    if (event.eventType !== EventType.LOGIN_SUCCESS) return;
    const account = (event.payload as AuthenticationResult | null)?.account;
    if (account) writeStamp(account.homeAccountId);
  });
}

/**
 * Sign out (locally — the Microsoft session is untouched) any account whose last interactive
 * login is over a week old. Accounts signed in before this shipped have no stamp; their week
 * starts now rather than logging everyone out at once. Call after handleRedirectPromise().
 */
export async function expireStaleSignIns(instance: IPublicClientApplication): Promise<void> {
  const now = Date.now();
  for (const account of instance.getAllAccounts()) {
    const signedInAt = readStamp(account.homeAccountId);
    if (signedInAt === null) {
      writeStamp(account.homeAccountId, now);
      continue;
    }
    if (now - signedInAt < SIGN_IN_MAX_AGE_MS) continue;
    clearUserSessionState(account.username);
    removeStamp(account.homeAccountId);
    try {
      await instance.clearCache({ account });
    } catch (err) {
      console.warn('[weeklySignIn] clearCache failed:', err);
    }
  }
}
