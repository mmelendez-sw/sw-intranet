/**
 * Local dev server wrapping the SharePoint TV cards Lambda handler.
 * Run: npm run api
 *
 * Env (server/.env) — see server/.env.example and docs/MICROSOFT_SETUP.md
 */

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

  res.writeHead(result.statusCode, result.headers);
  if (result.isBase64Encoded) {
    res.end(Buffer.from(result.body, 'base64'));
  } else {
    res.end(result.body);
  }
});

server.listen(PORT, () => {
  console.log(`Intranet API listening on http://localhost:${PORT}`);
  console.log('  GET /api/tv-cards');
  console.log('  GET /api/tv-cards/meta');
  console.log('  GET /api/images/:driveItemId');
  console.log('  GET /api/images/by-url?url=');
});
