/**
 * Server-side homepage cards fetch (client credentials).
 * Used by server/handler.ts — secrets stay in env vars, never in the browser bundle.
 */

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

export async function getGraphToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const resp = await fetch(
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

  const data = (await resp.json()) as TokenResponse;
  return data.access_token;
}

/** Raw JSON from homepage-cards.json (array or { cards: [...] } wrapper). */
export async function getHomepageCardsRaw(token: string): Promise<unknown> {
  const url = `https://graph.microsoft.com/v1.0/drives/${TV_SHAREPOINT_DRIVE_ID}/items/${TV_HOMEPAGE_CARDS_ITEM_ID}/content`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    throw new Error(`Graph request failed: ${resp.status} ${await resp.text()}`);
  }

  const text = await resp.text();
  if (!text.trim()) return [];
  return JSON.parse(text) as unknown;
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
