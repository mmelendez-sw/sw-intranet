# Ticket 3: Patient Search Pagination

**Ticket:** GET /api/patients/search returns all matches. Add pagination (page, limit) and ensure results are deterministic for consistent paging.

**Priority:** Medium | **Estimate:** 2–4 hours

---

## Acceptance Criteria

- [ ] Query params: `q` (search), `page` (default 1), `limit` (default 20, max 100)
- [ ] Response includes `{ data, pagination: { page, limit, total, totalPages } }`
- [ ] Results ordered by patient ID (or created_at) for deterministic paging
- [ ] Empty search `q` returns 400

---

## Step-by-Step Walkthrough

### 1. Find the Search Endpoint

- `GET /api/patients/search` or similar
- See how search is implemented (DB query, Elasticsearch, etc.)

### 2. Add Query Validation

```typescript
const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query required'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
```

### 3. Update Repository/Query

- Add `OFFSET` and `LIMIT` (or equivalent)
- Add `ORDER BY id` (or stable sort)
- Run count query for total (or use window function)

### 4. Response Shape

```typescript
interface PaginatedPatients {
  data: Patient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### 5. Things to mention

- "Ordering by ID ensures no duplicates/skips when data changes between pages."
- "We could add cursor-based pagination for very large result sets."
- "Search might need debouncing on the frontend to avoid hammering the API."
