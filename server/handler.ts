/**
 * AWS Lambda / API Gateway handler for /tv kiosk card loading.
 *
 * Required env vars:
 *   TENANT_ID, CLIENT_ID, CLIENT_SECRET
 *
 * App registration needs application permission Files.Read.All or Sites.Read.All
 * (admin consent).
 */

import { getHomepageCards } from './tvHomepageCards';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function handler(event?: { httpMethod?: string }): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  if (event?.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    const cards = await getHomepageCards(
      requireEnv('TENANT_ID'),
      requireEnv('CLIENT_ID'),
      requireEnv('CLIENT_SECRET')
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(cards),
    };
  } catch (err) {
    console.error('[tv-cards-api]', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to load homepage cards',
      }),
    };
  }
}
