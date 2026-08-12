require('./loadEnv');

// const { getCurrentInvestments } = require('./salesforce'); // disabled on this branch
const { getEmbedConfig } = require('./powerbi');
const {
  getHomepageCardsWithImages,
  getHomepageCardsMeta,
  getDriveImageContent,
  getDriveImageContentByWebUrl,
  isSharePointWebUrl,
} = require('./sharepoint');

// Function URL CORS already adds Access-Control-Allow-Origin; duplicating it
// here produces "*, *" and browsers block the response.
const IS_LAMBDA = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const CORS_HEADERS = IS_LAMBDA
  ? {}
  : {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  ...CORS_HEADERS,
};

function getPath(event) {
  return (
    (event && (event.rawPath || event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path))) ||
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
    (event && (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method))) ||
    'GET'
  );
}

/**
 * Lambda Function URL / API Gateway handler.
 * Handler setting in AWS: handler.handler
 */
exports.handler = async (event = {}) => {
  const method = getMethod(event);
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }

  const path = getPath(event);
  const query = getQuery(event);

  try {
    // Salesforce disabled on serena-tv-dev
    // if (/\/api\/salesforce\/current-investments\/?$/i.test(path)) {
    //   const data = await getCurrentInvestments();
    //   return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(data) };
    // }

    if (/\/api\/powerbi\/embed-token\/?$/i.test(path)) {
      const data = await getEmbedConfig(query.reportId || undefined);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(data) };
    }

    if (/\/api\/tv-cards\/meta\/?$/i.test(path)) {
      const meta = await getHomepageCardsMeta();
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(meta) };
    }

    if (/\/api\/tv-cards\/?$/i.test(path)) {
      const cards = await getHomepageCardsWithImages();
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ cards }) };
    }

    const imageById = path.match(/\/api\/images\/([^/]+)\/?$/i);
    if (imageById && imageById[1] !== 'by-url') {
      const { body, contentType } = await getDriveImageContent(decodeURIComponent(imageById[1]));
      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=300',
          ...CORS_HEADERS,
        },
        body: body.toString('base64'),
        isBase64Encoded: true,
      };
    }

    if (/\/api\/images\/by-url\/?$/i.test(path)) {
      const target = query.url || '';
      if (!isSharePointWebUrl(target)) {
        return {
          statusCode: 400,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'url must be a SharePoint webUrl' }),
        };
      }
      const result = await getDriveImageContentByWebUrl(target);
      if (!result) {
        return {
          statusCode: 404,
          headers: JSON_HEADERS,
          body: JSON.stringify({ error: 'Image not found' }),
        };
      }
      return {
        statusCode: 200,
        headers: {
          'Content-Type': result.contentType,
          'Cache-Control': 'public, max-age=300',
          ...CORS_HEADERS,
        },
        body: result.body.toString('base64'),
        isBase64Encoded: true,
      };
    }

    return {
      statusCode: 404,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Not found' }),
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
