/**
 * AWS Lambda Function URL handler for SharePoint homepage cards.
 *
 * Handler setting in AWS: handler.handler
 *
 * Routes:
 *   GET /api/tv-cards
 *   GET /api/tv-cards/meta
 *   GET /api/images/:driveItemId
 *   GET /api/images/by-url?url=
 *
 * Secrets stay on Lambda env — never in Amplify / the frontend.
 */

const {
  getHomepageCardsWithImages,
  getHomepageCardsMeta,
  getDriveImageContent,
  getDriveImageContentByWebUrl,
} = require('./sharepoint');

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

function getPath(event) {
  return (
    (event &&
      (event.rawPath ||
        event.path ||
        (event.requestContext &&
          event.requestContext.http &&
          event.requestContext.http.path))) ||
    ''
  );
}

function getQuery(event) {
  const raw = (event && event.queryStringParameters) || {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function getMethod(event) {
  return (
    (event &&
      (event.httpMethod ||
        (event.requestContext &&
          event.requestContext.http &&
          event.requestContext.http.method))) ||
    'GET'
  );
}

function matchImageProxy(path) {
  if (/\/api\/images\/by-url\/?$/i.test(path)) return null;
  const match = path.match(/\/api\/images\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function isImageByUrlPath(path) {
  return /\/api\/images\/by-url\/?$/i.test(path);
}

function isCardsMetaPath(path) {
  return /\/api\/tv-cards\/meta\/?$/i.test(path) || /\/tv-cards\/meta\/?$/i.test(path);
}

function isCardsPath(path) {
  return (
    path === '/' ||
    /\/api\/tv-cards\/?$/i.test(path) ||
    /\/tv-cards\/?$/i.test(path)
  );
}

exports.handler = async (event = {}) => {
  const method = getMethod(event);
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }

  const path = getPath(event);
  const query = getQuery(event);

  try {
    if (isImageByUrlPath(path)) {
      const webUrl = (query.url || '').trim();
      if (!webUrl) {
        return {
          statusCode: 400,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Missing url query parameter' }),
        };
      }
      const result = await getDriveImageContentByWebUrl(webUrl);
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

    const imageItemId = matchImageProxy(path);
    if (imageItemId) {
      const { body, contentType } = await getDriveImageContent(imageItemId);
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
      const meta = await getHomepageCardsMeta();
      return {
        statusCode: 200,
        headers: JSON_HEADERS,
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

    const cards = await getHomepageCardsWithImages();
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ cards }),
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
};
