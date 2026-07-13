/**
 * Local dev server for the TV cards API.
 * Run: npm run tv-api
 * Requires .env with TENANT_ID, CLIENT_ID, CLIENT_SECRET (see server/.env.example).
 */

import * as http from 'http';
import { handler } from './handler';

const PORT = Number(process.env.TV_API_PORT || 3001);

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    const result = await handler({ httpMethod: 'OPTIONS' });
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
    return;
  }

  if (req.url !== '/api/tv-cards' && req.url !== '/') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const result = await handler({ httpMethod: req.method });
  res.writeHead(result.statusCode, result.headers);
  res.end(result.body);
});

server.listen(PORT, () => {
  console.log(`TV cards API listening on http://localhost:${PORT}/api/tv-cards`);
});
