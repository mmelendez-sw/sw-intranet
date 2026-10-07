/**
 * Server-side homepage cards fetch (client credentials).
 * Used by server/handler.ts — secrets stay in env vars, never in the browser bundle.
 */

import { fetchWithTimeout } from './fetchWithTimeout';

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/** Matches homepage-cards.json items in SharePoint. */
export interface HomepageCard {
  order: number;
  title: string;
  bullets: string[];
  imageUrl: string;
  imageIndex?: number;
  createdBy?: string;
  editedBy?: string;
}

export const TV_SHAREPOINT_DRIVE_ID =
  'b!PRZFjpqB2U6dHC5-1xRK-ckNeOcC0b9OuYzaxCUuqlF98qlI6Tz8RYjJa1ViXSq_';
export const TV_HOMEPAGE_CARDS_ITEM_ID = '01UIS5FCXU77HFE7F73JAI4TKRF5NURVFT';

export function parseHomepageCardsContent(raw: unknown): HomepageCard[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as HomepageCard[];
  if (typeof raw === 'object' && Array.isArray((raw as { cards?: HomepageCard[] }).cards)) {
    return (raw as { cards: HomepageCard[] }).cards;
  }
  return [];
}

/** Refresh the app token this long before Entra says it expires. */
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60_000;
let graphTokenCache: { key: string; token: string; expiresAt: number } | null = null;
let graphTokenInFlight: { key: string; promise: Promise<string> } | null = null;

async function requestGraphToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ token: string; expiresAt: number }> {
  const resp = await fetchWithTimeout(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Token request failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as Partial<TokenResponse>;
  if (!data.access_token) throw new Error('Token response missing access_token');
  const expiresInMs = (Number(data.expires_in) || 0) * 1000;
  return { token: data.access_token, expiresAt: Date.now() + expiresInMs - TOKEN_EXPIRY_MARGIN_MS };
}

/** Client-credentials Graph token, reused across warm invocations until shortly before expiry. */
export async function getGraphToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const key = `${tenantId}|${clientId}`;
  if (graphTokenCache?.key === key && Date.now() < graphTokenCache.expiresAt) {
    return graphTokenCache.token;
  }
  // Concurrent requests on a cold container share one token request.
  if (graphTokenInFlight?.key === key) return graphTokenInFlight.promise;

  const promise = requestGraphToken(tenantId, clientId, clientSecret)
    .then(({ token, expiresAt }) => {
      graphTokenCache = { key, token, expiresAt };
      return token;
    })
    .finally(() => {
      if (graphTokenInFlight?.promise === promise) graphTokenInFlight = null;
    });
  graphTokenInFlight = { key, promise };
  return promise;
}

/** Raw JSON from homepage-cards.json (array or { cards: [...] } wrapper). */
export async function getHomepageCardsRaw(token: string): Promise<unknown> {
  const url = `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}/items/${TV_HOMEPAGE_CARDS_ITEM_ID}/content`;

  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    throw new Error(`Graph request failed: ${resp.status} ${await resp.text()}`);
  }

  const text = await resp.text();
  if (!text.trim()) return [];
  return JSON.parse(text) as unknown;
}

export interface HomepageCardsMeta {
  eTag: string | null;
  cTag: string | null;
  lastModifiedDateTime: string | null;
}

/** Lightweight metadata for change detection (no file content download). */
export async function getHomepageCardsMeta(token: string): Promise<HomepageCardsMeta> {
  const url =
    `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}` +
    `/items/${TV_HOMEPAGE_CARDS_ITEM_ID}?$select=eTag,cTag,lastModifiedDateTime`;

  const resp = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    throw new Error(`Graph meta request failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    eTag?: string;
    cTag?: string;
    lastModifiedDateTime?: string;
  };

  return {
    eTag: data.eTag ?? null,
    cTag: data.cTag ?? null,
    lastModifiedDateTime: data.lastModifiedDateTime ?? null,
  };
}

/** Stable fingerprint for comparing two meta responses. */
export function homepageCardsMetaFingerprint(meta: HomepageCardsMeta): string {
  return `${meta.eTag || meta.cTag || ''}|${meta.lastModifiedDateTime || ''}`;
}

export async function getHomepageCards(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<HomepageCard[]> {
  const token = await getGraphToken(tenantId, clientId, clientSecret);
  const raw = await getHomepageCardsRaw(token);
  return parseHomepageCardsContent(raw);
}
