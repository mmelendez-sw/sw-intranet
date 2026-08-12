require('./loadEnv');

const http = require('http');
const { handler } = require('./handler');

const PORT = Number(process.env.API_PORT || process.env.TV_API_PORT || 3001);

const server = http.createServer(async (req, res) => {
  const rawUrl = req.url || '/';
  const parsed = new URL(rawUrl, `http://localhost:${PORT}`);
  const queryStringParameters = {};
  parsed.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;
  });

  const result = await handler({
    httpMethod: req.method,
    path: parsed.pathname,
    queryStringParameters,
  });

  const headers = { ...(result.headers || {}) };
  let body = result.body || '';

  if (result.isBase64Encoded && typeof body === 'string') {
    body = Buffer.from(body, 'base64');
  }

  res.writeHead(result.statusCode, headers);
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`Intranet API listening on http://localhost:${PORT}`);
  console.log('  GET /api/powerbi/embed-token?reportId=');
  console.log('  GET /api/tv-cards');
  console.log('  GET /api/tv-cards/meta');
  console.log('  GET /api/images/:driveItemId');
  console.log('  GET /api/images/by-url?url=');
});
