/** Default upstream timeout: a hung Graph/Salesforce/Entra call shouldn't burn the whole Lambda timeout. */
export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

/** fetch() that aborts after `timeoutMs` (rejects with a TimeoutError DOMException). */
export function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
