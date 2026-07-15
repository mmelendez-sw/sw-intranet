const http = require('http');
const { getCurrentInvestments } = require('./salesforce');

const PORT = Number(process.env.API_PORT || process.env.TV_API_PORT || 3001);

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, jsonHeaders);
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    if (url.pathname === '/api/salesforce/current-investments') {
      const data = await getCurrentInvestments();
      sendJson(res, 200, data);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[api]', err);
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'API request failed',
    });
  }
});

server.listen(PORT, () => {
  console.log(`Local API listening on http://localhost:${PORT}`);
  console.log('  GET /api/salesforce/current-investments');
});
