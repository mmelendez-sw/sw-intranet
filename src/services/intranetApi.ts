/**
 * fetch() for the intranet Lambda's signed-in routes (Salesforce, ICEMAN): attaches the
 * signed-in user's Entra ID token as a Bearer header. See server/auth.ts.
 */
import { BYPASS_AUTH } from '../authConfig';
import { acquireIdTokenSilentOnly } from '../utils/msalToken';

export async function intranetApiFetch(
  msalInstance: any,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const idToken = BYPASS_AUTH ? null : await acquireIdTokenSilentOnly(msalInstance);
  if (idToken) headers.set('Authorization', `Bearer ${idToken}`);
  return fetch(url, { ...init, headers });
}
