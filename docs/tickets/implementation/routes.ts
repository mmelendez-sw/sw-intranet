/**
 * Routes - wires controller handlers to paths
 * Express-style. Adapt method names for Fastify, Hono, etc.
 */

import * as ctrl from './controller';

export const routes = [
  { method: 'GET', path: '/health', handler: ctrl.health },
  { method: 'GET', path: '/records', handler: ctrl.list },
  { method: 'GET', path: '/records/search', handler: ctrl.search },
  { method: 'GET', path: '/records/:id', handler: ctrl.getById },
  { method: 'GET', path: '/records/:id/audit', handler: ctrl.getAudit },
  { method: 'POST', path: '/records', handler: ctrl.create },
  { method: 'POST', path: '/records/:id/summarize', handler: ctrl.summarize },
  { method: 'PATCH', path: '/records/:id', handler: ctrl.update },
  { method: 'DELETE', path: '/records/:id', handler: ctrl.remove },
];
