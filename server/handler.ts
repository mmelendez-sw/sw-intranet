/**
 * AWS Lambda / API Gateway (or Function URL) handler for intranet APIs.
 *
 * Routes:
 *   GET /api/tv-cards              — homepage cards (SharePoint)
 *   GET /api/tv-cards/meta         — eTag / lastModified only
 *   GET /api/images/:id            — proxy SharePoint drive item bytes
 *   GET /api/images/by-url?url=    — proxy SharePoint webUrl bytes
 *   GET /api/salesforce/current-investments
 *   GET /api/powerbi/embed-token?reportId=
 *
 * Env vars (set on the Lambda — never in the Amplify frontend build):
 *   Graph/TV:      TENANT_ID, CLIENT_ID, CLIENT_SECRET
 *   Salesforce:    SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN?, SF_DOMAIN?
 *   Power BI:      POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_USERNAME,
 *                  POWERBI_PASSWORD, POWERBI_REPORT_ID, POWERBI_WORKSPACE_ID?
 */

import { getGraphToken, getHomepageCardsMeta } from './tvHomepageCards';
import { getHomepageCardsWithImages } from './enrichCards';
import {
  getDriveImageContent,
  getDriveImageContentByWebUrl,
  clearDefaultImagesCache,
} from './tvImages';
import { getCurrentInvestments } from './salesforce';
import { getEmbedConfig } from './powerbi';

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

function isSalesforceInvestmentsPath(path: string): boolean {
  return /\/api\/salesforce\/current-investments\/?$/i.test(path);
}

function isPowerbiEmbedTokenPath(path: string): boolean {
  return /\/api\/powerbi\/embed-token\/?$/i.test(path);
}

type LambdaResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
};

export async function handler(event?: {
  httpMethod?: string;
  path?: string;
  rawPath?: string;
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: { http?: { path?: string; method?: string } };
}): Promise<LambdaResult> {
  const method = event?.httpMethod || event?.requestContext?.http?.method || 'GET';
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }

  const path = getPath(event);
  const query = getQuery(event);

  try {
    // ── Salesforce (no Graph credentials required) ──
    if (isSalesforceInvestmentsPath(path)) {
      const data = await getCurrentInvestments();
      return {
        statusCode: 200,
        headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
        body: JSON.stringify(data),
      };
    }

    // ── Power BI embed token (no Graph credentials required) ──
    if (isPowerbiEmbedTokenPath(path)) {
      const data = await getEmbedConfig(query.reportId || undefined);
      return {
        statusCode: 200,
        headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
        body: JSON.stringify(data),
      };
    }

    // ── TV / SharePoint routes below need Graph app credentials ──
    const tenantId = requireEnv('TENANT_ID');
    const clientId = requireEnv('CLIENT_ID');
    const clientSecret = requireEnv('CLIENT_SECRET');
    const imageItemId = matchImageProxy(path);

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
    console.error('[intranet-api]', err);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'API request failed',
      }),
    };
  }
}
