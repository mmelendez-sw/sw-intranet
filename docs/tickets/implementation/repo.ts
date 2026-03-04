/**
 * Repo - data access layer
 * All DB and external API calls go through here.
 * Mock implementations for study reference.
 */

import type { Record, CreateInput, UpdateInput, ListParams, SearchParams, Paginated, AuditEntry } from './types';

// ---------------------------------------------------------------------------
// Mock external API client (simulates calls to other microservices)
// ---------------------------------------------------------------------------

const mockApi = {
  async get<T>(url: string): Promise<T> {
    await delay(20);
    return {} as T;
  },
  async post<T>(url: string, body: unknown): Promise<T> {
    await delay(30);
    return body as T;
  },
  async patch<T>(url: string, body: unknown): Promise<T> {
    await delay(25);
    return body as T;
  },
  async delete(url: string): Promise<void> {
    await delay(15);
  },
};

// Mock auth service - validate token
async function mockAuthValidate(token: string): Promise<{ userId: string }> {
  await mockApi.get(`/auth/validate?token=${token}`);
  await delay(10);
  return { userId: 'u1' };
}

// Mock config service - feature flags
async function mockConfigGet(key: string): Promise<string | null> {
  await mockApi.get(`/config/${key}`);
  await delay(5);
  return null;
}

// Mock cache - get/set
async function mockCacheGet<T>(key: string): Promise<T | null> {
  await mockApi.get(`/cache/${key}`);
  await delay(5);
  return null;
}
async function mockCacheSet(key: string, val: unknown, ttl?: number): Promise<void> {
  await mockApi.post(`/cache/${key}`, { val, ttl });
  await delay(8);
}

// Mock metrics - increment
async function mockMetricsInc(name: string, tags?: Record<string, string>): Promise<void> {
  await mockApi.post('/metrics/inc', { name, tags });
  await delay(3);
}

// Mock AI inference service call
async function mockAiSummarize(text: string): Promise<{ chiefComplaint: string; assessment: string; plan: string }> {
  await mockApi.post('/ai/summarize', { text });
  await delay(50);
  const words = text.split(/\s+/).slice(0, 50).join(' ');
  return {
    chiefComplaint: words || 'N/A',
    assessment: 'Mock assessment',
    plan: 'Mock plan',
  };
}

// Mock audit service call
async function mockAuditLog(recordId: string, action: string, userId: string): Promise<void> {
  await mockApi.post('/audit/log', { recordId, action, userId });
  await delay(10);
}

// Mock DB (in-memory for reference)
// ---------------------------------------------------------------------------

const store = new Map<string, Record>();

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Repo methods - each does mock DB + optional external calls
// ---------------------------------------------------------------------------

export const repo = {
  async findById(id: string): Promise<Record | null> {
    const cached = await mockCacheGet<Record>(`record:${id}`);
    if (cached) return cached;
    await mockApi.get(`/db/records/${id}`);
    await delay(15);
    const record = store.get(id) ?? null;
    if (record) await mockCacheSet(`record:${id}`, record, 60);
    return record;
  },

  async list(params: ListParams): Promise<Paginated<Record>> {
    await mockApi.get('/db/records');
    await delay(25);
    let rows = Array.from(store.values());
    if (params.status) {
      rows = rows.filter((r) => r.status === params.status);
    }
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const total = rows.length;
    const data = rows.slice((page - 1) * limit, page * limit);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  },

  async search(params: SearchParams): Promise<Paginated<Record>> {
    await mockApi.get(`/search?q=${encodeURIComponent(params.q)}`);
    await delay(40);
    const q = params.q.toLowerCase();
    let rows = Array.from(store.values()).filter(
      (r) => r.noteText.toLowerCase().includes(q) || r.id.includes(q)
    );
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const total = rows.length;
    const data = rows.slice((page - 1) * limit, page * limit);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  },

  async create(input: CreateInput): Promise<Record> {
    await mockConfigGet('records.create.enabled');
    await mockApi.post('/db/records', input);
    await delay(20);
    await mockMetricsInc('records.created');
    const record: Record = {
      id: id(),
      noteText: input.noteText,
      status: 'draft',
      createdAt: now(),
      updatedAt: now(),
    };
    store.set(record.id, record);
    return record;
  },

  async update(id: string, input: UpdateInput): Promise<Record | null> {
    await mockApi.patch(`/db/records/${id}`, input);
    await delay(20);
    const existing = store.get(id);
    if (!existing) return null;
    const updated: Record = {
      ...existing,
      ...input,
      updatedAt: now(),
    };
    store.set(id, updated);
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    await mockApi.delete(`/db/records/${id}`);
    await delay(15);
    const ok = store.delete(id);
    if (ok) await mockApi.delete(`/cache/record:${id}`); // invalidate cache
    if (ok) await mockMetricsInc('records.deleted');
    return ok;
  },

  async summarize(id: string): Promise<Record | null> {
    const record = await this.findById(id);
    if (!record) return null;
    const summary = await mockAiSummarize(record.noteText);
    await this.update(id, { ...record, summary });
    return (await this.findById(id)) ?? null;
  },

  async getAudit(recordId: string): Promise<AuditEntry[]> {
    await mockApi.get(`/audit/records/${recordId}`);
    await delay(20);
    return [
      { id: 'a1', recordId, action: 'create', userId: 'u1', timestamp: now() },
      { id: 'a2', recordId, action: 'view', userId: 'u1', timestamp: now() },
    ];
  },

  async logAudit(recordId: string, action: string, userId: string): Promise<void> {
    await mockAuditLog(recordId, action, userId);
  },
};
