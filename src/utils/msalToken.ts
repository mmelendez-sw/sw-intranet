/**
 * Centralized MSAL token acquisition for background/automatic API calls.
 *
 * Uses silent refresh only — never opens login popups. Concurrent callers
 * with the same scopes share one in-flight request so a token failure cannot
 * spawn multiple Microsoft login windows.
 *
 * For expired sessions, users should use the header Login button.
 */

const inFlightByScopes = new Map<string, Promise<string | null>>();

const scopesKey = (scopes: string[]): string => [...scopes].sort().join(' ');

async function acquireTokenSilentOnlyInner(
  msalInstance: any,
  scopes: string[]
): Promise<string | null> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts.length) return null;

  const account = accounts[0];
  const tokenRequest = { scopes, account };

  try {
    const result = await msalInstance.acquireTokenSilent(tokenRequest);
    return result.accessToken;
  } catch (silentError) {
    console.warn('[msalToken] acquireTokenSilent failed, trying forceRefresh', silentError);
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      ...tokenRequest,
      forceRefresh: true,
    });
    return result.accessToken;
  } catch (refreshError) {
    console.warn(
      '[msalToken] forceRefresh failed — use the Login button to re-authenticate',
      refreshError
    );
    return null;
  }
}

/** Acquire a Graph token silently. Returns null when re-login is required. */
export async function acquireTokenSilentOnly(
  msalInstance: any,
  scopes: string[]
): Promise<string | null> {
  const key = scopesKey(scopes);
  const pending = inFlightByScopes.get(key);
  if (pending) return pending;

  const request = acquireTokenSilentOnlyInner(msalInstance, scopes).finally(() => {
    if (inFlightByScopes.get(key) === request) {
      inFlightByScopes.delete(key);
    }
  });
  inFlightByScopes.set(key, request);
  return request;
}

/** Refresh the ID token when it has less than this left (the Lambda allows 5 min of clock skew). */
const ID_TOKEN_MIN_REMAINING_S = 5 * 60;

/**
 * Entra ID token for the intranet's own Lambda API (audience = this app registration).
 * Silent only, like acquireTokenSilentOnly; returns null when re-login is required.
 */
export async function acquireIdTokenSilentOnly(msalInstance: any): Promise<string | null> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts.length) return null;
  const request = { scopes: ['openid', 'profile'], account: accounts[0] };

  const isFresh = (result: any): boolean => {
    const exp = Number(result?.idTokenClaims?.exp);
    return !!result?.idToken && exp - Date.now() / 1000 > ID_TOKEN_MIN_REMAINING_S;
  };

  try {
    const result = await msalInstance.acquireTokenSilent(request);
    if (isFresh(result)) return result.idToken;
  } catch (silentError) {
    console.warn('[msalToken] ID token silent acquire failed, trying forceRefresh', silentError);
  }

  try {
    const result = await msalInstance.acquireTokenSilent({ ...request, forceRefresh: true });
    return result?.idToken || null;
  } catch (refreshError) {
    console.warn('[msalToken] ID token refresh failed — use the Login button to re-authenticate', refreshError);
    return null;
  }
}

export const SHAREPOINT_SCOPES = ['Sites.ReadWrite.All', 'Files.ReadWrite.All'];
export const DIRECTORY_SCOPES = ['User.Read.All'];
export const GRAPH_GROUP_SCOPES = ['User.Read', 'GroupMember.Read.All'];

export function acquireSharePointToken(msalInstance: any): Promise<string | null> {
  return acquireTokenSilentOnly(msalInstance, SHAREPOINT_SCOPES);
}
