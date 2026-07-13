/**
 * Local dev server for the TV cards + image proxy APIs.
 * Run: npm run tv-api
 * Requires .env with TENANT_ID, CLIENT_ID, CLIENT_SECRET (see server/.env.example).
 */

import * as http from 'http';
import { handler } from './handler';

const PORT = Number(process.env.TV_API_PORT || 3001);

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  const pathOnly = url.split('?')[0];

  if (req.method === 'OPTIONS') {
    const result = await handler({ httpMethod: 'OPTIONS', path: pathOnly });
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
    return;
  }

  const isCards = pathOnly === '/api/tv-cards' || pathOnly === '/';
  const isMeta = pathOnly === '/api/tv-cards/meta';
  const isImage = /^\/api\/images\/[^/]+$/i.test(pathOnly);

  if (!isCards && !isMeta && !isImage) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const result = await handler({ httpMethod: req.method, path: pathOnly });
  res.writeHead(result.statusCode, result.headers);

  if (result.isBase64Encoded) {
    res.end(Buffer.from(result.body, 'base64'));
  } else {
    res.end(result.body);
  }
});

server.listen(PORT, () => {
  console.log(`TV API listening on http://localhost:${PORT}`);
  console.log(`  GET /api/tv-cards`);
  console.log(`  GET /api/tv-cards/meta`);
  console.log(`  GET /api/images/:driveItemId`);
});
