/**
 * Service - business logic layer
 * Orchestrates repo calls, validates business rules.
 * Controller calls service, never repo directly.
 */

import { repo } from './repo';
import { NotFoundError, ValidationError } from './errors';
import type { Record, CreateInput, UpdateInput, ListParams, SearchParams, Paginated } from './types';

export const service = {
  async getById(id: string): Promise<Record> {
    const record = await repo.findById(id);
    if (!record) throw new NotFoundError('Record');
    return record;
  },

  async list(params: ListParams): Promise<Paginated<Record>> {
    return repo.list(params);
  },

  async search(params: SearchParams): Promise<Paginated<Record>> {
    if (!params.q?.trim()) throw new ValidationError('Search query required');
    return repo.search(params);
  },

  async create(input: CreateInput): Promise<Record> {
    if (!input.noteText?.trim()) throw new ValidationError('noteText required');
    if (input.noteText.length > 10000) throw new ValidationError('noteText max 10000 chars');
    return repo.create(input);
  },

  async update(id: string, input: UpdateInput): Promise<Record> {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundError('Record');
    if (input.noteText !== undefined && input.noteText.length > 10000) {
      throw new ValidationError('noteText max 10000 chars');
    }
    const updated = await repo.update(id, input);
    if (!updated) throw new NotFoundError('Record');
    return updated;
  },

  async delete(id: string): Promise<void> {
    const existed = await repo.delete(id);
    if (!existed) throw new NotFoundError('Record');
  },

  async summarize(id: string): Promise<Record> {
    const record = await repo.summarize(id);
    if (!record) throw new NotFoundError('Record');
    return record;
  },

  async getAudit(recordId: string): Promise<{ entries: Awaited<ReturnType<typeof repo.getAudit>> }> {
    const record = await repo.findById(recordId);
    if (!record) throw new NotFoundError('Record');
    const entries = await repo.getAudit(recordId);
    return { entries };
  },

  async health(): Promise<{ status: string; timestamp: string }> {
    return { status: 'ok', timestamp: new Date().toISOString() };
  },
};
