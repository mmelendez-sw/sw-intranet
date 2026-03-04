/**
 * Controller - HTTP layer
 * Validates request, calls service, formats response.
 * All routes go through controller.
 */

import { service } from './service';
import { ValidationError, NotFoundError } from './errors';

type Req = { params?: Record<string, string>; query?: Record<string, string | undefined>; body?: unknown };
type Res = { status: (n: number) => { json: (o: unknown) => void } };

// ---------------------------------------------------------------------------
// Validation helpers (inline - could be middleware)
// ---------------------------------------------------------------------------

function parseBody<T>(body: unknown, validator: (b: unknown) => T): T {
  return validator(body);
}

function parseQuery<T>(query: Record<string, string | undefined> | undefined, validator: (q: unknown) => T): T {
  return validator(query ?? {});
}

function requireId(params: Record<string, string> | undefined): string {
  const id = params?.id;
  if (!id) throw new ValidationError('id required');
  return id;
}

// ---------------------------------------------------------------------------
// Handlers - one per endpoint
// ---------------------------------------------------------------------------

export async function getById(req: Req, res: Res): Promise<void> {
  const id = requireId(req.params);
  const record = await service.getById(id);
  res.status(200).json(record);
}

export async function list(req: Req, res: Res): Promise<void> {
  const params = parseQuery(req.query, (q) => ({
    page: q?.page ? parseInt(String(q.page), 10) : 1,
    limit: q?.limit ? parseInt(String(q.limit), 10) : 20,
    status: q?.status,
  }));
  const result = await service.list(params);
  res.status(200).json(result);
}

export async function search(req: Req, res: Res): Promise<void> {
  const params = parseQuery(req.query, (q) => ({
    q: String(q?.q ?? ''),
    page: q?.page ? parseInt(String(q.page), 10) : 1,
    limit: q?.limit ? parseInt(String(q.limit), 10) : 20,
  }));
  const result = await service.search(params);
  res.status(200).json(result);
}

export async function create(req: Req, res: Res): Promise<void> {
  const input = parseBody(req.body, (b) => {
    if (!b || typeof b !== 'object' || !('noteText' in b)) throw new ValidationError('noteText required');
    const noteText = (b as { noteText: unknown }).noteText;
    if (typeof noteText !== 'string') throw new ValidationError('noteText must be string');
    return { noteText: noteText.trim() };
  });
  const record = await service.create(input);
  res.status(201).json(record);
}

export async function update(req: Req, res: Res): Promise<void> {
  const id = requireId(req.params);
  const input = parseBody(req.body, (b) => {
    if (!b || typeof b !== 'object') return {};
    const x = b as Record<string, unknown>;
    return {
      noteText: typeof x.noteText === 'string' ? x.noteText : undefined,
      status: ['draft', 'active', 'archived'].includes(String(x.status)) ? x.status : undefined,
    };
  });
  const record = await service.update(id, input);
  res.status(200).json(record);
}

export async function remove(req: Req, res: Res): Promise<void> {
  const id = requireId(req.params);
  await service.delete(id);
  res.status(204).json(null);
}

export async function summarize(req: Req, res: Res): Promise<void> {
  const id = requireId(req.params);
  const record = await service.summarize(id);
  res.status(200).json(record);
}

export async function getAudit(req: Req, res: Res): Promise<void> {
  const id = requireId(req.params);
  const result = await service.getAudit(id);
  res.status(200).json(result);
}

export async function health(req: Req, res: Res): Promise<void> {
  const result = await service.health();
  res.status(200).json(result);
}

// ---------------------------------------------------------------------------
// Error handler - map AppError to HTTP
// ---------------------------------------------------------------------------

export function handleError(err: unknown, res: Res): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    return;
  }
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
