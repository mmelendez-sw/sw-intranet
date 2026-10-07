/**
 * AWS Lambda / API Gateway (or Function URL) handler for intranet APIs.
 *
 * Routes:
 *   GET /api/tv-cards              — homepage cards (SharePoint)
 *   GET /api/tv-cards/meta         — eTag / lastModified only
 *   GET /api/images/:id            — proxy SharePoint drive item bytes
 *   GET /api/images/by-url?url=    — proxy SharePoint webUrl bytes
 *   GET /api/salesforce/current-investments       — signed-in users (Entra ID token)
 *   GET /api/salesforce/term-sheet-rankings       — signed-in users (Entra ID token)
 *   GET /api/powerbi/embed-token?reportId=
 *   POST /api/iceman/generate?max_rows=500 — Nearmap batch XLSX (multipart file); ICEMAN allowlist
 *
 * TV / image / Power BI routes stay unauthenticated: /tv kiosks run without a signed-in user.
 *
 * Env vars (set on the Lambda — never in the Amplify frontend build):
 *   Graph/TV:      TENANT_ID, CLIENT_ID, CLIENT_SECRET
 *   Salesforce:    SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN?, SF_DOMAIN?
 *   Power BI:      POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_USERNAME,
 *                  POWERBI_PASSWORD, POWERBI_REPORT_ID, POWERBI_WORKSPACE_ID?
 *   ICEMAN:        NEARMAP_API_KEY, ICEMAN_ALLOWED_EMAILS? (comma-separated; default below)
 *   Auth:          INTRANET_TENANT_ID?, INTRANET_CLIENT_ID?, INTRANET_API_AUTH_DISABLED? (see auth.ts)
 */

import { getGraphToken, getHomepageCardsMeta } from './tvHomepageCards';
import { getHomepageCardsWithImages } from './enrichCards';
import {
  getDriveImageContent,
  getDriveImageContentByWebUrl,
  clearDefaultImagesCache,
  ImageNotAllowedError,
} from './tvImages';
import { getCurrentInvestments, getTermSheetRankings } from './salesforce';
import { getEmbedConfig } from './powerbi';
import { parseMultipart } from './multipart';
import { generateIcemanWorkbook } from './iceman';
import { requireEnv } from './env';
import { AuthError, authenticateRequest } from './auth';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Mirrors ICEMAN_ALLOWLIST in src/authConfig.ts; override with ICEMAN_ALLOWED_EMAILS on the Lambda. */
const DEFAULT_ICEMAN_ALLOWED_EMAILS = 'mmelendez@symphonyinfra.com';

function isIcemanAllowed(email: string): boolean {
  const allowed = (process.env.ICEMAN_ALLOWED_EMAILS || DEFAULT_ICEMAN_ALLOWED_EMAILS)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Some sign-in names (UPNs) still use the legacy symphonywireless.com domain.
  return allowed.includes(email.replace(/@symphonywireless\.com$/, '@symphonyinfra.com'));
}

function errorResult(statusCode: number, error: string): LambdaResult {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify({ error }) };
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

function isSalesforceTermSheetRankingsPath(path: string): boolean {
  return /\/api\/salesforce\/term-sheet-rankings\/?$/i.test(path);
}

function isPowerbiEmbedTokenPath(path: string): boolean {
  return /\/api\/powerbi\/embed-token\/?$/i.test(path);
}

function isIcemanGeneratePath(path: string): boolean {
  return /\/api\/iceman\/generate\/?$/i.test(path);
}

function getHeader(
  headers: Record<string, string | undefined> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
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
  body?: string;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
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
    // ── Signed-in routes: Salesforce data and ICEMAN (Nearmap spend) ──
    const needsAuth =
      isIcemanGeneratePath(path) ||
      isSalesforceInvestmentsPath(path) ||
      isSalesforceTermSheetRankingsPath(path);
    if (needsAuth) {
      try {
        const user = await authenticateRequest(getHeader(event?.headers, 'authorization'));
        if (user && isIcemanGeneratePath(path) && !isIcemanAllowed(user.email)) {
          return errorResult(403, 'ICEMAN is not enabled for this account.');
        }
      } catch (err) {
        if (err instanceof AuthError) return errorResult(401, err.message);
        throw err;
      }
    }

    // ── ICEMAN Nearmap batch (no Graph credentials required) ──
    if (isIcemanGeneratePath(path)) {
      if (method !== 'POST') {
        return {
          statusCode: 405,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        };
      }

      try {
        const contentType = getHeader(event?.headers, 'content-type');
        const parsed = await parseMultipart(
          event?.body,
          contentType,
          event?.isBase64Encoded
        );

        if (!parsed.file?.buffer?.length) {
          return {
            statusCode: 400,
            headers: JSON_HEADERS,
            body: JSON.stringify({ error: 'Missing file upload. Use multipart field name "file".' }),
          };
        }

        const maxRowsRaw = Number(query.max_rows || parsed.fields.max_rows || '500');
        const maxRows = Math.min(Math.max(1, Number.isFinite(maxRowsRaw) ? maxRowsRaw : 500), 500);

        const closeObliqueMeters = Number(
          query.close_m || parsed.fields.close_m || parsed.fields.closeObliqueMeters
        );
        const farObliqueMeters = Number(
          query.far_m || parsed.fields.far_m || parsed.fields.farObliqueMeters
        );

        const { buffer, filename } = await generateIcemanWorkbook(
          parsed.file.buffer,
          parsed.file.filename,
          maxRows,
          {
            closeObliqueMeters: Number.isFinite(closeObliqueMeters) ? closeObliqueMeters : undefined,
            farObliqueMeters: Number.isFinite(farObliqueMeters) ? farObliqueMeters : undefined,
          }
        );

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          },
          body: buffer.toString('base64'),
          isBase64Encoded: true,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ICEMAN request failed';
        const clientError =
          /^(missing request|missing latitude|unsupported|no valid|file has no data|upload too large)/i.test(msg);
        console.error('[iceman]', err);
        return errorResult(
          clientError ? 400 : 500,
          clientError ? msg : 'ICEMAN request failed. Check the Lambda logs for details.'
        );
      }
    }

    // ── Salesforce (no Graph credentials required) ──
    if (isSalesforceInvestmentsPath(path)) {
      const data = await getCurrentInvestments();
      return {
        statusCode: 200,
        headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
        body: JSON.stringify(data),
      };
    }

    if (isSalesforceTermSheetRankingsPath(path)) {
      const data = await getTermSheetRankings();
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
    if (err instanceof ImageNotAllowedError) return errorResult(404, 'Image not found');
    // Details go to CloudWatch only; raw upstream errors can include tenant and token details.
    console.error('[intranet-api]', err);
    return errorResult(500, 'API request failed');
  }
}
