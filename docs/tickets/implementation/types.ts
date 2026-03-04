/**
 * Shared types - controller, service, repo all use these
 */

export interface Record {
  id: string;
  noteText: string;
  summary?: { chiefComplaint: string; assessment: string; plan: string };
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CreateInput {
  noteText: string;
}

export interface UpdateInput {
  noteText?: string;
  status?: 'draft' | 'active' | 'archived';
}

export interface ListParams {
  page?: number;
  limit?: number;
  status?: string;
}

export interface SearchParams {
  q: string;
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AuditEntry {
  id: string;
  recordId: string;
  action: string;
  userId: string;
  timestamp: string;
}
