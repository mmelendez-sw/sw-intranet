/**
 * AWS Lambda / API Gateway handler for /tv kiosk APIs.
 *
 * Routes:
 *   GET /api/tv-cards        — homepage cards (empty imageUrl → /api/images/{id})
 *   GET /api/tv-cards/meta   — eTag / lastModified only (cheap change detection)
 *   GET /api/images/:id      — proxy SharePoint drive item bytes
 *   GET /api/images/by-url?url= — proxy SharePoint webUrl bytes (app credentials)
 *
 * Required env vars:
 *   TENANT_ID, CLIENT_ID, CLIENT_SECRET
 *
 * App registration needs application permission Files.Read.All or Sites.Read.All
 * (admin consent).
 */

import { getGraphToken, getHomepageCardsMeta } from './tvHomepageCards';
import { getHomepageCardsWithImages } from './enrichCards';
import {
  getDriveImageContent,
  getDriveImageContentByWebUrl,
  clearDefaultImagesCache,
} from './tvImages';

const JSON_HEADERS = {
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

function getPath(event?: {
  httpMethod?: string;
  path?: string;
  rawPath?: string;
  requestContext?: { http?: { path?: string } };
}): string {
  return (
    event?.rawPath ||
    event?.path ||
    event?.requestContext?.http?.path ||
    ''
  );
}

function getQuery(
  event?: {
    queryStringParameters?: Record<string, string | undefined> | null;
  }
): Record<string, string> {
  const raw = event?.queryStringParameters || {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function matchImageProxy(path: string): string | null {
  if (/\/api\/images\/by-url\/?$/i.test(path)) return null;
  const match = path.match(/\/api\/images\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function isImageByUrlPath(path: string): boolean {
  return /\/api\/images\/by-url\/?$/i.test(path);
}

function isCardsMetaPath(path: string): boolean {
  return /\/api\/tv-cards\/meta\/?$/i.test(path) || /\/tv-cards\/meta\/?$/i.test(path);
}

function isCardsPath(path: string): boolean {
  return (
    path === '/' ||
    /\/api\/tv-cards\/?$/i.test(path) ||
    /\/tv-cards\/?$/i.test(path)
  );
}

export async function handler(event?: {
  httpMethod?: string;
  path?: string;
  rawPath?: string;
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: { http?: { path?: string; method?: string } };
}): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}> {
  const method = event?.httpMethod || event?.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }

  const path = getPath(event);
  const query = getQuery(event);
  const imageItemId = matchImageProxy(path);

  try {
    const tenantId = requireEnv('TENANT_ID');
    const clientId = requireEnv('CLIENT_ID');
    const clientSecret = requireEnv('CLIENT_SECRET');

    if (isImageByUrlPath(path)) {
      const webUrl = (query.url || '').trim();
      if (!webUrl) {
        return {
          statusCode: 400,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Missing url query parameter' }),
        };
      }
      const token = await getGraphToken(tenantId, clientId, clientSecret);
      const result = await getDriveImageContentByWebUrl(webUrl, token);
      if (!result) {
        return {
          statusCode: 404,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Could not fetch SharePoint image' }),
        };
      }
      return {
        statusCode: 200,
        headers: {
          'Content-Type': result.contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
        },
        body: Buffer.from(result.body).toString('base64'),
        isBase64Encoded: true,
      };
    }

    if (imageItemId) {
      const token = await getGraphToken(tenantId, clientId, clientSecret);
      const { body, contentType } = await getDriveImageContent(imageItemId, token);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
        },
        body: Buffer.from(body).toString('base64'),
        isBase64Encoded: true,
      };
    }

    if (isCardsMetaPath(path)) {
      const token = await getGraphToken(tenantId, clientId, clientSecret);
      const meta = await getHomepageCardsMeta(token);
      return {
        statusCode: 200,
        headers: {
          ...JSON_HEADERS,
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify(meta),
      };
    }

    if (!isCardsPath(path)) {
      return {
        statusCode: 404,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'Not found' }),
      };
    }

    // Full cards payload — bust Default Images list cache so edits show up soon
    clearDefaultImagesCache();
    const cards = await getHomepageCardsWithImages(tenantId, clientId, clientSecret);
    return {
      statusCode: 200,
      headers: {
        ...JSON_HEADERS,
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(cards),
    };
  } catch (err) {
    console.error('[tv-api]', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'TV API request failed',
      }),
    };
  }
}
