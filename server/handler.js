// const { getCurrentInvestments } = require('./salesforce'); // disabled on this branch
const { getEmbedConfig } = require('./powerbi');

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
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