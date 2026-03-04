# Ticket 4: AI Inference Endpoint (Async)

**Ticket:** The diagnosis suggestion endpoint times out for long notes. Convert to async: POST creates a job, GET /jobs/:id returns status and result when ready.

**Priority:** High | **Estimate:** 4–6 hours

---

## Acceptance Criteria

- [ ] POST /api/diagnosis-jobs creates job, returns `{ jobId, status: 'pending' }` immediately
- [ ] GET /api/diagnosis-jobs/:id returns `{ status, result? }` – result when status is 'completed'
- [ ] Jobs expire after 24 hours (mention cleanup strategy)
- [ ] 404 when job not found

---

## Step-by-Step Walkthrough

### 1. Understand Current Flow

- Find the sync diagnosis endpoint
- See how the model is invoked
- Identify timeout threshold

### 2. Job Storage

- In-memory Map (simple, loses on restart) – OK for interview
- Redis (production) – key: jobId, value: { status, result?, createdAt }
- DB table – status, result JSON, timestamps

### 3. POST Handler

- Generate jobId (UUID)
- Store job as `{ status: 'pending', createdAt: Date.now() }`
- Kick off inference in background (don't await)
- Return 202 with jobId

### 4. Background Worker

- When inference completes, update job with `{ status: 'completed', result }`
- On error: `{ status: 'failed', error: string }`

### 5. GET Handler

- Lookup job by ID
- Return current status and result if completed
- 404 if not found

### 6. Things to mention

- "We could add webhooks or polling guidance in the response."
- "Job cleanup: cron or TTL in Redis to avoid unbounded growth."
- "Consider idempotency if the same note could be submitted twice."
