/**
 * Local dev server wrapping the shared Lambda handler.
 * Run: npm run tv-api
 *
 * Env (server/.env):
 *   Graph/TV:   TENANT_ID, CLIENT_ID, CLIENT_SECRET
 *   Salesforce: SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN?, SF_DOMAIN?
 *   Power BI:   POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_USERNAME,
 *               POWERBI_PASSWORD, POWERBI_REPORT_ID, POWERBI_WORKSPACE_ID?
 */

import * as http from 'http';
import { handler } from './handler';

const PORT = Number(process.env.API_PORT || process.env.TV_API_PORT || 3001);

const server = http.createServer(async (req, res) => {
  const rawUrl = req.url || '/';
  const parsed = new URL(rawUrl, `http://localhost:${PORT}`);
  const pathOnly = parsed.pathname;
  const queryStringParameters: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;
  });

  const result = await handler({
    httpMethod: req.method,
    path: pathOnly,
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
  console.log('  GET /api/salesforce/current-investments');
  console.log('  GET /api/powerbi/embed-token?reportId=');
});
